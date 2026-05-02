"use client";

import { motion, type PanInfo } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import type { CardView } from "@/lib/card-format";
import { hostnameOf } from "@/lib/url";
import { splitCardIntoScreens, type StoryScreen } from "@/lib/story-screens";
import { HeroMedia } from "@/components/card/hero-media";
import { StoryOverlays } from "./story-overlays";

interface Props {
  view: CardView;
  saved: boolean;
  sharing: boolean;
  screenIndex: number;
  onScreenChange: (next: number) => void;
  onExit: () => void; // vertical swipe → back to feed mode
  onSave: () => void;
  onShare: () => void;
}

const TAP_BAR_HEIGHT = 64; // px reserved for the action bar
const EXIT_OFFSET_RATIO = 0.14;
const EXIT_VELOCITY = 600;

// Reading-mode view of one card. Per v3 spec:
//   - Horizontal tap nav between screens (clamped at boundaries)
//   - Vertical swipe = exit to feed mode (item preserved)
//   - Top progress segments + bottom action bar always visible (per spec
//     point 3 — these are reading-mode-only, no auto-hide)
//   - Sources rendered on the dedicated last screen (per spec point 4)
export function StoryItem({
  view,
  saved,
  sharing,
  screenIndex,
  onScreenChange,
  onExit,
  onSave,
  onShare,
}: Props) {
  const screens = splitCardIntoScreens(view);
  const lastIndex = screens.length - 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onTapLeft = () => {
    if (screenIndex > 0) onScreenChange(screenIndex - 1);
    // else clamped — vertical swipe is the exit
  };
  const onTapRight = () => {
    if (screenIndex < lastIndex) onScreenChange(screenIndex + 1);
    // else clamped
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const o = info.offset.y;
    const v = info.velocity.y;
    const threshold = window.innerHeight * EXIT_OFFSET_RATIO;
    if (Math.abs(o) > threshold || Math.abs(v) > EXIT_VELOCITY) {
      onExit();
    }
  };

  const currentScreen = screens[screenIndex] ?? screens[0]!;
  const contrast = currentScreen.kind === "hero" ? "light" : "dark";

  return (
    <motion.div
      ref={containerRef}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.4}
      onDragEnd={onDragEnd}
      className="relative h-full w-full overflow-hidden bg-canvas"
    >
      {/* Sliding strip of screens. */}
      <motion.div
        className="flex h-full"
        animate={{ x: -screenIndex * containerWidth }}
        transition={{
          type: "spring",
          stiffness: 360,
          damping: 36,
          mass: 0.7,
        }}
      >
        {screens.map((screen, i) => (
          <div
            key={i}
            className="h-full w-full shrink-0"
            style={{ width: containerWidth || "100%" }}
          >
            <ScreenView screen={screen} view={view} />
          </div>
        ))}
      </motion.div>

      {/* Tap zones. Reserve top space for the global tab bar AND the
          progress segments, and bottom space for the action bar. */}
      <div
        className="absolute inset-x-0 z-20 flex"
        style={{
          top: `calc(env(safe-area-inset-top) + 110px)`,
          bottom: `calc(${TAP_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        }}
      >
        <button
          type="button"
          aria-label="Previous"
          className="h-full w-1/2 focus:outline-none"
          onClick={onTapLeft}
        />
        <button
          type="button"
          aria-label="Next"
          className="h-full w-1/2 focus:outline-none"
          onClick={onTapRight}
        />
      </div>

      <StoryOverlays
        totalScreens={screens.length}
        currentScreen={screenIndex}
        saved={saved}
        sharing={sharing}
        contrast={contrast}
        onSave={onSave}
        onShare={onShare}
      />
    </motion.div>
  );
}

function ScreenView({ screen, view }: { screen: StoryScreen; view: CardView }) {
  if (screen.kind === "hero") {
    return (
      <div className="relative h-full w-full">
        <HeroMedia
          imageUrl={view.row.hero_image_url}
          title={view.row.title}
          kicker={view.kicker}
          className="h-full w-full"
        />
      </div>
    );
  }
  if (screen.kind === "synthesis") {
    return (
      <div className="flex h-full w-full items-center justify-center px-7 py-32">
        <p className="font-display text-[26px] font-medium leading-[1.25] tracking-[-0.025em] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
      </div>
    );
  }
  if (screen.kind === "paragraph") {
    return (
      <div className="flex h-full w-full items-center justify-center px-7 py-32">
        <p className="font-text text-[19px] leading-[1.55] text-ink [text-wrap:pretty]">
          {screen.text}
        </p>
      </div>
    );
  }
  if (screen.kind === "divergence") {
    return (
      <div className="flex h-full w-full items-center justify-center px-7 py-32">
        <div className="rounded-btn bg-divider/60 p-6">
          <div className="mb-3 font-text text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
            Divergence
          </div>
          <p className="font-text text-[16px] italic leading-[1.55] text-ink-2 [text-wrap:pretty]">
            {screen.text}
          </p>
        </div>
      </div>
    );
  }
  // sources
  return (
    <div className="flex h-full w-full flex-col px-7 py-32">
      <div className="mb-6 font-text text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
        Sources
      </div>
      <div className="flex-1 overflow-y-auto">
        {view.row.sources.map((source) => {
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
                <div className="font-display text-[15px] font-medium tracking-[-0.015em] text-ink">
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
  );
}
