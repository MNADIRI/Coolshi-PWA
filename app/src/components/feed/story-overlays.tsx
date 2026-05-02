"use client";

import { Bookmark, Share2 } from "lucide-react";

interface Props {
  totalScreens: number;
  currentScreen: number;
  saved: boolean;
  sharing: boolean;
  onSave: () => void;
  onShare: () => void;
  // Hero screen has a dark scrim → use light overlays. Text screens are
  // light canvas → dark overlays.
  contrast: "light" | "dark";
}

// Per v3 spec: only used in reading mode. Top progress segments must not
// overlap the global tab bar (Feed/Brief/Saved) — offset by tab-bar height
// + breathing room. Bottom action bar = Save + Share only (no Source —
// that's now a dedicated last slide).
const TAB_BAR_OFFSET = 90; // px below safe-area-inset-top

export function StoryOverlays({
  totalScreens,
  currentScreen,
  saved,
  sharing,
  onSave,
  onShare,
  contrast,
}: Props) {
  const isLight = contrast === "light";
  const segActive = isLight ? "bg-white/95" : "bg-ink";
  const segIdle = isLight ? "bg-white/30" : "bg-ink/20";
  const buttonTone = isLight ? "text-white/90" : "text-ink";
  const barBg = isLight
    ? "border-white/10 bg-black/20 backdrop-blur-md"
    : "border-divider bg-canvas/85 backdrop-blur-md";

  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute inset-0 z-30"
    >
      {/* Top: segments (offset below the global tab bar) */}
      <div
        className="absolute inset-x-0 px-3"
        style={{ top: `calc(env(safe-area-inset-top) + ${TAB_BAR_OFFSET}px)` }}
      >
        <div className="flex gap-[3px]">
          {Array.from({ length: totalScreens }).map((_, i) => (
            <div
              key={i}
              className={`h-[2.5px] flex-1 overflow-hidden rounded-full ${segIdle}`}
            >
              <div
                className={`h-full transition-all duration-200 ${segActive}`}
                style={{
                  width:
                    i < currentScreen
                      ? "100%"
                      : i === currentScreen
                        ? "100%"
                        : "0%",
                }}
              />
            </div>
          ))}
        </div>
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
        </div>
      </div>
    </div>
  );
}
