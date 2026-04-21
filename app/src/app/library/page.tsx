import Link from "next/link";
import { fixtureCards } from "@/lib/fixtures/cards";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { getServerSupabase } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

interface BatchSummary {
  batch_id: string;
  count: number;
  first_created_at: string;
}

async function loadBatches(useFixtures: boolean): Promise<BatchSummary[]> {
  if (useFixtures) {
    return [
      {
        batch_id: fixtureCards[0]!.batch_id,
        count: fixtureCards.length,
        first_created_at: fixtureCards[0]!.created_at,
      },
    ];
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("feed_cards")
    .select("batch_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const byBatch = new Map<string, { count: number; first: string }>();
  for (const row of data ?? []) {
    const existing = byBatch.get(row.batch_id);
    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.first) existing.first = row.created_at;
    } else {
      byBatch.set(row.batch_id, { count: 1, first: row.created_at });
    }
  }
  return Array.from(byBatch, ([batch_id, v]) => ({
    batch_id,
    count: v.count,
    first_created_at: v.first,
  })).sort((a, b) => b.first_created_at.localeCompare(a.first_created_at));
}

async function loadRecentCards(useFixtures: boolean): Promise<FeedCardRow[]> {
  if (useFixtures) return fixtureCards.slice(0, 5);
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("feed_cards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export default async function LibraryPage() {
  const useFixtures = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";
  const [batches, recent] = await Promise.all([
    loadBatches(useFixtures),
    loadRecentCards(useFixtures),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-8 px-4 pb-10 pt-8 safe-top">
      <header className="px-2">
        <h1 className="font-display text-[22px] font-medium text-text-primary">Library</h1>
        <p className="mt-1 text-[13px] text-text-secondary">Briefings passés et cartes récentes.</p>
      </header>

      <section className="px-2">
        <h2 className="mb-2 font-display text-[16px] font-medium text-text-primary">Briefings</h2>
        {batches.length === 0 ? (
          <p className="text-[14px] text-text-secondary">Aucun briefing archivé.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-card bg-bg-surface ring-1 ring-divider">
            {batches.map((b) => (
              <li key={b.batch_id} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-[13px] text-text-primary">{b.batch_id}</span>
                <span className="text-[13px] text-text-secondary">
                  {b.count} carte{b.count > 1 ? "s" : ""} · {timeAgo(b.first_created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-2">
        <h2 className="mb-2 font-display text-[16px] font-medium text-text-primary">
          Cartes récentes
        </h2>
        {recent.length === 0 ? (
          <p className="text-[14px] text-text-secondary">Aucune carte.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((card) => (
              <li
                key={card.id}
                className="rounded-card bg-bg-surface p-4 ring-1 ring-divider"
              >
                <Link
                  href={card.sources[0]?.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-[15px] font-medium text-text-primary hover:underline"
                >
                  {card.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-[13px] text-text-secondary">
                  {card.synthesis}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
