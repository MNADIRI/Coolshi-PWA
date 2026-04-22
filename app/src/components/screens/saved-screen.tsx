"use client";

import { useState } from "react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import type { CardView } from "@/lib/card-format";
import { viewsFromRows } from "@/lib/card-format";
import { SkyProvider } from "@/components/sky/sky";
import { HeroCard, SquareCard, TextCard, WideCard } from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";

interface Props {
  saved: FeedCardRow[];
  useFixtures: boolean;
}

export function SavedScreen({ saved, useFixtures }: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);
  const [rows, setRows] = useState<FeedCardRow[]>(saved);
  const views = viewsFromRows(rows);
  const savedIds = new Set(rows.map((r) => r.id));

  const handleSavedChange = (cardId: string, isSaved: boolean) => {
    if (isSaved) return;
    setRows((prev) => prev.filter((r) => r.id !== cardId));
  };

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

        {views.length === 0 ? (
          <div className="mt-20 text-center">
            <div className="mx-auto mb-6 h-[40px] w-px bg-divider-strong" />
            <div className="mb-3 font-display text-[20px] font-medium tracking-[-0.03em] text-ink">
              Nothing saved yet.
            </div>
            <div className="mx-auto max-w-[280px] font-text text-[13px] leading-[1.5] text-ink-3">
              Open a card on the feed and tap Save to keep it here.
            </div>
          </div>
        ) : (
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
        )}
      </div>

      <ReadingModal
        view={modalView}
        savedIds={savedIds}
        useFixtures={useFixtures}
        onOpenChange={(o) => !o && setModalView(null)}
        onSavedChange={handleSavedChange}
      />
    </>
  );
}
