"use client";

import { useState } from "react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import type { CardView } from "@/lib/card-format";
import { viewsFromRows } from "@/lib/card-format";
import { SkyProvider } from "@/components/sky/sky";
import { FeedItem } from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";

interface Props {
  saved: FeedCardRow[];
  savedIds: Set<string>;
  useFixtures: boolean;
  onSavedChange: (row: FeedCardRow, saved: boolean) => void;
}

export function SavedScreen({ saved, savedIds, useFixtures, onSavedChange }: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);
  const views = viewsFromRows(saved);

  return (
    <>
      <div className="pb-10">
        <div className="px-5 pb-[18px] pt-[18px] text-center">
          <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
            Saved
          </div>
        </div>
        <div className="mb-7 px-5 font-display text-[30px] font-medium tracking-[-0.035em] text-ink">
          Kept for later.
        </div>

        {views.length === 0 ? (
          <div className="mt-20 px-5 text-center">
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
            <div className="flex flex-col">
              {views.map((v) => (
                <FeedItem key={v.row.id} view={v} onOpen={() => setModalView(v)} />
              ))}
            </div>
          </SkyProvider>
        )}
      </div>

      <ReadingModal
        view={modalView}
        savedIds={savedIds}
        useFixtures={useFixtures}
        onOpenChange={(o) => !o && setModalView(null)}
        onSavedChange={onSavedChange}
      />
    </>
  );
}
