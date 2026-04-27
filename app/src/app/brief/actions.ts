"use server";

import { fireRoutineTrigger } from "@/lib/routine-fire";
import { getServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Called from the Brief save flow. If the user has zero feed_cards yet,
// queue a pending_run for them and fire the routine, so their first
// batch arrives as soon as they've configured their brief.
export async function triggerOnboardingBatchIfNeeded(): Promise<
  { fired: boolean; reason?: string }
> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fired: false, reason: "unauthorized" };

  const { count } = await supabase
    .from("feed_cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) return { fired: false, reason: "already_has_cards" };

  const { data: brief } = await supabase
    .from("briefs")
    .select("timezone")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  const tz = brief?.timezone ?? "Europe/Brussels";
  const today = todayInTz(tz);

  const service = getServiceSupabase();

  // Check if a pending/processing run already exists for this user in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await service
    .from("pending_runs")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .gte("created_at", oneHourAgo)
    .maybeSingle();
  if (recent) return { fired: false, reason: "already_queued" };

  // Manual-batch job row so the UI can detect an in-flight onboarding batch
  await supabase
    .from("manual_batch_jobs")
    .upsert(
      {
        user_id: user.id,
        requested_for_date: today,
        status: "in_progress",
      },
      { onConflict: "user_id,requested_for_date" },
    );

  const { data: pending } = await service
    .from("pending_runs")
    .insert({ user_id: user.id, slot: "manual" })
    .select("id")
    .single();

  const fire = await fireRoutineTrigger({
    supabase: service,
    source: "onboarding",
    pendingRunId: pending?.id ?? null,
  });
  if (!fire.ok) return { fired: false, reason: "routine_unreachable" };

  return { fired: true };
}
