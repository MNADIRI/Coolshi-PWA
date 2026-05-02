"use client";

import type { FeedCardRow } from "@/lib/supabase/database.types";
import { viewsFromRows } from "@/lib/card-format";
import { StoryFeed } from "@/components/feed/story-feed";

interface Props {
  saved: FeedCardRow[];
  savedIds: Set<string>;
  useFixtures: boolean;
  onSavedChange: (row: FeedCardRow, saved: boolean) => void;
}

export function SavedScreen({
  saved,
  savedIds,
  useFixtures,
  onSavedChange,
}: Props) {
  if (saved.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-5 text-center safe-top safe-bottom">
        <div className="mx-auto mb-6 h-[40px] w-px bg-divider-strong" />
        <div className="mb-3 font-display text-[20px] font-medium tracking-[-0.03em] text-ink">
          Nothing saved yet.
        </div>
        <div className="mx-auto max-w-[280px] font-text text-[13px] leading-[1.5] text-ink-3">
          Tap Save while reading any card and it&apos;ll show up here.
        </div>
      </div>
    );
  }
  const views = viewsFromRows(saved);
  return (
    <StoryFeed
      views={views}
      savedIds={savedIds}
      useFixtures={useFixtures}
      onSavedChange={onSavedChange}
    />
  );
}
