"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
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

// Modal body content. The parent in ReadingModal is overflow-y-auto.
// We measure the parent's visible height and pin the slide wrapper to
// exactly that height — that way the sources block sitting below sits
// off-screen by default and the user reaches it by scrolling the modal
// body. Tap-to-navigate uses onClick on the slide area (with X-hit
// detection); no absolute button overlay so vertical scroll inside a
// long paragraph works natively.
export function ParagraphReader({ view }: Props) {
  const slides = buildSlides(view);
  const lastIdx = slides.length - 1;
  const [idx, setIdx] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [parentHeight, setParentHeight] = useState(0);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const parent = wrapper.parentElement;
    if (!parent) return;
    const measureParent = () => setParentHeight(parent.clientHeight);
    measureParent();
    const ro = new ResizeObserver(measureParent);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [parentHeight]);

  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(lastIdx, i + 1));

  const onAreaClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  };

  return (
    <>
      {/* Slide wrapper — explicit pixel height = modal body's visible
          area. Sources sit below this height = off-screen by default. */}
      <div
        ref={wrapperRef}
        className="flex flex-col px-6 pt-5"
        style={{ height: parentHeight || undefined }}
      >
        {/* Progress segments — only when there's more than one slide. */}
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

        {/* Slide area. Click anywhere → goPrev/goNext based on X. No
            absolute overlay, so each slide's overflow-y-auto works. */}
        <div
          ref={slideAreaRef}
          className="relative min-h-0 flex-1 cursor-pointer overflow-hidden"
          onClick={onAreaClick}
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
                className="h-full shrink-0 overflow-y-auto"
                style={{ width: width || "100%" }}
              >
                <SlideView slide={slide} view={view} />
              </div>
            ))}
          </motion.div>

          {/* Hidden buttons for screen readers / keyboard. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            disabled={idx === 0}
            aria-label="Previous"
            className="sr-only"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            disabled={idx === lastIdx}
            aria-label="Next"
            className="sr-only"
          />
        </div>
      </div>

      {/* Sources — sit below the slide wrapper. Revealed by scrolling
          the modal body. Top margin + divider so it's visually distinct. */}
      <div className="mt-16 shrink-0 border-t border-divider px-6 pb-6 pt-6">
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
  // Top-aligned with vertical padding. Long text reads from top and
  // scrolls naturally inside its slide; short text fills naturally.
  if (slide.kind === "synthesis") {
    return (
      <div className="px-1 py-3">
        <p className="font-display text-[21px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
      </div>
    );
  }
  if (slide.kind === "paragraph") {
    return (
      <div className="px-1 py-3">
        <p className="font-text text-[18px] leading-[1.6] text-ink [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    );
  }
  // divergence
  return (
    <div className="px-1 py-3">
      <div className="rounded-btn bg-divider/60 p-5">
        <Caption className="mb-2">Divergence</Caption>
        <p className="font-text text-[16px] italic leading-[1.55] text-ink-2 [text-wrap:pretty]">
          {slide.text}
        </p>
      </div>
    </div>
  );
}
