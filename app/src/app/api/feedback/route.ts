import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

const VALID_SIGNALS = new Set(["like", "dislike", "neutral", "skip"]);

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ recorded: false, reason: "fixtures-mode" });
  }

  const body = (await req.json().catch(() => null)) as {
    card_id?: string;
    signal?: string;
    dwell_ms?: number;
  } | null;

  if (!body || !body.card_id || !body.signal || !VALID_SIGNALS.has(body.signal)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("feedback").insert({
    card_id: body.card_id,
    signal: body.signal as "like" | "dislike" | "neutral" | "skip",
    dwell_ms: typeof body.dwell_ms === "number" ? Math.max(0, Math.round(body.dwell_ms)) : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recorded: true });
}
