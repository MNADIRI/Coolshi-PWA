import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CardBody } from "@/components/card/card-body";
import { SkyProvider } from "@/components/sky/sky";
import { toCardView } from "@/lib/card-format";
import { fixtureCards } from "@/lib/fixtures/cards";
import { getPublicSupabase } from "@/lib/supabase/public";
import type { FeedCardRow } from "@/lib/supabase/database.types";

export const revalidate = 60;

const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

const getCardBySlug = cache(
  async (slug: string): Promise<FeedCardRow | null> => {
    if (USE_FIXTURES) {
      return fixtureCards.find((c) => c.public_slug === slug) ?? null;
    }
    const supabase = getPublicSupabase();
    const { data, error } = await supabase
      .from("feed_cards")
      .select("*")
      .eq("public_slug", slug)
      .eq("is_public", true)
      .maybeSingle();
    if (error) {
      console.error("[/c/slug] fetch failed:", error);
      return null;
    }
    return data ?? null;
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await getCardBySlug(slug);
  if (!row) {
    return { title: "Card not found · Coolshi", robots: { index: false, follow: false } };
  }
  const description = row.synthesis.slice(0, 160);
  const ogImage = `/api/og/card/${slug}?format=square`;
  return {
    title: `${row.title} · Coolshi`,
    description,
    openGraph: {
      title: row.title,
      description,
      type: "article",
      url: `/c/${slug}`,
      images: [{ url: ogImage, width: 1080, height: 1080, alt: row.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: row.title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getCardBySlug(slug);
  if (!row) notFound();
  const view = toCardView(row);

  return (
    <main className="min-h-dvh bg-canvas">
      <SkyProvider className="mx-auto max-w-[480px] px-6 pb-[80px] pt-8 safe-bottom">
        <CardBody view={view} />
        <div className="mt-12 border-t border-divider pt-6 text-center">
          <Link
            href="/"
            className="font-text text-[12px] font-medium tracking-[0.02em] text-ink-3 transition-colors hover:text-ink"
          >
            See your own briefing — coolshi.app
          </Link>
        </div>
      </SkyProvider>
    </main>
  );
}
