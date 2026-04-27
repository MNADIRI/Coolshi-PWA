import { NextResponse } from "next/server";
import { isPushConfigured, notifyUser } from "@/lib/push";
import {
  countFiresToday,
  dailyQuota,
  fireRoutineTrigger,
} from "@/lib/routine-fire";
import { getServiceSupabase } from "@/lib/supabase/service";

// Hit by Supabase pg_cron every 5 minutes. Rescues stuck pending_runs
// without burning through the Anthropic remote-trigger daily quota.
//
// Categories of stuck rows:
//  - status='processing' AND started_at older than 15 min AND
//    created_at within SLOT_RELEVANCE_HOURS  → agent timed out / orphaned.
//  - status='pending' AND created_at older than 3 min AND
//    created_at within SLOT_RELEVANCE_HOURS  → POST silently failed.
//  - status='failed' AND retry_count<3 AND completed_at within
//    SLOT_RELEVANCE_HOURS                    → recent hard fail.
//
// Hard guards:
//  - Daily quota (default 15 fires/day, env ROUTINE_DAILY_QUOTA) — checked
//    before every retry. Routine_fires log is the source of truth.
//  - SLOT_RELEVANCE_HOURS (4h): rows created longer ago are skipped (or
//    permanent-failed if not yet notified). The slot is past, retrying
//    burns budget for nothing.
//  - retry_count <= MAX_RETRIES (3): bounded attempts.
//
// Beyond 3 retries OR past relevance: status stays 'failed', notified_at
// set, push 'your briefing didn't make it through' fires once.
//
// All transitions are atomic-claim so concurrent invocations can't
// double-process.

const STALE_PROCESSING_MIN = 15;
const STALE_PENDING_MIN = 3;
const SLOT_RELEVANCE_HOURS = 4;
const MAX_RETRIES = 3;

const PERMANENT_FAIL_MESSAGES = [
  "your briefing didn't make it through — pull to refresh in the feed",
  "the routine had a hiccup — open the app and refresh to retry",
  "couldn't deliver this batch — refresh to try again",
];

function pickFailMessage(): string {
  return (
    PERMANENT_FAIL_MESSAGES[
      Math.floor(Math.random() * PERMANENT_FAIL_MESSAGES.length)
    ] ?? "your briefing failed to generate"
  );
}

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type Action =
  | "retried_orphan"
  | "retried_unclaimed"
  | "retried_failed"
  | "permanent_fail_notified"
  | "skipped_quota"
  | "skipped_irrelevant"
  | "claim_lost"
  | "trigger_call_failed";

