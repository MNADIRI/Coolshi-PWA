import type { FeedCardRow } from "@/lib/supabase/database.types";

// Visual format variants from the design system (Coolshi v4).
export type CardFormat =
  | "hero"
  | "wide"
  | "wide-flip"
  | "square"
  | "text"
  | "link"
  | "micro";

export interface CardView {
  row: FeedCardRow;
  format: CardFormat;
  kicker: string;
  readTime: string;
  sourceNames: string[];
}

function kickerFor(row: FeedCardRow): string {
  const primary = row.tags?.[0] ?? (row.card_type === "deep_dive" ? "DEEP DIVE" : "BRIEF");
  const words = Math.max(1, Math.round(row.synthesis.split(/\s+/).length));
  const readMin = Math.max(1, Math.round(words / 220));
  return row.card_type === "deep_dive"
    ? `DEEP DIVE · ${readMin} MIN`
    : `${primary.toUpperCase()}`;
}

function readTimeFor(row: FeedCardRow): string {
  const words = Math.max(1, Math.round(row.synthesis.split(/\s+/).length));
  const readMin = Math.max(1, Math.round(words / 220));
  return `${readMin} min`;
}

// Deterministic visual rhythm across the feed.
// No quote/asymm-pair for now since the routine doesn't surface quotes.
export function formatFor(row: FeedCardRow, index: number, totalHero: number): CardFormat {
  if (row.card_type === "deep_dive" && totalHero < 2) return "hero";
  if ((row.importance_score ?? 0) >= 9 && totalHero < 2) return "hero";
  if (row.synthesis.length < 140 && (row.importance_score ?? 0) < 5) return "link";
  const mod = index % 7;
  switch (mod) {
    case 0:
      return "square";
    case 1:
      return "wide";
    case 2:
      return "micro";
    case 3:
      return "text";
    case 4:
      return "wide-flip";
    case 5:
      return "square";
    default:
      return "text";
  }
}

export function toCardView(row: FeedCardRow, index: number, totalHero: number): CardView {
  return {
    row,
    format: formatFor(row, index, totalHero),
    kicker: kickerFor(row),
    readTime: readTimeFor(row),
    sourceNames: row.sources.map((s) => s.name),
  };
}

export function viewsFromRows(rows: FeedCardRow[]): CardView[] {
  let heroCount = 0;
  return rows.map((row, i) => {
    const v = toCardView(row, i, heroCount);
    if (v.format === "hero") heroCount += 1;
    return v;
  });
}

// Group adjacent "micro" format cards into pairs for two-column rendering.
export type FeedNode =
  | { kind: "single"; view: CardView }
  | { kind: "micro-pair"; views: [CardView, CardView] };

export function groupFeed(views: CardView[]): FeedNode[] {
  const out: FeedNode[] = [];
  for (let i = 0; i < views.length; i += 1) {
    const v = views[i]!;
    const next = views[i + 1];
    if (v.format === "micro" && next && next.format === "micro") {
      out.push({ kind: "micro-pair", views: [v, next] });
      i += 1;
    } else if (v.format === "micro") {
      // lone micro → promote to square so it doesn't look awkward
      out.push({ kind: "single", view: { ...v, format: "square" } });
    } else {
      out.push({ kind: "single", view: v });
    }
  }
  return out;
}
