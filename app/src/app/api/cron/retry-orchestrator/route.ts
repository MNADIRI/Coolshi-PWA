import { NextResponse } from "next/server";
import { isPushConfigured, notifyUser } from "@/lib/push";
import { getServiceSupabase } from "@/lib/supabase/service";

// Hit by Supabase pg_cron every 5 minutes. Rescues stuck pending_runs:
//
//  - status='processing' AND started_at older than 15 min
//      → agent timed out / orphaned. Reset to 'pending', re-fire trigger.
//  - status='pending' AND created_at older than 3 min
//      → Anthropic trigger POST silently failed. Re-fire.
//  - status='failed' AND retry_count < 3 AND completed_at within 6h
//      → recent hard fail (degraded mode, etc). Reset to 'pending', re-fire.
//
// Each rescue increments retry_count. Beyond 3 attempts, the row is left
// as 'failed' and the user gets a push that their briefing didn't ship.
// All transitions are atomic-claim (UPDATE ... WHERE old_state RETURNING)
// so concurrent invocations can't double-process.

const STALE_PROCESSING_MIN = 15;
const STALE_PENDING_MIN = 3;
const FAILED_LOOKBACK_HOURS = 6;
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

async function fireTrigger(): Promise<{ ok: boolean; status: number }> {
  const url = process.env.CLAUDE_ROUTINE_URL;
  const token = process.env.CLAUDE_ROUTINE_TOKEN;
  if (!url || !token) return { ok: false, status: 0 };
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
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

type Action =
  | "retried_orphan"
  | "retried_unclaimed"
  | "retried_failed"
  | "permanent_fail_notified"
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
  const failedLookbackCutoff = new Date(
    now.getTime() - FAILED_LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // Three separate queries — clearer than one big OR, and the dataset
  // is tiny (handful of users).
  const [orphans, unclaimed, failed] = await Promise.all([
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, started_at")
      .eq("status", "processing")
      .lt("started_at", staleProcessingCutoff)
      .order("started_at", { ascending: true })
      .limit(20),
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, created_at")
      .eq("status", "pending")
      .lt("created_at", stalePendingCutoff)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("pending_runs")
      .select("id, user_id, slot, retry_count, completed_at")
      .eq("status", "failed")
      .lt("retry_count", MAX_RETRIES)
      .gt("completed_at", failedLookbackCutoff)
      .is("notified_at", null)
      .order("completed_at", { ascending: true })
      .limit(20),
  ]);

  const results: RowResult[] = [];

  // 1. Orphan processing → retry or permanent fail
  for (const row of orphans.data ?? []) {
    if (row.retry_count >= MAX_RETRIES) {
      await markPermanentFail(supabase, row.id, row.user_id, nowIso, results);
      continue;
    }
    const { data: claimed } = await supabase
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
    if (!claimed) {
      results.push({
        id: row.id,
        user_id: row.user_id,
        retry_count: row.retry_count,
        action: "claim_lost",
      });
      continue;
    }
    const fire = await fireTrigger();
    results.push({
      id: row.id,
      user_id: row.user_id,
      retry_count: row.retry_count + 1,
      action: fire.ok ? "retried_orphan" : "trigger_call_failed",
      status: fire.status,
    });
  }

  // 2. Never-claimed pending → just re-fire (state stays 'pending')
  for (const row of unclaimed.data ?? []) {
    if (row.retry_count >= MAX_RETRIES) {
      await markPermanentFail(supabase, row.id, row.user_id, nowIso, results);
      continue;
    }
    const { data: claimed } = await supabase
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
    if (!claimed) {
      results.push({
        id: row.id,
        user_id: row.user_id,
        retry_count: row.retry_count,
        action: "claim_lost",
      });
      continue;
    }
    const fire = await fireTrigger();
    results.push({
      id: row.id,
      user_id: row.user_id,
      retry_count: row.retry_count + 1,
      action: fire.ok ? "retried_unclaimed" : "trigger_call_failed",
      status: fire.status,
    });
  }

  // 3. Recently-failed → reset and re-fire
  for (const row of failed.data ?? []) {
    if (row.retry_count >= MAX_RETRIES) {
      await markPermanentFail(supabase, row.id, row.user_id, nowIso, results);
      continue;
    }
    const { data: claimed } = await supabase
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
    if (!claimed) {
      results.push({
        id: row.id,
        user_id: row.user_id,
        retry_count: row.retry_count,
        action: "claim_lost",
      });
      continue;
    }
    const fire = await fireTrigger();
    results.push({
      id: row.id,
      user_id: row.user_id,
      retry_count: row.retry_count + 1,
      action: fire.ok ? "retried_failed" : "trigger_call_failed",
      status: fire.status,
    });
  }

  return NextResponse.json({
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
  // Atomic claim: only the first invocation gets to notify.
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
