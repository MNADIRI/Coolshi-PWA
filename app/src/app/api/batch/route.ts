import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

function brusselsToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function reserveCount(supabase: Awaited<ReturnType<typeof getServerSupabase>>): Promise<number> {
  const { count } = await supabase
    .from("feed_cards")
    .select("id", { count: "exact", head: true })
    .eq("is_reserve", true);
  return count ?? 0;
}

export async function POST() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ error: "fixtures mode" }, { status: 400 });
  }
  const supabase = await getServerSupabase();
  const today = brusselsToday();

  // Quota: unique index on requested_for_date enforces 1/day
  const { data: inserted, error: insertError } = await supabase
    .from("manual_batch_jobs")
    .insert({ requested_for_date: today, status: "completed" })
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

  // Find the most recent batch and release its reserves
  const { data: latest } = await supabase
    .from("feed_cards")
    .select("batch_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const targetBatchId = latest?.batch_id ?? null;
  let released = 0;
  let releasedBatchId: string | null = null;

  if (targetBatchId) {
    const { data: flipped, error: flipError } = await supabase
      .from("feed_cards")
      .update({ is_reserve: false, released_at: new Date().toISOString() })
      .eq("batch_id", targetBatchId)
      .eq("is_reserve", true)
      .select("id");
    if (flipError) {
      return NextResponse.json({ error: flipError.message }, { status: 500 });
    }
    released = flipped?.length ?? 0;
    releasedBatchId = released > 0 ? targetBatchId : null;
  }

  if (released === 0) {
    // No reserves to release — refund the quota so the user can try again later
    // (e.g. after the next scheduled batch).
    await supabase.from("manual_batch_jobs").delete().eq("id", inserted.id);
    return NextResponse.json(
      { error: "nothing_in_reserve", message: "No reserve cards available right now. Come back after the next scheduled batch." },
      { status: 409 },
    );
  }

  await supabase
    .from("manual_batch_jobs")
    .update({
      batch_id: releasedBatchId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", inserted.id);

  return NextResponse.json({
    job: inserted,
    released,
    batch_id: releasedBatchId,
  });
}

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.json({ job: null, reserveCount: 0 });
  }
  const supabase = await getServerSupabase();
  const today = brusselsToday();
  const [jobRes, count] = await Promise.all([
    supabase
      .from("manual_batch_jobs")
      .select("*")
      .eq("requested_for_date", today)
      .maybeSingle(),
    reserveCount(supabase),
  ]);
  return NextResponse.json({ job: jobRes.data ?? null, reserveCount: count });
}
