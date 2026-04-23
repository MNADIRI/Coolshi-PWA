import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { notifyAll, isPushConfigured } from "@/lib/push";

function brusselsToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Supa = Awaited<ReturnType<typeof getServerSupabase>>;

async function reserveCount(supabase: Supa): Promise<number> {
  const { count } = await supabase
    .from("feed_cards")
    .select("id", { count: "exact", head: true })
    .eq("is_reserve", true);
  return count ?? 0;
}

function routineConfigured(): boolean {
  return Boolean(process.env.CLAUDE_ROUTINE_URL && process.env.CLAUDE_ROUTINE_TOKEN);
}

async function fireRoutine(): Promise<{
  ok: boolean;
  status: number;
  body: string;
  sessionId: string | null;
}> {
  const url = process.env.CLAUDE_ROUTINE_URL!;
  const token = process.env.CLAUDE_ROUTINE_TOKEN!;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
      },
      body: "{}",
    });
    const text = await res.text();
    let sessionId: string | null = null;
    try {
      const parsed = JSON.parse(text) as { claude_code_session_id?: string };
      sessionId = parsed.claude_code_session_id ?? null;
    } catch {
      // non-JSON response
    }
    return {
      ok: res.ok,
      status: res.status,
      body: text.slice(0, 500),
      sessionId,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: String(e).slice(0, 200),
      sessionId: null,
    };
  }
}

const COMPLETION_MESSAGES = [
  "your batch is ready — fresh from the chaos",
  "curation complete, come see",
  "done. the reading is served.",
];

export async function POST() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ error: "fixtures mode" }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const today = brusselsToday();

  // Daily quota via unique index on requested_for_date
  const { data: inserted, error: insertError } = await supabase
    .from("manual_batch_jobs")
    .insert({ requested_for_date: today, status: "in_progress" })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("manual_batch_jobs")
        .select("*")
        .eq("requested_for_date", today)
        .maybeSingle();
      return NextResponse.json(
        { error: "already_used_today", job: existing },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Primary path: release any pre-stocked reserves for an instant batch.
  const { data: latest } = await supabase
    .from("feed_cards")
    .select("batch_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.batch_id) {
    const { data: flipped } = await supabase
      .from("feed_cards")
      .update({ is_reserve: false, released_at: new Date().toISOString() })
      .eq("batch_id", latest.batch_id)
      .eq("is_reserve", true)
      .select("id");
    const released = flipped?.length ?? 0;
    if (released > 0) {
      await supabase
        .from("manual_batch_jobs")
        .update({
          status: "completed",
          batch_id: latest.batch_id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
      return NextResponse.json({
        mode: "reserves_released",
        released,
        batch_id: latest.batch_id,
        job: { ...inserted, status: "completed" },
      });
    }
  }

  // Fallback: no reserves → fire a fresh agent run via the Claude Routine API.
  if (!routineConfigured()) {
    await supabase.from("manual_batch_jobs").delete().eq("id", inserted.id);
    return NextResponse.json(
      {
        error: "nothing_in_reserve_and_routine_not_configured",
        message:
          "No reserves and the routine API is not configured. Come back after the next scheduled batch.",
      },
      { status: 409 },
    );
  }

  const fire = await fireRoutine();
  if (!fire.ok) {
    // Refund the quota so the user can retry after a fix.
    await supabase.from("manual_batch_jobs").delete().eq("id", inserted.id);
    return NextResponse.json(
      {
        error: "trigger_failed",
        status: fire.status,
        detail: fire.body,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    mode: "fresh_run_fired",
    job: inserted,
    trigger: { status: fire.status },
  });
}

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ job: null, reserveCount: 0 });
  }
  const supabase = await getServerSupabase();
  const today = brusselsToday();

  const { data: job } = await supabase
    .from("manual_batch_jobs")
    .select("*")
    .eq("requested_for_date", today)
    .maybeSingle();

  // If a fresh run is in progress, check whether new feed_cards have appeared
  // after the request timestamp. If yes, flip the job to completed and fire push.
  if (job?.status === "in_progress") {
    const { data: newCards } = await supabase
      .from("feed_cards")
      .select("batch_id, created_at")
      .gt("created_at", job.requested_at)
      .eq("is_reserve", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newCards?.batch_id) {
      const { data: updated } = await supabase
        .from("manual_batch_jobs")
        .update({
          status: "completed",
          batch_id: newCards.batch_id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "in_progress")
        .select()
        .single();
      if (updated && !updated.notified_at && isPushConfigured()) {
        const { error: claimErr } = await supabase
          .from("manual_batch_jobs")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", updated.id)
          .is("notified_at", null);
        if (!claimErr) {
          const msg =
            COMPLETION_MESSAGES[
              Math.floor(Math.random() * COMPLETION_MESSAGES.length)
            ]!;
          await notifyAll({
            title: "coolshi",
            body: msg,
            url: "/feed",
            tag: "manual-batch",
          });
        }
      }
      return NextResponse.json({
        job: updated,
        reserveCount: await reserveCount(supabase),
      });
    }
  }

  return NextResponse.json({
    job,
    reserveCount: await reserveCount(supabase),
  });
}
