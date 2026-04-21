import { BriefEditor } from "./brief-editor";
import { fixtureCards } from "@/lib/fixtures/cards";
import type { BriefRow } from "@/lib/supabase/database.types";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FIXTURE_BRIEF: BriefRow = {
  id: "fx-brief",
  content: `# Brief personnel (fixture)

## Couche 1 — Domaines d'intérêt
- IA appliquée (modèles, agents, produits)
- Macro-économie et politique monétaire
- Médecine (radiologie, oncologie)
- Belgique / UE : politique et régulation tech

Anti-intérêts : sport, people, crypto spéculatif.

## Couche 2 — Sources
Gmail, Notion, arXiv cs.AI, Stratechery, Le Monde, FT, Nature, Elsevier.

## Couche 3 — Articles-ancres
- ${fixtureCards[0]!.sources[0]!.url}
- ${fixtureCards[9]!.sources[0]!.url}
`,
  anchor_articles: [],
  is_active: true,
  created_at: new Date().toISOString(),
};

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

export default async function BriefPage() {
  const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";
  const brief = await loadBrief(useFixtures);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-4 px-4 pb-10 pt-8 safe-top">
      <header className="px-2">
        <h1 className="font-display text-[22px] font-medium text-text-primary">Brief</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Le curateur relit ce document à chaque briefing. Garde-le précis.
        </p>
      </header>

      <BriefEditor initial={brief} readOnly={useFixtures} />
    </main>
  );
}
