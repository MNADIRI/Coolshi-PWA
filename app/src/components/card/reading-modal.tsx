"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, useDragControls, useMotionValue, type PanInfo } from "framer-motion";
import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CardView } from "@/lib/card-format";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { ParagraphReader } from "./paragraph-reader";

interface Props {
  view: CardView | null;
  savedIds?: Set<string>;
  useFixtures?: boolean;
  onOpenChange: (open: boolean) => void;
  onSavedChange?: (row: FeedCardRow, saved: boolean) => void;
}

export function ReadingModal({
  view,
  savedIds,
  useFixtures,
  onOpenChange,
  onSavedChange,
}: Props) {
  const initial = view ? savedIds?.has(view.row.id) ?? false : false;
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setSaved(view ? savedIds?.has(view.row.id) ?? false : false);
  }, [view, savedIds]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const toggleSaved = async () => {
    if (!view || pending) return;
    const row = view.row;
    const next = !saved;
    setSaved(next);
    onSavedChange?.(row, next);
    if (useFixtures) return;
    setPending(true);
    try {
      if (next) {
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: row.id }),
        });
      } else {
        await fetch(`/api/save?card_id=${encodeURIComponent(row.id)}`, {
          method: "DELETE",
        });
      }
    } catch {
      setSaved(!next);
      onSavedChange?.(row, !next);
    } finally {
      setPending(false);
    }
  };

  const onShare = async () => {
    if (!view || sharing) return;
    setSharing(true);
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
        // Desktop / unsupported browser: download PNG + copy URL.
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
      // AbortError = user cancelled the native share sheet → silent.
      if ((err as Error).name !== "AbortError") {
        console.error("share failed:", err);
        showToast("Share failed — try again");
      }
    } finally {
      setSharing(false);
    }
  };

  const y = useMotionValue(0);
  const dragControls = useDragControls();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 800) {
      onOpenChange(false);
    } else {
      y.set(0);
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  return (
    <Dialog.Root
      open={view !== null}
      onOpenChange={(open) => {
        if (!open) y.set(0);
        onOpenChange(open);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] [animation:cs-fade-in_220ms_cubic-bezier(0.22,1,0.36,1)]" />
        <Dialog.Content asChild aria-describedby={undefined}>
          <motion.div
            style={{ y, willChange: "transform", WebkitBackfaceVisibility: "hidden" }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={onDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 360, mass: 0.85 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[93dvh] flex-col overflow-hidden rounded-t-[24px] bg-canvas shadow-[0_-20px_60px_rgba(0,0,0,0.18)] focus:outline-none safe-bottom [contain:layout_paint]"
          >
            {view && (
              <ModalBody
                view={view}
                saved={saved}
                sharing={sharing}
                onToggleSaved={toggleSaved}
                onShare={onShare}
                onHeaderPointerDown={startDrag}
              />
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+24px)] z-[60] -translate-x-1/2 rounded-pill border border-divider bg-paper/90 px-4 py-2 font-text text-[12px] text-ink shadow-md backdrop-blur-md"
        >
          {toast}
        </div>
      )}
    </Dialog.Root>
  );
}

function ModalBody({
  view,
  saved,
  sharing,
  onToggleSaved,
  onShare,
  onHeaderPointerDown,
}: {
  view: CardView;
  saved: boolean;
  sharing: boolean;
  onToggleSaved: () => void;
  onShare: () => void;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <>
      <div
        onPointerDown={onHeaderPointerDown}
        className="relative flex h-6 shrink-0 items-center justify-center [touch-action:none] cursor-grab active:cursor-grabbing"
        aria-label="Drag down to close"
        role="button"
      >
        <div
          aria-hidden
          className="h-[4px] w-[38px] rounded-[2px] bg-divider-strong"
        />
      </div>
      <div className="flex items-center justify-between px-5 pb-1.5 pt-0.5">
        <button
          type="button"
          onClick={onToggleSaved}
          className={`rounded-pill border border-divider-strong px-[14px] py-1.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            saved ? "bg-ink text-canvas" : "bg-transparent text-ink"
          }`}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            disabled={sharing}
            aria-label="Share this card"
            className="flex items-center gap-1.5 rounded-pill border border-divider-strong bg-transparent px-[14px] py-1.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink transition-opacity disabled:opacity-50"
          >
            {sharing ? (
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              />
            ) : (
              <Share2 aria-hidden className="h-3.5 w-3.5" />
            )}
            Share
          </button>
          <Dialog.Close className="rounded-pill border border-divider-strong bg-transparent px-[14px] py-1.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink">
            Close
          </Dialog.Close>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-6 pb-6 pt-3">
        <Dialog.Title asChild>
          <span className="sr-only">{view.row.title}</span>
        </Dialog.Title>
        <ParagraphReader view={view} />
      </div>
    </>
  );
}
