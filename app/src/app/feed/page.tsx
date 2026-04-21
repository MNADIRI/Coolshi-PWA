import { FeedStack } from "./feed-stack";
import { fixtureCards } from "@/lib/fixtures/cards";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function nextBriefLabel(): string {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 7) return "7h";
  if (hour < 12) return "12h";
  return "7h demain";
}

async function loadCards(useFixtures: boolean): Promise<FeedCardRow[]> {
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

export default async function FeedPage() {
  const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";
  const cards = await loadCards(useFixtures);
  const nextBriefAt = nextBriefLabel();

  const heading =
    cards.length > 0
      ? `Briefing — ${cards.length} carte${cards.length > 1 ? "s" : ""}`
      : "Pas de nouveau briefing";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-6 px-4 pb-10 pt-8 safe-top">
      <header className="px-2">
        <h1 className="font-display text-[22px] font-medium text-text-primary">{heading}</h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          {cards.length > 0
            ? "Swipe droite pour aimer, gauche pour rejeter, bas pour passer."
            : `Prochain briefing à ${nextBriefAt}.`}
        </p>
      </header>

      <FeedStack cards={cards} useFixtures={useFixtures} nextBriefAt={nextBriefAt} />
    </main>
  );
}
