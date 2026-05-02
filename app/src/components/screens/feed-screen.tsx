"use client";

import { motion } from "framer-motion";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BriefRow,
  FeedCardRow,
  ManualBatchJobRow,
} from "@/lib/supabase/database.types";
import type { BatchGroup } from "@/app/feed/page";
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

type Slot =
  | { kind: "card"; view: CardView }
  | { kind: "end" }
  | { kind: "previous-cta" };

function nextBriefLabel(): string {
  const h = new Date().getHours();
  if (h < 7) return "07:00";
  if (h < 12) return "12:00";
  return "07:00";
}

function batchDateFromId(batchId: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/.exec(batchId);
  if (!m) return null;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!));
}

function slotFromBatch(
  batchId: string | null,
  tz: string,
): "morning" | "evening" {
  if (!batchId) return new Date().getUTCHours() < 10 ? "morning" : "evening";
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

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function endMessage(batchId: string | null, tz: string): string {
  const slot = slotFromBatch(batchId, tz);
  const pool = [
    ...(slot === "morning" ? MORNING_POOL : EVENING_POOL),
    ...GENERIC_POOL,
  ];
  const idx =
    stringHash(batchId ?? new Date().toISOString().slice(0, 13)) % pool.length;
  return pool[idx]!;
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
  void reserveCount;
  const [showPrevious, setShowPrevious] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [modalView, setModalView] = useState<CardView | null>(null);

  const tz = brief?.timezone ?? "Europe/Brussels";
  const currentBatch = batches[0] ?? null;
  const previousBatches = batches.slice(1);

  const currentViews = useMemo(
    () => viewsFromRows(currentBatch?.cards ?? []),
    [currentBatch],
  );
  const previousViews = useMemo(
    () => previousBatches.flatMap((b) => viewsFromRows(b.cards)),
    [previousBatches],
  );

  // Slot list: current cards → end-message → (previous-cta if there are
  // more batches and they're not yet shown) → previous cards (when shown).
  // Activating the CTA simply flips showPrevious; the slot at the current
  // index becomes the first previous card without moving the cursor.
  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = currentViews.map((v) => ({ kind: "card", view: v }));
    if (out.length > 0) out.push({ kind: "end" });
    if (previousBatches.length > 0 && !showPrevious) {
      out.push({ kind: "previous-cta" });
    }
    if (showPrevious) {
      previousViews.forEach((v) => out.push({ kind: "card", view: v }));
    }
    return out;
  }, [currentViews, previousViews, previousBatches, showPrevious]);

  const lastIdx = slots.length - 1;
  const endText = useMemo(
    () => endMessage(currentBatch?.batch_id ?? null, tz),
    [currentBatch, tz],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const m = () => setWidth(el.offsetWidth);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clamp the cursor when the slot list shrinks (e.g. activating
  // showPrevious removes the CTA slot).
  useLayoutEffect(() => {
    if (slots.length === 0) return;
    if (currentIdx > slots.length - 1) setCurrentIdx(slots.length - 1);
  }, [slots.length, currentIdx]);

  const recordOpen = useCallback(
    (view: CardView) => {
      setModalView(view);
      if (useFixtures) return;
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: view.row.id,
          signal: "neutral",
          dwell_ms: null,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [useFixtures],
  );

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () => {
    const slot = slots[currentIdx];
    // Tap-right on the CTA: reveal previous batches in place — the slot
    // that used to be the CTA becomes the first previous card.
    if (slot?.kind === "previous-cta") {
      setShowPrevious(true);
      return;
    }
    setCurrentIdx((i) => Math.min(lastIdx, i + 1));
  };
  const onTapCenter = () => {
    const slot = slots[currentIdx];
    if (slot?.kind === "card") recordOpen(slot.view);
    else if (slot?.kind === "previous-cta") setShowPrevious(true);
    // end slot: no-op
  };

  // Empty states (no current batch yet) — bypass the slider entirely.
  const empty = !currentBatch || currentBatch.cards.length === 0;
  if (empty && manualJob?.status === "in_progress") {
    return <CurationAnimation />;
  }
  if (empty) {
    return <EmptyState nextBrief={nextBriefLabel()} />;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-canvas"
      >
        {/* Top: progress segments — sit just under the global tab bar.
            Pointer-events:none so taps fall through to the nav buttons. */}
        {slots.length > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-2 z-30 flex gap-[3px] px-3"
          >
            {slots.map((_, i) => (
              <div
                key={i}
                className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-ink/15"
              >
                <div
                  className="h-full bg-ink transition-all duration-200"
                  style={{ width: i <= currentIdx ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Slider strip */}
        <motion.div
          className="flex h-full"
          animate={{ x: -currentIdx * width }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 36,
            mass: 0.85,
          }}
        >
          {slots.map((slot, i) => {
            const visible = Math.abs(i - currentIdx) <= 1;
            return (
              <div
                key={`${i}-${slot.kind === "card" ? slot.view.row.id : slot.kind}`}
                className="h-full shrink-0 overflow-y-auto"
                style={{ width: width || "100%" }}
              >
                {visible && (
                  <SkyProvider className="block min-h-full">
                    <SlotView slot={slot} endText={endText} />
                  </SkyProvider>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Tap zones — left 25% prev, center 50% open/cta, right 25% next.
            On top of the slider so the underlying card's onClick (which
            we wired to a no-op anyway) doesn't compete. */}
        <div className="absolute inset-0 z-20 flex">
          <button
            type="button"
            aria-label="Previous"
            disabled={currentIdx === 0}
            onClick={goPrev}
            className="h-full w-1/4 focus:outline-none disabled:cursor-default"
          />
          <button
            type="button"
            aria-label="Open article"
            onClick={onTapCenter}
            className="h-full w-1/2 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Next"
            disabled={currentIdx === lastIdx}
            onClick={goNext}
            className="h-full w-1/4 focus:outline-none disabled:cursor-default"
          />
        </div>
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

function SlotView({ slot, endText }: { slot: Slot; endText: string }) {
  if (slot.kind === "card") {
    return (
      <div className="flex min-h-full items-center justify-center px-2 pt-8">
        <div className="w-full max-w-[480px]">
          <FeedItem view={slot.view} onOpen={() => {}} />
        </div>
      </div>
    );
  }
  if (slot.kind === "end") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 h-[40px] w-px bg-divider-strong" />
        <div className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.03em] text-ink [text-wrap:balance]">
          {endText}
        </div>
      </div>
    );
  }
  // previous-cta — visual-only button. Activation is wired through the
  // center tap zone (which catches the click first because of z-order).
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 h-[40px] w-px bg-divider-strong" />
      <div className="rounded-pill border border-divider-strong bg-transparent px-5 py-2.5 font-text text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">
        afficher les batchs précédents
      </div>
    </div>
  );
}

function EmptyState({ nextBrief }: { nextBrief: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5 text-center">
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
