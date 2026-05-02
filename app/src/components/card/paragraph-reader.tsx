"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import type { CardView } from "@/lib/card-format";
import { hostnameOf } from "@/lib/url";
import { Caption, Sources } from "./primitives";

interface Props {
  view: CardView;
}

type Slide =
  | { kind: "synthesis" }
  | { kind: "paragraph"; text: string; index: number; total: number }
  | { kind: "divergence"; text: string };

// Title is rendered by the parent inside the permanent hero, so we don't
// repeat it as a slide. The very first slide on entry = synthesis (or
// the first long_form paragraph if the card has no synthesis).
function buildSlides(view: CardView): Slide[] {
  const slides: Slide[] = [];
  if (view.row.synthesis?.trim()) slides.push({ kind: "synthesis" });
  const long = view.row.long_form?.trim();
  if (long) {
    const paragraphs = long
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.forEach((text, index) => {
      slides.push({ kind: "paragraph", text, index, total: paragraphs.length });
    });
  }
  if (view.row.divergence_notes?.trim()) {
    slides.push({ kind: "divergence", text: view.row.divergence_notes });
  }
  return slides;
}

// Reading modal body. Per latest spec:
//   - No hero — full space for text (title/synthesis/paragraphs/divergence)
//   - Stories-style segments at top
//   - Horizontal tap nav between slides (clamped at boundaries)
//   - Sources are NOT visible by default — they sit below the slide area
//     and become reachable by vertical scroll. The parent container in
//     ReadingModal handles that scroll (overflow-y-auto).
export function ParagraphReader({ view }: Props) {
  const slides = buildSlides(view);
  const lastIdx = slides.length - 1;
  const [idx, setIdx] = useState(0);

  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(lastIdx, i + 1));

  return (
    <>
      {/* Slide area — takes the full available height of the modal body so
          the sources block below sits off-screen by default. */}
      <div className="flex min-h-full flex-col">
        {/* Progress segments (only when more than one slide). */}
        {slides.length > 1 && (
          <div
            aria-hidden
            className="mb-6 flex shrink-0 gap-[3px] px-0.5"
          >
            {slides.map((_, i) => (
              <div
                key={i}
                className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-ink/15"
              >
                <div
                  className="h-full bg-ink transition-all duration-200"
                  style={{ width: i <= idx ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Horizontal slide strip. Each slide is the full width of the area
            and stretches to take all the remaining vertical space. */}
        <div
          ref={slideAreaRef}
          className="relative min-h-0 flex-1 overflow-hidden"
        >
          <motion.div
            className="flex h-full"
            animate={{ x: -idx * width }}
            transition={{
              type: "spring",
              stiffness: 360,
              damping: 36,
              mass: 0.7,
            }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                className="h-full shrink-0"
                style={{ width: width || "100%" }}
              >
                <SlideView slide={slide} view={view} />
              </div>
            ))}
          </motion.div>

          {/* Tap zones overlay the slide area. Disabled at boundaries so
              repeated taps at the end don't make a sound. */}
          <div className="absolute inset-0 z-10 flex">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous"
              disabled={idx === 0}
              className="h-full w-1/2 focus:outline-none disabled:cursor-default"
            />
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              disabled={idx === lastIdx}
              className="h-full w-1/2 focus:outline-none disabled:cursor-default"
            />
          </div>
        </div>
      </div>

      {/* Sources — sit below the slide area; revealed by scrolling the
          modal body. Big top margin so the user can tell they've left the
          reading area. */}
      <div className="mt-16 shrink-0 border-t border-divider pt-6">
        {view.sourceNames.length > 0 && (
          <div className="mb-3">
            <Sources items={view.sourceNames} readTime={view.readTime} />
          </div>
        )}
        {view.row.sources.length > 0 && (
          <div>
            <Caption className="mb-2">Sources</Caption>
            {view.row.sources.map((source) => {
              const host = hostnameOf(source.url);
              return (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 border-t border-divider py-3"
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
        )}
      </div>
    </>
  );
}

function SlideView({ slide, view }: { slide: Slide; view: CardView }) {
  if (slide.kind === "synthesis") {
    return (
      <div className="flex h-full items-center px-1">
        <p className="font-display text-[21px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
      </div>
    );
  }
  if (slide.kind === "paragraph") {
    return (
      <div className="flex h-full items-center px-1">
        <p className="font-text text-[18px] leading-[1.6] text-ink [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    );
  }
  // divergence
  return (
    <div className="flex h-full items-center px-1">
      <div className="w-full rounded-btn bg-divider/60 p-5">
        <Caption className="mb-2">Divergence</Caption>
        <p className="font-text text-[16px] italic leading-[1.55] text-ink-2 [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    </div>
  );
}
