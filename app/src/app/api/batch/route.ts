import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { notifyAll, isPushConfigured } from "@/lib/push";

function brusselsToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

async function tryRemoteTrigger(): Promise<{ ok: boolean; note: string }> {
  const token = process.env.CLAUDE_CODE_TOKEN;
  const orgId = process.env.CLAUDE_CODE_ORG_ID;
  const triggerId = process.env.CLAUDE_CODE_TRIGGER_ID;
  if (!token || !orgId || !triggerId) {
    return { ok: false, note: "trigger env not configured; job queued" };
  }
  try {
    const res = await fetch(
      `https://claude.ai/api/organizations/${orgId}/code/triggers/${triggerId}/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    return { ok: res.ok, note: res.ok ? "triggered" : `remote ${res.status}` };
  } catch (e) {
    return { ok: false, note: `fetch failed: ${String(e).slice(0, 80)}` };
  }
}

export async function POST() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ error: "fixtures mode" }, { status: 400 });
  }
  const triggerConfigured =
    Boolean(process.env.CLAUDE_CODE_TOKEN) &&
    Boolean(process.env.CLAUDE_CODE_ORG_ID) &&
    Boolean(process.env.CLAUDE_CODE_TRIGGER_ID);

  if (!triggerConfigured) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Manual triggering requires CLAUDE_CODE_TOKEN / CLAUDE_CODE_ORG_ID / CLAUDE_CODE_TRIGGER_ID env vars on Vercel. The two daily scheduled batches still run.",
      },
      { status: 501 },
    );
  }

  const supabase = await getServerSupabase();
  const today = brusselsToday();

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

  const trigger = await tryRemoteTrigger();
  if (!trigger.ok) {
    await supabase
      .from("manual_batch_jobs")
      .update({
        status: "failed",
        error_message: trigger.note,
        completed_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);
    return NextResponse.json(
      { error: "trigger_failed", note: trigger.note },
      { status: 502 },
    );
  }
  return NextResponse.json({ job: inserted, trigger });
}

const COMPLETION_MESSAGES = [
  "your batch is ready — fresh from the chaos",
  "curation complete, come see",
  "done. the morning (or night) reading is served.",
];

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ job: null });
  }
  const supabase = await getServerSupabase();
  const today = brusselsToday();
  const { data } = await supabase
    .from("manual_batch_jobs")
    .select("*")
    .eq("requested_for_date", today)
    .maybeSingle();

  if (data?.status === "completed" && !data.notified_at && isPushConfigured()) {
    const { error: claimErr } = await supabase
      .from("manual_batch_jobs")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("notified_at", null);
    if (!claimErr) {
      const msg =
        COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]!;
      await notifyAll({
        title: "coolshi",
        body: msg,
        url: "/feed",
        tag: "manual-batch",
      });
    }
  }

  return NextResponse.json({ job: data ?? null });
}
