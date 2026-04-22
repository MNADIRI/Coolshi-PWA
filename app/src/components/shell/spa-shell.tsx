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
  recentForSaved: FeedCardRow[];
  useFixtures: boolean;
}

export function SpaShell({ feedRows, brief, library, recentForSaved, useFixtures }: Props) {
  return (
    <TabShell tabs={TABS}>
      <FeedScreen rows={feedRows} useFixtures={useFixtures} />
      <LibraryScreen sources={library} />
      <BriefScreen brief={brief} readOnly={useFixtures} />
      <SavedScreen recent={recentForSaved} />
    </TabShell>
  );
}
