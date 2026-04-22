"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import type { CardView } from "@/lib/card-format";
import { groupFeed, viewsFromRows } from "@/lib/card-format";
import { SkyProvider } from "@/components/sky/sky";
import { MusicPlayerCard } from "@/components/card/music-player";
import {
  HeroCard,
  LinkCard,
  MicroPair,
  SquareCard,
  TextCard,
  WideCard,
} from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";

interface Props {
  rows: FeedCardRow[];
  savedIds: Set<string>;
  useFixtures: boolean;
  onSavedChange: (row: FeedCardRow, saved: boolean) => void;
}

function todayHeader(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })
    .format(now)
    .replace(",", " ·");
}

function nextBriefLabel(): string {
  const h = new Date().getHours();
  if (h < 7) return "07:00";
  if (h < 12) return "12:00";
  return "07:00";
}

const MORNING_POOL = [
  "next batch at 1pm, go outside",
  "see you after lunch — the web will still be there",
  "that's your morning. touch grass.",
  "reading done. go make coffee for a human.",
];
const EVENING_POOL = [
  "next batch tomorrow morning, go hang out with humans",
  "that's the day. close the phone.",
  "the web will still be there tomorrow",
  "evening batch done. go cook something.",
];
const GENERIC_POOL = [
  "enough internet for today",
  "you are now fully briefed. log off.",
  "well read. go live.",
];

function slotFromBatch(batchId: string | null): "morning" | "evening" {
  // batch_id is YYYY-MM-DD-HH in UTC; morning cron = 05 UTC, afternoon = 11 UTC.
  // Anything before 10 UTC we treat as morning, else evening.
  if (!batchId) {
    return new Date().getUTCHours() < 10 ? "morning" : "evening";
  }
  const hh = parseInt(batchId.slice(-2), 10);
  return Number.isFinite(hh) && hh < 10 ? "morning" : "evening";
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function endMessage(batchId: string | null): string {
  const slot = slotFromBatch(batchId);
  const pool = [...(slot === "morning" ? MORNING_POOL : EVENING_POOL), ...GENERIC_POOL];
  const idx = stringHash(batchId ?? new Date().toISOString().slice(0, 13)) % pool.length;
  return pool[idx]!;
}

export function FeedScreen({ rows, savedIds, useFixtures, onSavedChange }: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);

  const views = useMemo(() => viewsFromRows(rows), [rows]);
  const grouped = useMemo(() => groupFeed(views), [views]);
  const headerDate = useMemo(todayHeader, []);
  const nextBrief = useMemo(nextBriefLabel, []);
  const endText = useMemo(() => endMessage(rows[0]?.batch_id ?? null), [rows]);

  const recordOpen = useCallback(
    (view: CardView) => {
      setModalView(view);
      if (useFixtures) return;
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: view.row.id, signal: "neutral", dwell_ms: null }),
        keepalive: true,
      }).catch(() => {
        // best effort
      });
    },
    [useFixtures],
  );

  return (
    <>
      <div className="px-[18px] pb-10">
        <div className="pb-8 pt-[18px] text-center">
          <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
            {headerDate}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState nextBrief={nextBrief} />
        ) : (
          <SkyProvider>
            <div className="flex flex-col gap-4">
              <MusicPlayerCard />
              {grouped.map((node, idx) => {
                if (node.kind === "micro-pair") {
                  return (
                    <MicroPair
                      key={`pair-${idx}`}
                      a={node.views[0]}
                      b={node.views[1]}
                      onOpen={recordOpen}
                    />
                  );
                }
                const v = node.view;
                const props = { view: v, onOpen: () => recordOpen(v) };
                switch (v.format) {
                  case "hero":
                    return <HeroCard key={v.row.id} {...props} />;
                  case "wide":
                    return <WideCard key={v.row.id} {...props} />;
                  case "wide-flip":
                    return <WideCard key={v.row.id} {...props} flip />;
                  case "square":
                    return <SquareCard key={v.row.id} {...props} />;
                  case "text":
                    return <TextCard key={v.row.id} {...props} />;
                  case "link":
                    return <LinkCard key={v.row.id} {...props} />;
                  default:
                    return <TextCard key={v.row.id} {...props} />;
                }
              })}
            </div>
          </SkyProvider>
        )}

        {rows.length > 0 && (
          <div className="mt-[60px] pb-10 pt-10 text-center">
            <div className="mx-auto mb-6 h-[40px] w-px bg-divider-strong" />
            <div className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.03em] text-ink [text-wrap:balance]">
              {endText}
            </div>
          </div>
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

function EmptyState({ nextBrief }: { nextBrief: string }) {
  return (
    <div className="mt-20 text-center">
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
