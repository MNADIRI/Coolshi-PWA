import type { BriefRow, FeedCardRow } from "@/lib/supabase/database.types";
import { fixtureCards } from "@/lib/fixtures/cards";
import { getServerSupabase } from "@/lib/supabase/server";
import type { LibrarySource } from "@/components/screens/library-screen";
import type { PastelHue } from "@/components/sky/sky";
import { SpaShell } from "@/components/shell/spa-shell";

export const dynamic = "force-dynamic";

const HUE_SEQUENCE: PastelHue[] = [
  "sage",
  "peach",
  "butter",
  "iris",
  "mint",
  "sky",
  "mauve",
  "rose",
  "sand",
  "slate",
];

const FIXTURE_BRIEF: BriefRow = {
  id: "fx-brief",
  content: `# Personal brief (fixture)

## Layer 1 — Domains of interest

Applied **AI** (models, agents, products), **radiology** (clinical imaging, computer-aided diagnosis), **tech news** (platform shifts, policy), **political and economic news** (monetary policy, macro, financial regulation).

## Layer 2 — Sources

arXiv cs.AI, Stratechery, FT, Nature, Radiology, Hacker News, ECB and Fed press releases.

## Layer 3 — Tone

Technical and expert. Favor density and crisp framing over hand-holding.
`,
  anchor_articles: [],
  is_active: true,
  created_at: new Date().toISOString(),
};

async function loadFeedCards(useFixtures: boolean): Promise<FeedCardRow[]> {
  if (useFixtures) return fixtureCards;
  const supabase = await getServerSupabase();
  const { data: latest } = await supabase
    .from("feed_cards")
    .select("batch_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];
  const { data: cards, error } = await supabase
    .from("feed_cards")
    .select("*")
    .eq("batch_id", latest.batch_id)
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return cards ?? [];
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

interface SourceRow {
  name: string;
  source_tier: "A" | "B" | "C" | "D" | null;
  is_active: boolean | null;
  last_fetched_at: string | null;
}

function statusFromLastFetch(lastFetchedAt: string | null): string {
  if (!lastFetchedAt) return "Not yet fetched";
  const diffMin = Math.round((Date.now() - new Date(lastFetchedAt).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}h ago`;
  return `${Math.round(diffMin / (24 * 60))}d ago`;
}

async function loadLibrary(useFixtures: boolean): Promise<LibrarySource[]> {
  if (useFixtures) {
    return [
      { name: "arXiv cs.AI", tier: "A", status: "15 min ago", active: true, hue: "sage" },
      { name: "Stratechery", tier: "A", status: "1h ago", active: true, hue: "peach" },
      { name: "Reuters", tier: "A", status: "20 min ago", active: true, hue: "butter" },
      { name: "Le Monde", tier: "B", status: "Session 2d", active: true, hue: "iris" },
      { name: "Nature", tier: "B", status: "3h ago", active: true, hue: "mint" },
      { name: "Quanta", tier: "B", status: "5h ago", active: true, hue: "sky" },
      { name: "Are.na", tier: "C", status: "8h ago", active: true, hue: "rose" },
      { name: "Instagram", tier: "C", status: "2h ago", active: false, hue: "slate" },
    ];
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("sources")
    .select("name, source_tier, is_active, last_fetched_at")
    .order("name");
  if (error) throw error;
  const rows = (data ?? []) as unknown as SourceRow[];
  return rows.map((r, i) => ({
    name: r.name,
    tier: (r.source_tier ?? "B") as LibrarySource["tier"],
    status: statusFromLastFetch(r.last_fetched_at),
    active: Boolean(r.is_active),
    hue: HUE_SEQUENCE[i % HUE_SEQUENCE.length]!,
  }));
}

async function loadRecentForSaved(useFixtures: boolean): Promise<FeedCardRow[]> {
  if (useFixtures) return fixtureCards.slice(0, 4);
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("feed_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return data ?? [];
}

export default async function FeedPage() {
  const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";
  const [feedRows, brief, library, recentForSaved] = await Promise.all([
    loadFeedCards(useFixtures),
    loadBrief(useFixtures),
    loadLibrary(useFixtures),
    loadRecentForSaved(useFixtures),
  ]);

  return (
    <SpaShell
      feedRows={feedRows}
      brief={brief}
      library={library}
      recentForSaved={recentForSaved}
      useFixtures={useFixtures}
    />
  );
}
