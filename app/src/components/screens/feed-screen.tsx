"use client";

import { useMemo, useState } from "react";
import type {
  BriefRow,
  FeedCardRow,
  ManualBatchJobRow,
} from "@/lib/supabase/database.types";
import type { BatchGroup } from "@/app/feed/page";
import { viewsFromRows } from "@/lib/card-format";
import { StoryFeed } from "@/components/feed/story-feed";
import { CurationAnimation } from "@/components/screens/curation-animation";

interface Props {
  batches: BatchGroup[];
  brief: BriefRow | null;
  savedIds: Set<string>;
  useFixtures: boolean;
  onSavedChange: (row: FeedCardRow, saved: boolean) => void;
  manualJob: ManualBatchJobRow | null;
  reserveCount: number;
}

function nextBriefLabel(): string {
  const h = new Date().getHours();
  if (h < 7) return "07:00";
  if (h < 12) return "12:00";
  return "07:00";
}

export function FeedScreen({
  batches,
  brief,
  savedIds,
  useFixtures,
  onSavedChange,
  manualJob,
}: Props) {
  void brief;
  const [showPrevious, setShowPrevious] = useState(false);
  const currentBatch = batches[0] ?? null;
  const previousBatches = batches.slice(1);

  const views = useMemo(() => {
    const cur = viewsFromRows(currentBatch?.cards ?? []);
    if (!showPrevious) return cur;
    const prev = previousBatches.flatMap((b) => viewsFromRows(b.cards));
    return [...cur, ...prev];
  }, [currentBatch, previousBatches, showPrevious]);

  const empty = !currentBatch || currentBatch.cards.length === 0;

  if (empty && manualJob?.status === "in_progress") {
    return <CurationAnimation />;
  }

  if (empty) {
    return <EmptyState nextBrief={nextBriefLabel()} />;
  }

  const endCta =
    previousBatches.length > 0 && !showPrevious
      ? {
          label: "voir les batchs précédents",
          onActivate: () => setShowPrevious(true),
        }
      : null;

  return (
    <StoryFeed
      views={views}
      savedIds={savedIds}
      useFixtures={useFixtures}
      onSavedChange={onSavedChange}
      endCta={endCta}
    />
  );
}

function EmptyState({ nextBrief }: { nextBrief: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
      <div className="mx-auto mb-8 h-[40px] w-px bg-divider-strong" />
      <div className="mb-3 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
        No briefing yet today.
      </div>
      <div className="font-text text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
        Next briefing · {nextBrief}
      </div>
    </div>
  );
}
