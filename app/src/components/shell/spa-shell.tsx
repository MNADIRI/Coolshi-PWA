"use client";

import { useCallback, useMemo, useState } from "react";
import type { BriefRow, FeedCardRow, ManualBatchJobRow } from "@/lib/supabase/database.types";
import { TabShell, type TabDef } from "@/components/shell/tab-pager";
import { FeedScreen } from "@/components/screens/feed-screen";
import {
  LibraryScreen,
  type LibrarySource,
} from "@/components/screens/library-screen";
import { BriefScreen } from "@/components/screens/brief-screen";
import { SavedScreen } from "@/components/screens/saved-screen";

const TABS: TabDef[] = [
  { id: "feed", label: "Feed" },
  { id: "library", label: "Library" },
  { id: "brief", label: "Brief" },
  { id: "saved", label: "Saved" },
];

interface Props {
  feedRows: FeedCardRow[];
  brief: BriefRow | null;
  library: LibrarySource[];
  savedCards: FeedCardRow[];
  manualJob: ManualBatchJobRow | null;
  useFixtures: boolean;
}

export function SpaShell({ feedRows, brief, library, savedCards, manualJob, useFixtures }: Props) {
  const [saved, setSaved] = useState<FeedCardRow[]>(savedCards);
  const savedIdSet = useMemo(() => new Set(saved.map((c) => c.id)), [saved]);

  const onSavedChange = useCallback(
    (row: FeedCardRow, isSaved: boolean) => {
      setSaved((prev) => {
        if (isSaved) {
          if (prev.some((r) => r.id === row.id)) return prev;
          return [row, ...prev];
        }
        return prev.filter((r) => r.id !== row.id);
      });
    },
    [],
  );

  return (
    <TabShell tabs={TABS}>
      <FeedScreen
        rows={feedRows}
        savedIds={savedIdSet}
        useFixtures={useFixtures}
        onSavedChange={onSavedChange}
        manualJob={manualJob}
      />
      <LibraryScreen sources={library} />
      <BriefScreen brief={brief} readOnly={useFixtures} />
      <SavedScreen
        saved={saved}
        savedIds={savedIdSet}
        useFixtures={useFixtures}
        onSavedChange={onSavedChange}
      />
    </TabShell>
  );
}
