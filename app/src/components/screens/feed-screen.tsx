"use client";

import { useCallback, useMemo, useState } from "react";
import type { BriefRow, FeedCardRow, ManualBatchJobRow } from "@/lib/supabase/database.types";
import type { BatchGroup } from "@/app/feed/page";
import { BatchTrigger } from "@/components/screens/batch-trigger";
import type { CardView } from "@/lib/card-format";
import { viewsFromRows } from "@/lib/card-format";
import { SkyProvider } from "@/components/sky/sky";
import { FeedItem } from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";
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

function slotFromBatch(batchId: string | null, tz: string): "morning" | "evening" {
  if (!batchId) {
    return new Date().getUTCHours() < 10 ? "morning" : "evening";
  }
  const date = batchDateFromId(batchId);
  if (!date) return "morning";
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(date),
    10,
  );
  return hour < 12 ? "morning" : "evening";
}

function batchDateFromId(batchId: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/.exec(batchId);
  if (!m) return null;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!));
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function endMessage(batchId: string | null, tz: string): string {
  const slot = slotFromBatch(batchId, tz);
  const pool = [...(slot === "morning" ? MORNING_POOL : EVENING_POOL), ...GENERIC_POOL];
  const idx = stringHash(batchId ?? new Date().toISOString().slice(0, 13)) % pool.length;
  return pool[idx]!;
}

function formatBatchSeparator(
  batchId: string,
  tz: string,
): { date: string; slot: "AM" | "PM" } | null {
  const date = batchDateFromId(batchId);
  if (!date) return null;
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(date),
    10,
  );
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(date);
  return { date: dateStr, slot: hour < 12 ? "AM" : "PM" };
}

export function FeedScreen({
  batches,
  brief,
  savedIds,
  useFixtures,
  onSavedChange,
  manualJob,
  reserveCount,
}: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  const tz = brief?.timezone ?? "Europe/Brussels";
  const currentBatch = batches[0] ?? null;
  const previousBatches = batches.slice(1);

  const currentViews = useMemo(
    () => viewsFromRows(currentBatch?.cards ?? []),
    [currentBatch],
  );
  const previousViewGroups = useMemo(
    () =>
      previousBatches.map((b) => ({
        batch_id: b.batch_id,
        views: viewsFromRows(b.cards),
        header: formatBatchSeparator(b.batch_id, tz),
      })),
    [previousBatches, tz],
  );

  const headerDate = useMemo(todayHeader, []);
  const nextBrief = useMemo(nextBriefLabel, []);
  const endText = useMemo(
    () => endMessage(currentBatch?.batch_id ?? null, tz),
    [currentBatch, tz],
  );

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

  const empty = !currentBatch || currentBatch.cards.length === 0;

  return (
    <>
      <div className="pb-10">
        <div className="px-5 pb-8 pt-[18px] text-center">
          <BatchTrigger
            initialJob={manualJob}
            initialReserveCount={reserveCount}
            headerDate={headerDate}
            useFixtures={useFixtures}
          />
        </div>

        {empty && manualJob?.status === "in_progress" ? (
          <CurationAnimation />
        ) : empty ? (
          <EmptyState nextBrief={nextBrief} />
        ) : (
          <SkyProvider>
            <div className="flex flex-col">
              {currentViews.map((v) => (
                <FeedItem key={v.row.id} view={v} onOpen={() => recordOpen(v)} />
              ))}
            </div>

            <div className="mt-4 px-5 pb-8 pt-10 text-center">
              <div className="mx-auto mb-6 h-[40px] w-px bg-divider-strong" />
              <div className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.03em] text-ink [text-wrap:balance]">
                {endText}
              </div>
            </div>

            {previousViewGroups.length > 0 && !showPrevious && (
              <div className="px-5 pb-10 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowPrevious(true)}
                  className="rounded-pill border border-divider-strong bg-transparent px-5 py-2.5 font-text text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2 transition-colors active:bg-ink active:text-canvas"
                >
                  I want to see previous batches
                </button>
              </div>
            )}

            {showPrevious &&
              previousViewGroups.map((g) => (
                <div key={g.batch_id} className="flex flex-col">
                  {g.header && (
                    <div className="px-5 pb-6 pt-4 text-center">
                      <div className="mx-auto mb-4 h-px w-10 bg-divider" />
                      <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-3">
                        previous batch of {g.header.date} — {g.header.slot}
                      </div>
                    </div>
                  )}
                  {g.views.map((v) => (
                    <FeedItem key={v.row.id} view={v} onOpen={() => recordOpen(v)} />
                  ))}
                </div>
              ))}
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

function EmptyState({ nextBrief }: { nextBrief: string }) {
  return (
    <div className="mt-20 px-5 text-center">
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
