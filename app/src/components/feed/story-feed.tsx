"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  motion,
  useDragControls,
  useMotionValue,
  type PanInfo,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CardView } from "@/lib/card-format";
import { hostnameOf } from "@/lib/url";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { StoryItem } from "./story-item";

interface Props {
  views: CardView[];
  savedIds?: Set<string>;
  useFixtures?: boolean;
  onSavedChange?: (row: FeedCardRow, saved: boolean) => void;
  // Optional CTA shown after the user advances past the last item's last
  // paragraph (e.g. "show previous batches").
  endCta?: { label: string; onActivate: () => void } | null;
}

const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY = 700;

export function StoryFeed({
  views,
  savedIds,
  useFixtures,
  onSavedChange,
  endCta,
}: Props) {
  // Slot 0..views.length-1 = items. Slot views.length = end-of-batch screen.
  const totalSlots = views.length + 1;

  const [currentSlot, setCurrentSlot] = useState(0);
  const [paragraphIndex, setParagraphIndex] = useState<Record<string, number>>(
    {},
  );
  const [savedSet, setSavedSet] = useState<Set<string>>(
    () => new Set(savedIds ?? []),
  );
  const [savePending, setSavePending] = useState<Set<string>>(new Set());
  const [shareItemId, setShareItemId] = useState<string | null>(null);
  const [sourcesItem, setSourcesItem] = useState<CardView | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Sync savedSet when prop changes (e.g. server fetch updates).
  useEffect(() => {
    setSavedSet(new Set(savedIds ?? []));
  }, [savedIds]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const moveSlot = useCallback(
    (delta: 1 | -1) => {
      setCurrentSlot((s) => {
        const next = s + delta;
        if (next < 0) return s;
        if (next > totalSlots - 1) return s;
        return next;
      });
    },
    [totalSlots],
  );

  // y-axis drag for inter-item navigation. Always active per spec.
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const o = info.offset.y;
      const v = info.velocity.y;
      const threshold = containerHeight * SWIPE_THRESHOLD_RATIO;
      if (o < -threshold || v < -SWIPE_VELOCITY) moveSlot(1);
      else if (o > threshold || v > SWIPE_VELOCITY) moveSlot(-1);
      y.set(0);
    },
    [containerHeight, moveSlot, y],
  );

  // Per-item paragraph index getter / setter.
  const getParagraphIndex = (itemId: string) => paragraphIndex[itemId] ?? 0;
  const setItemParagraph = (itemId: string, idx: number) =>
    setParagraphIndex((m) => ({ ...m, [itemId]: idx }));

  // Save action — same flow as the old reading modal.
  const onSaveItem = async (view: CardView) => {
    const id = view.row.id;
    if (savePending.has(id)) return;
    const wasSaved = savedSet.has(id);
    const next = !wasSaved;

    setSavedSet((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
    onSavedChange?.(view.row, next);
    if (useFixtures) return;

    setSavePending((prev) => {
      const out = new Set(prev);
      out.add(id);
      return out;
    });
    try {
      if (next) {
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: id }),
        });
      } else {
        await fetch(`/api/save?card_id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      }
    } catch {
      setSavedSet((prev) => {
        const out = new Set(prev);
        if (wasSaved) out.add(id);
        else out.delete(id);
        return out;
      });
      onSavedChange?.(view.row, wasSaved);
    } finally {
      setSavePending((prev) => {
        const out = new Set(prev);
        out.delete(id);
        return out;
      });
    }
  };

  // Share action — fetches the OG story PNG and uses Web Share API on
  // mobile, falls back to download + clipboard on desktop.
  const onShareItem = async (view: CardView) => {
    const id = view.row.id;
    if (shareItemId) return;
    setShareItemId(id);
    const slug = view.row.public_slug;
    const publicUrl = `${window.location.origin}/c/${slug}`;
    const ogUrl = `/api/og/card/${slug}?format=story`;
    try {
      const res = await fetch(ogUrl);
      if (!res.ok) throw new Error(`OG fetch failed: ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `coolshi-${slug}.png`, {
        type: "image/png",
      });
      const canShareFiles =
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          url: publicUrl,
          text: view.row.title,
        });
      } else {
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `coolshi-${slug}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
        try {
          await navigator.clipboard.writeText(publicUrl);
          showToast("Image saved · link copied");
        } catch {
          showToast("Image saved");
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("share failed:", err);
        showToast("Share failed — try again");
      }
    } finally {
      setShareItemId(null);
    }
  };

  // Position bar (left) — proportional progress through the batch.
  const positionPct = useMemo(() => {
    if (totalSlots <= 1) return 100;
    return Math.min(100, ((currentSlot + 1) / totalSlots) * 100);
  }, [currentSlot, totalSlots]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-canvas"
    >
      <motion.div
        style={{ y }}
        drag="y"
        dragControls={dragControls}
        dragListener={true}
        dragConstraints={{
          top: -((totalSlots - 1) * containerHeight),
          bottom: 0,
        }}
        dragElastic={0.18}
        onDragEnd={onDragEnd}
        animate={{ y: -currentSlot * containerHeight }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 36,
          mass: 0.85,
        }}
        className="flex h-full flex-col"
      >
        {views.map((view, i) => {
          // Render only current ± 1 for perf. Distant slots stay as empty
          // placeholders so the layout stack height stays correct.
          const visible = Math.abs(i - currentSlot) <= 1;
          return (
            <div
              key={view.row.id}
              className="w-full shrink-0"
              style={{ height: containerHeight || "100dvh" }}
            >
              {visible && (
                <StoryItem
                  view={view}
                  active={i === currentSlot}
                  saved={savedSet.has(view.row.id)}
                  sharing={shareItemId === view.row.id}
                  screenIndex={getParagraphIndex(view.row.id)}
                  onScreenChange={(next) => setItemParagraph(view.row.id, next)}
                  onAdvanceItem={() => moveSlot(1)}
                  onPrevItem={() => moveSlot(-1)}
                  onSave={() => void onSaveItem(view)}
                  onShare={() => void onShareItem(view)}
                  onSources={() => setSourcesItem(view)}
                />
              )}
            </div>
          );
        })}
        {/* End-of-batch slot */}
        <div
          className="w-full shrink-0"
          style={{ height: containerHeight || "100dvh" }}
        >
          {Math.abs(views.length - currentSlot) <= 1 && (
            <EndOfBatch endCta={endCta} onPrev={() => moveSlot(-1)} />
          )}
        </div>
      </motion.div>

      {/* Left position bar — transparent, passive */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-40 w-[3px]"
      >
        <div className="relative h-full w-full bg-ink/[0.08]">
          <div
            className="absolute left-0 top-0 w-full bg-ink/55 transition-all duration-300"
            style={{ height: `${positionPct}%` }}
          />
        </div>
      </div>

      {/* Sources sheet */}
      <Dialog.Root
        open={sourcesItem !== null}
        onOpenChange={(o) => !o && setSourcesItem(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content
            asChild
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-hidden rounded-t-[24px] bg-canvas shadow-[0_-20px_60px_rgba(0,0,0,0.18)] safe-bottom"
          >
            <div>
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <div className="font-text text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
                  Sources
                </div>
                <Dialog.Close className="rounded-pill border border-divider-strong px-3 py-1 font-text text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
                  Close
                </Dialog.Close>
              </div>
              <Dialog.Title asChild>
                <span className="sr-only">Sources for {sourcesItem?.row.title}</span>
              </Dialog.Title>
              <div className="max-h-[64dvh] overflow-y-auto px-5 pb-6">
                {sourcesItem?.row.sources.map((source) => {
                  const host = hostnameOf(source.url);
                  return (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 border-t border-divider py-[14px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[14px] font-medium tracking-[-0.015em] text-ink">
                          {source.name}
                        </div>
                        <div className="truncate font-text text-[11px] text-ink-3">
                          {host || source.url}
                        </div>
                      </div>
                      <div className="text-ink-3">↗</div>
                    </a>
                  );
                })}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+24px)] z-[60] -translate-x-1/2 rounded-pill border border-divider bg-paper/90 px-4 py-2 font-text text-[12px] text-ink shadow-md backdrop-blur-md"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function EndOfBatch({
  endCta,
  onPrev,
}: {
  endCta: Props["endCta"];
  onPrev: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center safe-top safe-bottom">
      <div className="h-[2px] w-10 bg-ink/30" />
      <div className="font-display text-[24px] font-medium leading-[1.2] tracking-[-0.025em] text-ink [text-wrap:balance]">
        That&apos;s the batch.
      </div>
      <div className="font-text text-[13px] text-ink-3">Swipe up for the previous article.</div>
      {endCta && (
        <button
          type="button"
          onClick={endCta.onActivate}
          className="rounded-pill border border-divider-strong bg-transparent px-5 py-2.5 font-text text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2 transition-colors active:bg-ink active:text-canvas"
        >
          {endCta.label}
        </button>
      )}
      <button
        type="button"
        onClick={onPrev}
        className="font-text text-[12px] text-ink-3 underline-offset-4 hover:underline"
      >
        ← back to last article
      </button>
    </div>
  );
}
