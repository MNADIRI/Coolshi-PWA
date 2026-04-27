import { NextResponse } from "next/server";
import { fireRoutineTrigger } from "@/lib/routine-fire";
import { getServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { notifyUser, isPushConfigured } from "@/lib/push";
import { requireUserId } from "@/lib/auth";

type Supa = Awaited<ReturnType<typeof getServerSupabase>>;

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function reserveCount(supabase: Supa, userId: string): Promise<number> {
  const { count } = await supabase
    .from("feed_cards")
    .select("id", { count: "exact", head: true })
    .eq("is_reserve", true)
    .eq("user_id", userId);
  return count ?? 0;
}

async function userTimezone(supabase: Supa, userId: string): Promise<string> {
  const { data } = await supabase
    .from("briefs")
    .select("timezone")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.timezone ?? "Europe/Brussels";
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
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getServerSupabase();
  const tz = await userTimezone(supabase, userId);
  const today = todayInTz(tz);

  // Daily quota (per user) via unique index (user_id, requested_for_date)
  const { data: inserted, error: insertError } = await supabase
    .from("manual_batch_jobs")
    .insert({
      user_id: userId,
      requested_for_date: today,
      status: "in_progress",
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("manual_batch_jobs")
        .select("*")
        .eq("user_id", userId)
        .eq("requested_for_date", today)
        .maybeSingle();
      return NextResponse.json(
        { error: "already_used_today", job: existing },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Path 1 — release pre-stocked reserves
  const { data: latest } = await supabase
    .from("feed_cards")
    .select("batch_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.batch_id) {
    const { data: flipped } = await supabase
      .from("feed_cards")
      .update({ is_reserve: false, released_at: new Date().toISOString() })
      .eq("batch_id", latest.batch_id)
      .eq("is_reserve", true)
      .eq("user_id", userId)
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

  // Path 2 — no reserves, fire a fresh run for this user via pending_runs + routine API
  if (!process.env.CLAUDE_ROUTINE_URL || !process.env.CLAUDE_ROUTINE_TOKEN) {
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

  // Enqueue + fire via service role so routine can claim the row under RLS-bypass
  const service = getServiceSupabase();
  const { data: pending } = await service
    .from("pending_runs")
    .insert({ user_id: userId, slot: "manual" })
    .select("id")
    .single();

  const fire = await fireRoutineTrigger({
    supabase: service,
    source: "manual-batch",
    pendingRunId: pending?.id ?? null,
  });
  if (!fire.ok) {
    await supabase.from("manual_batch_jobs").delete().eq("id", inserted.id);
    return NextResponse.json(
      { error: "trigger_failed", status: fire.status },
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
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getServerSupabase();
  const tz = await userTimezone(supabase, userId);
  const today = todayInTz(tz);

  const { data: job } = await supabase
    .from("manual_batch_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("requested_for_date", today)
    .maybeSingle();

  if (job?.status === "in_progress") {
    const { data: newCards } = await supabase
      .from("feed_cards")
      .select("batch_id, created_at")
      .eq("user_id", userId)
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
          await notifyUser(userId, {
            title: "coolshi",
            body: msg,
            url: "/feed",
            tag: "manual-batch",
          });
        }
      }
      return NextResponse.json({
        job: updated,
        reserveCount: await reserveCount(supabase, userId),
      });
    }
  }

  return NextResponse.json({
    job,
    reserveCount: await reserveCount(supabase, userId),
  });
}
