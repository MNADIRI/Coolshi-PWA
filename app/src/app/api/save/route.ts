import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ saved: false, reason: "fixtures-mode" });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { card_id?: string } | null;
  if (!body?.card_id || !UUID.test(body.card_id)) {
    return NextResponse.json({ error: "invalid card_id" }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("saved_cards")
    .upsert({ card_id: body.card_id, user_id: userId }, { onConflict: "card_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request) {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ unsaved: false, reason: "fixtures-mode" });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const cardId = url.searchParams.get("card_id");
  if (!cardId || !UUID.test(cardId)) {
    return NextResponse.json({ error: "invalid card_id" }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("saved_cards")
    .delete()
    .eq("card_id", cardId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ unsubscribed: true });
}
