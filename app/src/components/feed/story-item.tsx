"use client";

import { motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CardView } from "@/lib/card-format";
import { splitCardIntoScreens, type StoryScreen } from "@/lib/story-screens";
import { HeroMedia } from "@/components/card/hero-media";
import { StoryOverlays } from "./story-overlays";

interface Props {
  view: CardView;
  active: boolean; // is this the visible item?
  saved: boolean;
  sharing: boolean;
  screenIndex: number; // current paragraph index (controlled by parent)
  onScreenChange: (next: number) => void;
  onAdvanceItem: () => void; // tap right past last screen
  onPrevItem: () => void; // tap left before first screen
  onSave: () => void;
  onShare: () => void;
  onSources: () => void;
}

const TAP_BAR_HEIGHT = 68; // px reserved at bottom for the action bar (approx)
const OVERLAY_AUTO_HIDE_MS = 3500;

export function StoryItem({
  view,
  active,
  saved,
  sharing,
  screenIndex,
  onScreenChange,
  onAdvanceItem,
  onPrevItem,
  onSave,
  onShare,
  onSources,
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

  // Overlays auto-hide. Reset timer on any user input. Only run while active.
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);

  const armHideTimer = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setOverlaysVisible(false),
      OVERLAY_AUTO_HIDE_MS,
    );
  }, []);

  useEffect(() => {
    if (!active) {
      setOverlaysVisible(true);
      return;
    }
    armHideTimer();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [active, armHideTimer, screenIndex]);

  const onTapLeft = () => {
    setOverlaysVisible(true);
    armHideTimer();
    if (screenIndex > 0) onScreenChange(screenIndex - 1);
    else onPrevItem();
  };

  const onTapRight = () => {
    setOverlaysVisible(true);
    armHideTimer();
    if (screenIndex < lastIndex) onScreenChange(screenIndex + 1);
    else onAdvanceItem();
  };

  const onTapCenter = () => {
    setOverlaysVisible((v) => {
      const next = !v;
      if (next) armHideTimer();
      return next;
    });
  };

  const currentScreen = screens[screenIndex] ?? screens[0]!;
  const contrast = currentScreen.kind === "hero" ? "light" : "dark";

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-canvas"
    >
      {/* Sliding strip of screens. Translate by pixel offset measured from the container. */}
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

      {/* Tap zones — above content, below overlays. Reserve bottom padding so
          the action bar stays untouched. */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex"
        style={{ bottom: `calc(${TAP_BAR_HEIGHT}px + env(safe-area-inset-bottom))` }}
      >
        <button
          type="button"
          aria-label="Previous"
          className="h-full w-[40%] focus:outline-none"
          onClick={onTapLeft}
        />
        <button
          type="button"
          aria-label="Toggle overlays"
          className="h-full w-[20%] focus:outline-none"
          onClick={onTapCenter}
        />
        <button
          type="button"
          aria-label="Next"
          className="h-full w-[40%] focus:outline-none"
          onClick={onTapRight}
        />
      </div>

      <StoryOverlays
        view={view}
        totalScreens={screens.length}
        currentScreen={screenIndex}
        visible={overlaysVisible}
        saved={saved}
        sharing={sharing}
        contrast={contrast}
        onSave={onSave}
        onShare={onShare}
        onSources={onSources}
      />
    </div>
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
      <div className="flex h-full w-full items-center justify-center px-7 py-10 safe-top">
        <p className="font-display text-[26px] font-medium leading-[1.25] tracking-[-0.025em] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
      </div>
    );
  }
  if (screen.kind === "paragraph") {
    return (
      <div className="flex h-full w-full items-center justify-center px-7 py-10 safe-top">
        <p className="font-text text-[19px] leading-[1.55] text-ink [text-wrap:pretty]">
          {screen.text}
        </p>
      </div>
    );
  }
  // divergence
  return (
    <div className="flex h-full w-full items-center justify-center px-7 py-10 safe-top">
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
