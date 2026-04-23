import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Vercel Cron hits this endpoint; it decides whether NOW is within a
// fire-window (±10 minutes of delivery_time - 1 hour in the user's
// timezone) and, if so, calls the Claude Routine API. De-duplicated
// by looking at the most recent agent_runs.started_at.

const FIRE_WINDOW_MIN = 10;
const LOOKBACK_SECONDS = 60 * 60 * 2; // don't fire twice within 2h

function isVercelCron(req: Request): boolean {
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

function minutesOffsetFromTarget(
  now: Date,
  tz: string,
  targetHm: string,
): number {
  const { h, m } = hoursMinutesInTz(now, tz);
  const [th, tm] = targetHm.split(":").map((x) => parseInt(x, 10));
  const nowMin = h * 60 + m;
  const targetMin = (th ?? 0) * 60 + (tm ?? 0);
  // Want to fire ~60 min BEFORE target → fire time = target - 60
  const fireTimeMin = targetMin - 60;
  const diff = nowMin - fireTimeMin;
  // Normalize into [-720, +720] to handle day wrap
  if (diff > 720) return diff - 1440;
  if (diff < -720) return diff + 1440;
  return diff;
}

async function fireRoutine(): Promise<{ ok: boolean; status: number; body: string; sessionId: string | null }> {
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
  if (!isVercelCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = await getServerSupabase();
  const { data: brief } = await supabase
    .from("briefs")
    .select("am_delivery_time, pm_delivery_time, timezone")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brief) {
    return NextResponse.json({ skipped: "no_active_brief" });
  }

  const tz = brief.timezone || "Europe/Brussels";
  const now = new Date();

  const am = minutesOffsetFromTarget(now, tz, brief.am_delivery_time);
  const pm = minutesOffsetFromTarget(now, tz, brief.pm_delivery_time);

  const within =
    Math.abs(am) <= FIRE_WINDOW_MIN
      ? "am"
      : Math.abs(pm) <= FIRE_WINDOW_MIN
        ? "pm"
        : null;

  if (!within) {
    return NextResponse.json({ skipped: "outside_window", am, pm });
  }

  // De-dup: don't fire if a run started within the last 2h
  const cutoff = new Date(now.getTime() - LOOKBACK_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from("agent_runs")
    .select("started_at")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    return NextResponse.json({ skipped: "recent_run", slot: within, recent });
  }

  const fire = await fireRoutine();
  if (!fire.ok) {
    return NextResponse.json(
      { slot: within, fired: false, detail: fire.body, status: fire.status },
      { status: 502 },
    );
  }
  return NextResponse.json({ slot: within, fired: true, session_id: fire.sessionId });
}
