"use client";

import type { BriefRow, FeedCardRow } from "@/lib/supabase/database.types";
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
  savedIds: string[];
  useFixtures: boolean;
}

export function SpaShell({ feedRows, brief, library, savedCards, savedIds, useFixtures }: Props) {
  const idSet = new Set(savedIds);
  return (
    <TabShell tabs={TABS}>
      <FeedScreen rows={feedRows} savedIds={idSet} useFixtures={useFixtures} />
      <LibraryScreen sources={library} />
      <BriefScreen brief={brief} readOnly={useFixtures} />
      <SavedScreen saved={savedCards} useFixtures={useFixtures} />
    </TabShell>
  );
}
