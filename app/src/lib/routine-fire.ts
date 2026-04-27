import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RoutineFireSource } from "@/lib/supabase/database.types";

type Supa = SupabaseClient<Database>;

export const DEFAULT_DAILY_QUOTA = 15;

export function dailyQuota(): number {
  const raw = process.env.ROUTINE_DAILY_QUOTA;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_QUOTA;
}

// Anthropic remote triggers have a per-day rate limit. We track every POST
// in the routine_fires table so any caller (cron, retry, manual) can check
// today's usage before adding more load.
//
// Counts UTC-day events to match Anthropic's apparent reset boundary.
export async function countFiresToday(supabase: Supa): Promise<number> {
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("routine_fires")
    .select("id", { count: "exact", head: true })
    .gte("fired_at", startOfDayUtc.toISOString());
  return count ?? 0;
}

export async function fireRoutineTrigger(opts: {
  supabase: Supa;
  source: RoutineFireSource;
  pendingRunId?: string | null;
}): Promise<{ ok: boolean; status: number; sessionId: string | null }> {
  const url = process.env.CLAUDE_ROUTINE_URL;
  const token = process.env.CLAUDE_ROUTINE_TOKEN;
  if (!url || !token) {
    await logFire(opts.supabase, opts.pendingRunId, opts.source, 0, false);
    return { ok: false, status: 0, sessionId: null };
  }
  let ok = false;
  let status = 0;
  let sessionId: string | null = null;
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
    status = res.status;
    ok = res.ok;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text) as { claude_code_session_id?: string };
      sessionId = parsed.claude_code_session_id ?? null;
    } catch {
      // ignore — non-JSON response
    }
  } catch {
    ok = false;
  }
  await logFire(opts.supabase, opts.pendingRunId, opts.source, status, ok);
  return { ok, status, sessionId };
}

async function logFire(
  supabase: Supa,
  pendingRunId: string | null | undefined,
  source: RoutineFireSource,
  httpStatus: number,
  ok: boolean,
): Promise<void> {
  await supabase.from("routine_fires").insert({
    pending_run_id: pendingRunId ?? null,
    source,
    http_status: httpStatus,
    ok,
  });
}
