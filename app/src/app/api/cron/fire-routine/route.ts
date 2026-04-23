import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/service";

// Vercel Cron hits this endpoint. It iterates all active briefs, and for
// each user whose delivery window matches NOW (±2h), inserts a pending_run
// then fires the Claude Routine API once. The routine's Phase 0 claims
// the oldest pending_run atomically and processes that single user.
// De-dup: don't enqueue a user who had a pending/processing run started
// within the last 4h.

const FIRE_WINDOW_MIN = 120;
const LOOKBACK_SECONDS = 60 * 60 * 4;

function isAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function hoursMinutesInTz(now: Date, tz: string): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { h, m };
}

function minutesOffsetFromFire(
  now: Date,
  tz: string,
  targetHm: string,
): number {
  const { h, m } = hoursMinutesInTz(now, tz);
  const [thStr, tmStr] = targetHm.split(":");
  const th = parseInt(thStr ?? "0", 10);
  const tm = parseInt(tmStr ?? "0", 10);
  const nowMin = h * 60 + m;
  const targetMin = th * 60 + tm;
  const fireTimeMin = targetMin - 60; // fire 1h before delivery
  const diff = nowMin - fireTimeMin;
  if (diff > 720) return diff - 1440;
  if (diff < -720) return diff + 1440;
  return diff;
}

type Slot = "am" | "pm" | null;
function slotForNow(
  now: Date,
  tz: string,
  amHm: string,
  pmHm: string,
): Slot {
  const am = minutesOffsetFromFire(now, tz, amHm);
  if (Math.abs(am) <= FIRE_WINDOW_MIN) return "am";
  const pm = minutesOffsetFromFire(now, tz, pmHm);
  if (Math.abs(pm) <= FIRE_WINDOW_MIN) return "pm";
  return null;
}

async function fireRoutine(): Promise<{
  ok: boolean;
  status: number;
  body: string;
  sessionId: string | null;
}> {
  const url = process.env.CLAUDE_ROUTINE_URL;
  const token = process.env.CLAUDE_ROUTINE_TOKEN;
  if (!url || !token) {
    return { ok: false, status: 0, body: "routine env not configured", sessionId: null };
  }
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
      // non-JSON
    }
    return { ok: res.ok, status: res.status, body: text.slice(0, 300), sessionId };
  } catch (e) {
    return { ok: false, status: 0, body: String(e).slice(0, 200), sessionId: null };
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();

  const { data: briefs, error: briefsErr } = await supabase
    .from("briefs")
    .select("user_id, am_delivery_time, pm_delivery_time, timezone")
    .eq("is_active", true);
  if (briefsErr) {
    return NextResponse.json({ error: briefsErr.message }, { status: 500 });
  }
  if (!briefs || briefs.length === 0) {
    return NextResponse.json({ skipped: "no_active_briefs" });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - LOOKBACK_SECONDS * 1000).toISOString();

  const toFire: { user_id: string; slot: "am" | "pm" }[] = [];
  for (const b of briefs) {
    if (!b.user_id) continue;
    const tz = b.timezone || "Europe/Brussels";
    const slot = slotForNow(now, tz, b.am_delivery_time, b.pm_delivery_time);
    if (!slot) continue;

    const { data: recent } = await supabase
      .from("pending_runs")
      .select("id")
      .eq("user_id", b.user_id)
      .in("status", ["pending", "processing"])
      .gte("created_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (recent) continue;

    const { error: insertErr } = await supabase
      .from("pending_runs")
      .insert({ user_id: b.user_id, slot });
    if (insertErr) continue;
    toFire.push({ user_id: b.user_id, slot });
  }

  if (toFire.length === 0) {
    return NextResponse.json({ skipped: "no_users_in_window", evaluated: briefs.length });
  }

  // Fire once per pending user. The routine's Phase 0 claims one row each time.
  const results: { ok: boolean; session_id: string | null }[] = [];
  for (let i = 0; i < toFire.length; i++) {
    const r = await fireRoutine();
    results.push({ ok: r.ok, session_id: r.sessionId });
    if (!r.ok) break;
  }

  return NextResponse.json({
    fired: results.filter((r) => r.ok).length,
    queued: toFire.length,
    results,
  });
}
