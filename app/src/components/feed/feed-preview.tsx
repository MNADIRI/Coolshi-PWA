"use client";

import type { CardView } from "@/lib/card-format";
import { HeroMedia } from "@/components/card/hero-media";

interface Props {
  view: CardView;
  onTap: () => void;
}

// Per v3 spec point 2: Instagram-post style preview card.
// - Image NOT full-viewport: ~55% of card height
// - Below: kicker, title, synthesis preview, source · read time
// - Whole card is tappable → enters reading mode
// - No action overlays, no progress segments — those belong to reading mode
export function FeedPreview({ view, onTap }: Props) {
  const sourceLabel = view.sourceNames[0] ?? "";
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Open ${view.row.title}`}
      className="flex h-full w-full flex-col bg-canvas text-left focus:outline-none"
    >
      {/* Hero — fixed proportion of card. The HeroMedia overlays kicker
          + title onto the image / sky scrim. */}
      <div className="relative w-full" style={{ flex: "0 0 56%" }}>
        <HeroMedia
          imageUrl={view.row.hero_image_url}
          title={view.row.title}
          kicker={view.kicker}
          className="h-full w-full"
        />
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-7 pt-6">
        <p className="font-text text-[15.5px] leading-[1.55] text-ink-2 line-clamp-6 [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
        <div className="mt-auto pt-5 font-text text-[11px] font-medium tracking-[0.04em] text-ink-3">
          {sourceLabel}
          {sourceLabel && view.readTime ? "  ·  " : ""}
          {view.readTime}
        </div>
      </div>
    </button>
  );
}
