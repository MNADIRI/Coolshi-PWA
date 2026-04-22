"use client";

import { useState } from "react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import type { CardView } from "@/lib/card-format";
import { viewsFromRows } from "@/lib/card-format";
import type { PastelHue } from "@/components/sky/sky";
import { PastelArt } from "@/components/sky/sky";
import { Caption } from "@/components/card/primitives";
import { SkyProvider } from "@/components/sky/sky";
import { HeroCard, SquareCard, TextCard, WideCard } from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";

interface Collection {
  name: string;
  count: number;
  hue: PastelHue;
}

interface Props {
  recent: FeedCardRow[];
}

const COLLECTIONS: Collection[] = [
  { name: "To read later", count: 14, hue: "sage" },
  { name: "For the blog post", count: 7, hue: "rose" },
  { name: "Radiology refs", count: 23, hue: "sky" },
  { name: "Typography", count: 9, hue: "butter" },
];

export function SavedScreen({ recent }: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);
  const views = viewsFromRows(recent).slice(0, 6);

  return (
    <>
      <div className="px-5 pb-10">
        <div className="pb-[18px] pt-[18px] text-center">
          <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
            Saved
          </div>
        </div>
        <div className="mb-7 font-display text-[30px] font-medium tracking-[-0.035em] text-ink">
          Kept for later.
        </div>

        <Caption className="mb-[14px]">Collections</Caption>
        <div className="mb-8 grid grid-cols-2 gap-[14px]">
          {COLLECTIONS.map((col) => (
            <div
              key={col.name}
              className="overflow-hidden rounded-[18px] border border-divider bg-paper"
            >
              <PastelArt hue={col.hue} style={{ aspectRatio: "4/3" }} />
              <div className="px-[14px] pb-[14px] pt-3">
                <div className="mb-0.5 font-display text-[14px] font-medium tracking-[-0.015em] text-ink">
                  {col.name}
                </div>
                <div className="font-text text-[10.5px] text-ink-3">{col.count} items</div>
              </div>
            </div>
          ))}
        </div>

        {views.length > 0 && (
          <>
            <Caption className="mb-[14px]">Recently saved</Caption>
            <SkyProvider>
              <div className="flex flex-col gap-[14px]">
                {views.map((v) => {
                  const props = { view: v, onOpen: () => setModalView(v) };
                  switch (v.format) {
                    case "hero":
                      return <HeroCard key={v.row.id} {...props} />;
                    case "wide":
                    case "wide-flip":
                      return (
                        <WideCard
                          key={v.row.id}
                          {...props}
                          flip={v.format === "wide-flip"}
                        />
                      );
                    case "square":
                      return <SquareCard key={v.row.id} {...props} />;
                    default:
                      return <TextCard key={v.row.id} {...props} />;
                  }
                })}
              </div>
            </SkyProvider>
          </>
        )}
      </div>

      <ReadingModal view={modalView} onOpenChange={(o) => !o && setModalView(null)} />
    </>
  );
}
