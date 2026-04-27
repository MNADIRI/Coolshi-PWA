import { NextResponse } from "next/server";
import { isPushConfigured, notifyUser } from "@/lib/push";
import { getServiceSupabase } from "@/lib/supabase/service";

// Hit by Supabase pg_cron every 5 minutes (see supabase/setup-pg-cron.sql).
// Finds completed pending_runs whose batch is now visible to the user
// (delivered_at <= now), atomically claims the notification right, and
// fires a web push. The atomic claim makes this idempotent — concurrent
// invocations can't double-notify.

const SCHEDULED_DELIVERY_MESSAGES = [
  "your briefing just landed",
  "fresh batch waiting in your feed",
  "today's reading is ready",
  "batch delivered — go see",
];

function pickMessage(): string {
  return (
    SCHEDULED_DELIVERY_MESSAGES[
      Math.floor(Math.random() * SCHEDULED_DELIVERY_MESSAGES.length)
    ] ?? "your briefing is ready"
  );
}

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ skipped: "push_not_configured" });
  }

  const supabase = getServiceSupabase();
  const nowIso = new Date().toISOString();

  // Candidate runs: completed, not yet notified, with a batch_id.
  const { data: candidates, error: candErr } = await supabase
    .from("pending_runs")
    .select("id, user_id, batch_id, completed_at")
    .eq("status", "completed")
    .is("notified_at", null)
    .not("batch_id", "is", null)
    .order("completed_at", { ascending: true })
    .limit(50);
  if (candErr) {
    return NextResponse.json({ error: candErr.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ready: 0, notified: 0 });
  }

  const results: Array<{
    pending_run_id: string;
    user_id: string;
    batch_id: string;
    notified: boolean;
    sent?: number;
    skipped_reason?: string;
  }> = [];

  for (const pr of candidates) {
    if (!pr.batch_id || !pr.user_id) continue;

    // Confirm at least one card from this batch is now visible.
    const { data: card } = await supabase
      .from("feed_cards")
      .select("id")
      .eq("batch_id", pr.batch_id)
      .eq("user_id", pr.user_id)
      .lte("delivered_at", nowIso)
      .limit(1)
      .maybeSingle();
    if (!card) {
      results.push({
        pending_run_id: pr.id,
        user_id: pr.user_id,
        batch_id: pr.batch_id,
        notified: false,
        skipped_reason: "not_yet_delivered",
      });
      continue;
    }

    // Atomic claim — UPDATE with WHERE notified_at IS NULL ensures only one
    // invocation can win this row even if pg_cron double-fires.
    const { data: claimed, error: claimErr } = await supabase
      .from("pending_runs")
      .update({ notified_at: nowIso })
      .eq("id", pr.id)
      .is("notified_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) {
      results.push({
        pending_run_id: pr.id,
        user_id: pr.user_id,
        batch_id: pr.batch_id,
        notified: false,
        skipped_reason: "claim_lost",
      });
      continue;
    }

    const sendResult = await notifyUser(pr.user_id, {
      title: "coolshi",
      body: pickMessage(),
      url: "/feed",
      tag: "scheduled-batch",
    });
    results.push({
      pending_run_id: pr.id,
      user_id: pr.user_id,
      batch_id: pr.batch_id,
      notified: true,
      sent: sendResult.sent,
    });
  }

  return NextResponse.json({
    ready: candidates.length,
    notified: results.filter((r) => r.notified).length,
    results,
  });
}
