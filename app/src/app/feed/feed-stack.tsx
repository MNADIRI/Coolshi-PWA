"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo, type Variants } from "framer-motion";
import { Heart, SkipForward, X } from "lucide-react";
import { Card } from "@/components/card/card";
import { CardModal } from "@/components/card/card-modal";
import type { FeedCardRow, FeedbackSignal } from "@/lib/supabase/database.types";

interface Props {
  cards: FeedCardRow[];
  useFixtures: boolean;
  nextBriefAt: string;
}

const SWIPE_THRESHOLD = 100;
const EXIT_DISTANCE = 600;

type ExitDir = 1 | -1 | 0;

const topCardVariants: Variants = {
  enter: { opacity: 0, scale: 0.96 },
  center: { opacity: 1, scale: 1 },
  exit: (dir: ExitDir) => ({
    x: dir === 1 ? EXIT_DISTANCE : dir === -1 ? -EXIT_DISTANCE : 0,
    y: dir === 0 ? EXIT_DISTANCE : 0,
    rotate: dir === 1 ? 16 : dir === -1 ? -16 : 0,
    opacity: 0,
    transition: { duration: 0.3 },
  }),
};

export function FeedStack({ cards, useFixtures, nextBriefAt }: Props) {
  const [remaining, setRemaining] = useState(cards);
  const [modalCard, setModalCard] = useState<FeedCardRow | null>(null);
  const [exitDir, setExitDir] = useState<ExitDir>(0);
  const dwellStartRef = useRef<number>(performance.now());

  const top = remaining[0] ?? null;
  const behind = remaining.slice(1, 3);

  const recordFeedback = useCallback(
    async (cardId: string, signal: FeedbackSignal, dwellMs: number) => {
      if (useFixtures) return;
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cardId, signal, dwell_ms: dwellMs }),
          keepalive: true,
        });
      } catch {
        // silent — feedback is best-effort
      }
    },
    [useFixtures],
  );

  const dispatch = useCallback(
    (signal: FeedbackSignal) => {
      if (!top) return;
      const dwellMs = Math.round(performance.now() - dwellStartRef.current);
      void recordFeedback(top.id, signal, dwellMs);
      setExitDir(signal === "like" ? 1 : signal === "dislike" ? -1 : 0);
      setRemaining((r) => r.slice(1));
      dwellStartRef.current = performance.now();
      if ("vibrate" in navigator) navigator.vibrate(signal === "like" ? [8, 0, 8] : 12);
    },
    [top, recordFeedback],
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { x, y } = info.offset;
      if (x > SWIPE_THRESHOLD) dispatch("like");
      else if (x < -SWIPE_THRESHOLD) dispatch("dislike");
      else if (y > SWIPE_THRESHOLD) dispatch("skip");
    },
    [dispatch],
  );

  const emptyMessage = useMemo(
    () => `C'est tout pour ce briefing. Prochain à ${nextBriefAt}.`,
    [nextBriefAt],
  );

  if (!top) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center px-6 text-center">
        <p className="max-w-sm text-[17px] leading-relaxed text-text-secondary">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mx-auto w-full max-w-[440px] px-4">
        <div className="relative h-[560px]">
          <AnimatePresence mode="popLayout" custom={exitDir}>
            {behind
              .slice()
              .reverse()
              .map((card, idx) => {
                const depth = behind.length - idx;
                const scale = 1 - depth * 0.04;
                const yOffset = depth * 8;
                return (
                  <motion.div
                    key={card.id}
                    className="absolute inset-0"
                    initial={false}
                    animate={{ scale, y: yOffset, opacity: 1 }}
                    style={{ zIndex: 10 - depth }}
                  >
                    <Card card={card} />
                  </motion.div>
                );
              })}

            <motion.div
              key={top.id}
              className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragEnd={onDragEnd}
              onTap={(event) => {
                const target = event.target as HTMLElement | null;
                if (target && target.closest("a")) return;
                setModalCard(top);
              }}
              variants={topCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={exitDir}
              whileDrag={{ cursor: "grabbing" }}
              style={{ zIndex: 20 }}
            >
              <Card card={top} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Rejeter"
            onClick={() => dispatch("dislike")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-surface text-accent-dislike shadow ring-1 ring-divider transition hover:scale-105 active:scale-95"
          >
            <X size={24} />
          </button>
          <button
            type="button"
            aria-label="Passer"
            onClick={() => dispatch("skip")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-surface text-text-secondary shadow ring-1 ring-divider transition hover:scale-105 active:scale-95"
          >
            <SkipForward size={20} />
          </button>
          <button
            type="button"
            aria-label="Aimer"
            onClick={() => dispatch("like")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-like text-white shadow transition hover:scale-105 active:scale-95"
          >
            <Heart size={24} />
          </button>
        </div>

        <p className="mt-6 text-center text-[12px] text-text-secondary">
          {remaining.length} carte{remaining.length > 1 ? "s" : ""} restante
          {remaining.length > 1 ? "s" : ""}
        </p>
      </div>

      <CardModal
        card={modalCard}
        onOpenChange={(open) => {
          if (!open) setModalCard(null);
        }}
      />
    </>
  );
}