type RowResult = {
  id: string;
  user_id: string;
  retry_count: number;
  action: Action;
  status?: number;
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleProcessingCutoff = new Date(
    now.getTime() - STALE_PROCESSING_MIN * 60 * 1000,
  ).toISOString();
  const stalePendingCutoff = new Date(
    now.getTime() - STALE_PENDING_MIN * 60 * 1000,
  ).toISOString();
  const relevanceCutoff = new Date(
    now.getTime() - SLOT_RELEVANCE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const quota = dailyQuota();
  const firedToday = await countFiresToday(supabase);
  let budgetRemaining = Math.max(0, quota - firedToday);

  // Three separate queries — clearer than one big OR, dataset is tiny.
  // We also filter by relevance: only rescue rows from the current slot
  // window (last SLOT_RELEVANCE_HOURS).
  const [orphans, unclaimed, failed] = await Promise.all([
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, started_at, created_at")
      .eq("status", "processing")
      .lt("started_at", staleProcessingCutoff)
      .gte("created_at", relevanceCutoff)
      .order("started_at", { ascending: true })
      .limit(20),
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, created_at")
      .eq("status", "pending")
      .lt("created_at", stalePendingCutoff)
      .gte("created_at", relevanceCutoff)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, completed_at, created_at")
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES)
      .gte("created_at", relevanceCutoff)
      .is("notified_at", null)
      .order("completed_at", { ascending: true })
      .limit(20),
  ]);

  const results: RowResult[] = [];

  // Helper: try to retry a single row. Centralises the quota check and
  // the trigger call. Returns the action recorded.
  async function retryRow(args: {
    row: { id: string; user_id: string; retry_count: number };
    successAction: Action;
    claimUpdate: () => Promise<{ ok: boolean }>;
  }): Promise<void> {
    const { row, successAction, claimUpdate } = args;
    if (row.retry_count >= MAX_RETRIES) {
      await markPermanentFail(supabase, row.id, row.user_id, nowIso, results);
      return;
    }
    if (budgetRemaining <= 0) {
      results.push({
        id: row.id,
        user_id: row.user_id,
        retry_count: row.retry_count,
        action: "skipped_quota",
      });
      return;
    }
    const claim = await claimUpdate();
    if (!claim.ok) {
      results.push({
        id: row.id,
        user_id: row.user_id,
        retry_count: row.retry_count,
        action: "claim_lost",
      });
      return;
    }
    budgetRemaining -= 1;
    const fire = await fireRoutineTrigger({
      supabase,
      source: "retry-orchestrator",
      pendingRunId: row.id,
    });
    results.push({
      id: row.id,
      user_id: row.user_id,
      retry_count: row.retry_count + 1,
      action: fire.ok ? successAction : "trigger_call_failed",
      status: fire.status,
    });
  }

  // 1. Orphan processing → reset state then retry
  for (const row of orphans.data ?? []) {
    await retryRow({
      row,
      successAction: "retried_orphan",
      claimUpdate: async () => {
        const { data } = await supabase
          .from("pending_runs")
          .update({
            status: "pending",
            started_at: null,
            retry_count: row.retry_count + 1,
            error_message: `auto-retry #${row.retry_count + 1} after orphan processing`,
          })
          .eq("id", row.id)
          .eq("status", "processing")
          .lt("started_at", staleProcessingCutoff)
          .select("id")
          .maybeSingle();
        return { ok: !!data };
      },
    });
  }

  // 2. Never-claimed pending → just re-fire (state stays 'pending')
  for (const row of unclaimed.data ?? []) {
    await retryRow({
      row,
      successAction: "retried_unclaimed",
      claimUpdate: async () => {
        const { data } = await supabase
          .from("pending_runs")
          .update({
            retry_count: row.retry_count + 1,
            error_message: `auto-retry #${row.retry_count + 1} after never-claimed`,
          })
          .eq("id", row.id)
          .eq("status", "pending")
          .lt("created_at", stalePendingCutoff)
          .select("id")
          .maybeSingle();
        return { ok: !!data };
      },
    });
  }

  // 3. Recently-failed → reset and re-fire
  for (const row of failed.data ?? []) {
    await retryRow({
      row,
      successAction: "retried_failed",
      claimUpdate: async () => {
        const { data } = await supabase
          .from("pending_runs")
          .update({
            status: "pending",
            started_at: null,
            completed_at: null,
            error_message: `auto-retry #${row.retry_count + 1} after failed`,
            retry_count: row.retry_count + 1,
          })
          .eq("id", row.id)
          .eq("status", "failed")
          .lt("retry_count", MAX_RETRIES)
          .select("id")
          .maybeSingle();
        return { ok: !!data };
      },
    });
  }

  return NextResponse.json({
    quota,
    fired_today: firedToday,
    budget_remaining_at_start: Math.max(0, quota - firedToday),
    budget_remaining_at_end: budgetRemaining,
    scanned: {
      orphans: orphans.data?.length ?? 0,
      unclaimed: unclaimed.data?.length ?? 0,
      failed: failed.data?.length ?? 0,
    },
    actions: results,
  });
}

async function markPermanentFail(
  supabase: ReturnType<typeof getServiceSupabase>,
  rowId: string,
  userId: string,
  nowIso: string,
  results: RowResult[],
): Promise<void> {
  const { data: claimed } = await supabase
    .from("pending_runs")
    .update({ notified_at: nowIso, status: "failed" })
    .eq("id", rowId)
    .gte("retry_count", MAX_RETRIES)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    results.push({
      id: rowId,
      user_id: userId,
      retry_count: MAX_RETRIES,
      action: "claim_lost",
    });
    return;
  }
  if (isPushConfigured()) {
    await notifyUser(userId, {
      title: "coolshi",
      body: pickFailMessage(),
      url: "/feed",
      tag: "scheduled-batch-failed",
    });
  }
  results.push({
    id: rowId,
    user_id: userId,
    retry_count: MAX_RETRIES,
    action: "permanent_fail_notified",
  });
}
