"use client";

import type { CardView } from "@/lib/card-format";
import { HeroMedia } from "./hero-media";
import { Caption, Sources } from "./primitives";

interface Props {
  view: CardView;
  onOpen: () => void;
}

export function FeedItem({ view, onOpen }: Props) {
  return (
    <article
      onClick={onOpen}
      className="cursor-pointer select-none"
    >
      <HeroMedia
        imageUrl={view.row.hero_image_url}
        title={view.row.title}
        kicker={view.kicker}
        style={{ aspectRatio: "4/5" }}
      />
      <div className="px-5 pb-12 pt-5">
        <p className="font-text text-[15px] leading-[1.6] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
        {view.sourceNames.length > 0 && (
          <div className="mt-4">
            <Sources items={view.sourceNames} readTime={view.readTime} />
          </div>
        )}
      </div>
    </article>
  );
}

// Compat re-exports so nothing outside the feed breaks while we converge.
export { Caption };
