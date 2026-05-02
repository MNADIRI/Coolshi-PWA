import type { CardView } from "@/lib/card-format";

// One screen = one full-viewport panel inside a story-style item.
// Composition (per spec):
//   1. hero          (image or sky + kicker + title)
//   2. synthesis     (prose intro)
//   3..N+2. paragraph (each long_form paragraph)
//   last (optional). divergence (italic callout)
//
// Sources are NOT a screen — they're behind the bottom-bar Source button.
export type StoryScreen =
  | { kind: "hero" }
  | { kind: "synthesis" }
  | { kind: "paragraph"; text: string; index: number; total: number }
  | { kind: "divergence"; text: string };

export function splitCardIntoScreens(view: CardView): StoryScreen[] {
  const screens: StoryScreen[] = [{ kind: "hero" }];

  if (view.row.synthesis?.trim()) {
    screens.push({ kind: "synthesis" });
  }

  const long = view.row.long_form?.trim();
  if (long) {
    const paragraphs = long
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.forEach((text, index) => {
      screens.push({ kind: "paragraph", text, index, total: paragraphs.length });
    });
  }

  const div = view.row.divergence_notes?.trim();
  if (div) {
    screens.push({ kind: "divergence", text: div });
  }

  return screens;
}
