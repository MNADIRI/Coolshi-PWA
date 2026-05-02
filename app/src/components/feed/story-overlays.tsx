"use client";

import { Bookmark, ExternalLink, Share2 } from "lucide-react";
import type { CardView } from "@/lib/card-format";

interface Props {
  view: CardView;
  totalScreens: number;
  currentScreen: number;
  visible: boolean;
  saved: boolean;
  sharing: boolean;
  onSave: () => void;
  onShare: () => void;
  onSources: () => void;
  // Hero screen has a dark scrim → use light overlays. Text screens are
  // light canvas → use dark overlays. The kind drives the colour palette.
  contrast: "light" | "dark";
}

// Top progress segments + bottom action bar. Auto-hidden by parent via
// `visible`; pointer events are off while hidden so taps fall through to
// the navigation zones.
export function StoryOverlays({
  view,
  totalScreens,
  currentScreen,
  visible,
  saved,
  sharing,
  onSave,
  onShare,
  onSources,
  contrast,
}: Props) {
  const isLight = contrast === "light";
  const segActive = isLight ? "bg-white/95" : "bg-ink";
  const segIdle = isLight ? "bg-white/30" : "bg-ink/20";
  const metaTone = isLight ? "text-white/85" : "text-ink-3";
  const buttonTone = isLight ? "text-white/90" : "text-ink";
  const barBg = isLight
    ? "border-white/10 bg-black/20 backdrop-blur-md"
    : "border-divider bg-canvas/85 backdrop-blur-md";

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-30 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Top: segments + kicker */}
      <div className="absolute inset-x-0 top-0 px-3 pt-3 safe-top">
        <div className="flex gap-[3px]">
          {Array.from({ length: totalScreens }).map((_, i) => (
            <div
              key={i}
              className={`h-[2.5px] flex-1 overflow-hidden rounded-full ${segIdle}`}
            >
              <div
                className={`h-full transition-all duration-200 ${segActive}`}
                style={{ width: i < currentScreen ? "100%" : i === currentScreen ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>
        {view.kicker && (
          <div
            className={`mt-2.5 font-text text-[10px] font-semibold uppercase tracking-[0.2em] ${metaTone}`}
          >
            {view.kicker}
          </div>
        )}
      </div>

      {/* Bottom: action bar (its own pointer events) */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 safe-bottom">
        <div
          className={`flex items-center justify-around border-t px-6 py-3.5 ${barBg}`}
        >
          <button
            type="button"
            onClick={onSave}
            aria-label={saved ? "Saved" : "Save"}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-white/10 ${buttonTone}`}
          >
            <Bookmark
              aria-hidden
              className="h-5 w-5"
              fill={saved ? "currentColor" : "none"}
            />
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={sharing}
            aria-label="Share this card"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-white/10 disabled:opacity-50 ${buttonTone}`}
          >
            {sharing ? (
              <span className="block h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <Share2 aria-hidden className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={onSources}
            aria-label="Open sources"
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-white/10 ${buttonTone}`}
          >
            <ExternalLink aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
