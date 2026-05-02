import type { CardView } from "@/lib/card-format";

// One screen = one full-viewport panel in reading mode (immersive).
// Composition (per v3 spec):
//   1.        hero        (image or sky + kicker + title)
//   2.        synthesis   (prose intro)
//   3..N+2.   paragraph   (each long_form paragraph)
//   N+3.      divergence  (italic callout, optional)
//   last.     sources     (always last slide per spec point 4)
export type StoryScreen =
  | { kind: "hero" }
  | { kind: "synthesis" }
  | { kind: "paragraph"; text: string; index: number; total: number }
  | { kind: "divergence"; text: string }
  | { kind: "sources" };

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

  if (view.row.sources && view.row.sources.length > 0) {
    screens.push({ kind: "sources" });
  }

  return screens;
}
