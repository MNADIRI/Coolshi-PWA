"use client";

import {
  motion,
  useMotionValue,
  type PanInfo,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CardView } from "@/lib/card-format";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { FeedPreview } from "./feed-preview";
import { StoryItem } from "./story-item";

interface Props {
  views: CardView[];
  savedIds?: Set<string>;
  useFixtures?: boolean;
  onSavedChange?: (row: FeedCardRow, saved: boolean) => void;
  endCta?: { label: string; onActivate: () => void } | null;
}

const SWIPE_THRESHOLD_RATIO = 0.18;
const SWIPE_VELOCITY = 700;
const POSITION_BAR_HEIGHT = 120;
const POSITION_THUMB_HEIGHT = 18;

// Per v3 spec: two distinct modes.
// - "feed":    vertical snap between Instagram-style preview cards.
//              Position bar visible (left, centered).
//              Tap card → enter reading.
// - "reading": single full-bleed StoryItem with horizontal tap nav,
//              top progress segments + bottom action bar.
//              Vertical swipe = exit back to feed (item preserved).
export function StoryFeed({
  views,
  savedIds,
  useFixtures,
  onSavedChange,
  endCta,
}: Props) {
  const totalSlots = views.length + 1; // last slot = end-of-batch

  const [mode, setMode] = useState<"feed" | "reading">("feed");
  const [currentItem, setCurrentItem] = useState(0);
  const [paragraphIdx, setParagraphIdx] = useState<Record<string, number>>({});
  const [savedSet, setSavedSet] = useState<Set<string>>(
    () => new Set(savedIds ?? []),
  );
  const [savePending, setSavePending] = useState<Set<string>>(new Set());
  const [shareItemId, setShareItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      setCurrentItem((s) => {
        const next = s + delta;
        if (next < 0 || next > totalSlots - 1) return s;
        return next;
      });
    },
    [totalSlots],
  );

  const enterReading = (itemIdx: number) => {
    setCurrentItem(itemIdx);
    setMode("reading");
  };

  const exitReading = () => {
    setMode("feed");
  };

  // Vertical drag in FEED mode = snap between slots.
  const y = useMotionValue(0);
  const onFeedDragEnd = useCallback(
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

  const getParagraphIndex = (itemId: string) => paragraphIdx[itemId] ?? 0;
  const setItemParagraph = (itemId: string, idx: number) =>
    setParagraphIdx((m) => ({ ...m, [itemId]: idx }));

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

  // ----- READING MODE -----
  if (mode === "reading") {
    const view = views[currentItem];
    if (!view) {
      // safety: if currentItem somehow points past views, fall back to feed
      setMode("feed");
      return null;
    }
    return (
      <div className="relative h-full w-full overflow-hidden bg-canvas">
        <StoryItem
          view={view}
          saved={savedSet.has(view.row.id)}
          sharing={shareItemId === view.row.id}
          screenIndex={getParagraphIndex(view.row.id)}
          onScreenChange={(p) => setItemParagraph(view.row.id, p)}
          onExit={exitReading}
          onSave={() => void onSaveItem(view)}
          onShare={() => void onShareItem(view)}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  // ----- FEED MODE -----
  const positionFraction =
    totalSlots > 1 ? currentItem / (totalSlots - 1) : 0;
  const thumbTop = positionFraction * (POSITION_BAR_HEIGHT - POSITION_THUMB_HEIGHT);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-canvas"
    >
      <motion.div
        style={{ y }}
        drag="y"
        dragConstraints={{
          top: -((totalSlots - 1) * containerHeight),
          bottom: 0,
        }}
        dragElastic={0.18}
        onDragEnd={onFeedDragEnd}
        animate={{ y: -currentItem * containerHeight }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 36,
          mass: 0.85,
        }}
        className="flex h-full flex-col"
      >
        {views.map((view, i) => {
          const visible = Math.abs(i - currentItem) <= 1;
          return (
            <div
              key={view.row.id}
              className="w-full shrink-0"
              style={{ height: containerHeight || "100dvh" }}
            >
              {visible && (
                <FeedPreview view={view} onTap={() => enterReading(i)} />
              )}
            </div>
          );
        })}
        {/* End-of-batch slot */}
        <div
          className="w-full shrink-0"
          style={{ height: containerHeight || "100dvh" }}
        >
          {Math.abs(views.length - currentItem) <= 1 && (
            <EndOfBatch endCta={endCta} onPrev={() => moveSlot(-1)} />
          )}
        </div>
      </motion.div>

      {/* Position bar — only in feed mode, centered vertically on left */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 z-40 -translate-y-1/2"
        style={{ height: POSITION_BAR_HEIGHT }}
      >
        <div className="relative h-full w-[3px] rounded-full bg-ink/15">
          <div
            className="absolute left-0 w-full rounded-full bg-ink/70 transition-all duration-300"
            style={{ top: thumbTop, height: POSITION_THUMB_HEIGHT }}
          />
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+24px)] z-[60] -translate-x-1/2 rounded-pill border border-divider bg-paper/90 px-4 py-2 font-text text-[12px] text-ink shadow-md backdrop-blur-md"
    >
      {message}
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
      <div className="font-text text-[13px] text-ink-3">
        Swipe down for the previous article.
      </div>
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
