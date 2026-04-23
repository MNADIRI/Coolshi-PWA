import type { FeedCardRow } from "@/lib/supabase/database.types";

export interface CardView {
  row: FeedCardRow;
  kicker: string;
  readTime: string;
  sourceNames: string[];
}

function kickerFor(row: FeedCardRow): string {
  const primary = row.tags?.[0] ?? (row.card_type === "deep_dive" ? "DEEP DIVE" : "BRIEF");
  return row.card_type === "deep_dive"
    ? `DEEP DIVE · ${primary.toUpperCase()}`
    : primary.toUpperCase();
}

function readTimeFor(row: FeedCardRow): string {
  const long = row.long_form?.trim() ?? "";
  const source = long.length > 0 ? long : row.synthesis;
  const words = Math.max(1, source.split(/\s+/).length);
  const readMin = Math.max(1, Math.round(words / 220));
  return `${readMin} min`;
}

export function toCardView(row: FeedCardRow): CardView {
  return {
    row,
    kicker: kickerFor(row),
    readTime: readTimeFor(row),
    sourceNames: row.sources.map((s) => s.name),
  };
}

export function viewsFromRows(rows: FeedCardRow[]): CardView[] {
  return rows.map(toCardView);
}
