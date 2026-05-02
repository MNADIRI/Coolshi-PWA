"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import type { CardView } from "@/lib/card-format";
import { hostnameOf } from "@/lib/url";
import { HeroMedia } from "./hero-media";
import { Caption, Sources } from "./primitives";

interface Props {
  view: CardView;
}

type Slide =
  | { kind: "synthesis" }
  | { kind: "paragraph"; text: string; index: number; total: number }
  | { kind: "divergence"; text: string };

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

// Reading modal body: hero on top (small, fixed), Stories-style progress
// segments, then horizontally-tappable slides for the article body
// (synthesis → paragraphs → divergence). Sources stay pinned at the bottom.
export function ParagraphReader({ view }: Props) {
  const slides = buildSlides(view);
  const lastIdx = slides.length - 1;
  const [idx, setIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
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
    <div className="flex h-full min-h-0 flex-col">
      {/* Hero — kept smaller than the previous CardBody version so the
          slide area gets enough room. Bleeds to the modal edges via -mx-6. */}
      <div className="-mx-6 mb-4 shrink-0 overflow-hidden">
        <HeroMedia
          imageUrl={view.row.hero_image_url}
          title={view.row.title}
          kicker={view.kicker}
          style={{ aspectRatio: "16/10" }}
        />
      </div>

      {/* Progress segments — only when there's more than one slide. */}
      {slides.length > 1 && (
        <div
          aria-hidden
          className="mb-5 flex shrink-0 gap-[3px] px-0.5"
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

      {/* Slide area — horizontal slide between slides, tap left/right to nav. */}
      <div
        ref={containerRef}
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
              className="h-full shrink-0 overflow-y-auto px-1"
              style={{ width: width || "100%" }}
            >
              <SlideView slide={slide} view={view} />
            </div>
          ))}
        </motion.div>

        {/* Tap zones — overlay the slide area. Disabled at boundaries. */}
        <div className="absolute inset-0 z-10 flex">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous paragraph"
            disabled={idx === 0}
            className="h-full w-1/2 focus:outline-none disabled:cursor-default"
          />
          <button
            type="button"
            onClick={goNext}
            aria-label="Next paragraph"
            disabled={idx === lastIdx}
            className="h-full w-1/2 focus:outline-none disabled:cursor-default"
          />
        </div>
      </div>

      {/* Sources — pinned at the bottom, always visible. */}
      <div className="mt-5 shrink-0">
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
    </div>
  );
}

function SlideView({ slide, view }: { slide: Slide; view: CardView }) {
  if (slide.kind === "synthesis") {
    return (
      <div className="flex min-h-full items-center py-2">
        <p className="font-display text-[20px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
      </div>
    );
  }
  if (slide.kind === "paragraph") {
    return (
      <div className="flex min-h-full items-center py-2">
        <p className="font-text text-[17px] leading-[1.6] text-ink [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    );
  }
  // divergence
  return (
    <div className="flex min-h-full items-center py-2">
      <div className="w-full rounded-btn bg-divider/60 p-5">
        <Caption className="mb-2">Divergence</Caption>
        <p className="font-text text-[15px] italic leading-[1.55] text-ink-2 [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    </div>
  );
}
