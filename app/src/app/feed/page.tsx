import type { BriefRow, FeedCardRow, ManualBatchJobRow } from "@/lib/supabase/database.types";
import { fixtureCards } from "@/lib/fixtures/cards";
import { getServerSupabase } from "@/lib/supabase/server";
import { extractHeroImage } from "@/lib/og-image";
import { SpaShell } from "@/components/shell/spa-shell";

export const dynamic = "force-dynamic";

const FIXTURE_BRIEF: BriefRow = {
  id: "fx-brief",
  content: null,
  anchor_articles: [],
  is_active: true,
  location: "Brussels, Belgium",
  international_scope: 70,
  recency_days: 70,
  expertise_level: 65,
  interests: "Applied AI, radiology, tech and platform news, monetary policy, macro.",
  preferences: "Technical and expert tone. Density over hand-holding.",
  must_not_miss: "Major AI model releases; ECB and Fed decisions; landmark radiology clinical trials.",
  am_delivery_time: "07:00",
  pm_delivery_time: "18:00",
  timezone: "Europe/Brussels",
  language: "en",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export interface BatchGroup {
  batch_id: string;
  cards: FeedCardRow[];
}

async function loadBatches(useFixtures: boolean): Promise<BatchGroup[]> {
  if (useFixtures) {
    return [{ batch_id: fixtureCards[0]?.batch_id ?? "fx", cards: fixtureCards }];
  }
  const supabase = await getServerSupabase();
  const nowIso = new Date().toISOString();
  const { data: recent } = await supabase
    .from("feed_cards")
    .select("batch_id, created_at")
    .eq("is_reserve", false)
    .or(`delivered_at.is.null,delivered_at.lte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(600);
  if (!recent || recent.length === 0) return [];

  const seen = new Set<string>();
  const orderedBatchIds: string[] = [];
  for (const r of recent) {
    if (!seen.has(r.batch_id)) {
      seen.add(r.batch_id);
      orderedBatchIds.push(r.batch_id);
      if (orderedBatchIds.length === 3) break;
    }
  }
  if (orderedBatchIds.length === 0) return [];

  const { data: cards, error } = await supabase
    .from("feed_cards")
    .select("*")
    .in("batch_id", orderedBatchIds)
    .eq("is_reserve", false)
    .or(`delivered_at.is.null,delivered_at.lte.${nowIso}`)
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const byId = new Map<string, FeedCardRow[]>();
  for (const id of orderedBatchIds) byId.set(id, []);
  for (const c of cards ?? []) {
    byId.get(c.batch_id)?.push(c);
  }
  const groups = orderedBatchIds.map((id) => ({
    batch_id: id,
    cards: byId.get(id) ?? [],
  }));

  // Resolve hero images only for the current batch. Previous batches keep
  // whatever hero_image_url they already have (they were resolved on their
  // own first load). Saves a handful of fetches per page render.
  if (groups[0]) await resolveHeroImages(groups[0].cards);

  return groups;
}

async function resolveHeroImages(rows: FeedCardRow[]): Promise<void> {
  const unresolved = rows.filter(
    (r) => !r.hero_image_url && Array.isArray(r.sources) && r.sources[0]?.url,
  );
  if (unresolved.length === 0) return;
  const results = await Promise.allSettled(
    unresolved.map((r) => extractHeroImage(r.sources[0]!.url)),
  );
  const supabase = await getServerSupabase();
  const updates: { id: string; hero_image_url: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      const row = unresolved[i]!;
      row.hero_image_url = r.value;
      updates.push({ id: row.id, hero_image_url: r.value });
    }
  });
  await Promise.allSettled(
    updates.map((u) =>
      supabase.from("feed_cards").update({ hero_image_url: u.hero_image_url }).eq("id", u.id),
    ),
  );
}

async function loadBrief(useFixtures: boolean): Promise<BriefRow | null> {
  if (useFixtures) return FIXTURE_BRIEF;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadTodayManualJob(
  useFixtures: boolean,
  timezone: string,
): Promise<ManualBatchJobRow | null> {
  if (useFixtures) return null;
  const supabase = await getServerSupabase();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data } = await supabase
    .from("manual_batch_jobs")
    .select("*")
    .eq("requested_for_date", today)
    .maybeSingle();
  return data ?? null;
}

async function loadReserveCount(useFixtures: boolean): Promise<number> {
  if (useFixtures) return 0;
  const supabase = await getServerSupabase();
  const { count } = await supabase
    .from("feed_cards")
    .select("id", { count: "exact", head: true })
    .eq("is_reserve", true);
  return count ?? 0;
}

async function loadSavedCards(useFixtures: boolean): Promise<FeedCardRow[]> {
  if (useFixtures) return [];
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("saved_cards")
    .select("card_id, saved_at, feed_cards(*)")
    .order("saved_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  type Row = { card_id: string; saved_at: string; feed_cards: FeedCardRow | null };
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((r) => r.feed_cards).filter((c): c is FeedCardRow => c !== null);
}

export default async function FeedPage() {
  const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";
  const brief = await loadBrief(useFixtures);
  const tz = brief?.timezone ?? "Europe/Brussels";

  const [batches, savedCards, manualJob, reserveCount] = await Promise.all([
    loadBatches(useFixtures),
    loadSavedCards(useFixtures),
    loadTodayManualJob(useFixtures, tz),
    loadReserveCount(useFixtures),
  ]);

  return (
    <SpaShell
      batches={batches}
      brief={brief}
      savedCards={savedCards}
      manualJob={manualJob}
      reserveCount={reserveCount}
      useFixtures={useFixtures}
    />
  );
}
