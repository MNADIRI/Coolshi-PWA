"use client";

import { Children, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export interface TabDef {
  id: string;
  label: string;
}

interface Props {
  tabs: TabDef[];
  children: ReactNode;
  initial?: number;
}

export function TabShell({ tabs, children, initial = 0 }: Props) {
  const [activeIdx, setActiveIdx] = useState(initial);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startIdx: number;
    axis: "h" | "v" | null;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const AXIS_LOCK_PX = 8;

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    dragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startIdx: activeIdx,
      axis: null,
    };
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const s = dragRef.current;
    if (!s) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;
    if (s.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (s.axis === "h") setDragOffset(dx);
  };

  const onTouchEnd = () => {
    const s = dragRef.current;
    if (!s) return;
    if (s.axis !== "h") {
      setDragOffset(0);
      dragRef.current = null;
      return;
    }
    const width = viewportRef.current?.offsetWidth ?? 360;
    const threshold = width * 0.22;
    let next = s.startIdx;
    if (dragOffset < -threshold && next < tabs.length - 1) next += 1;
    else if (dragOffset > threshold && next > 0) next -= 1;
    setActiveIdx(next);
    setDragOffset(0);
    dragRef.current = null;
  };

  const panels = Children.toArray(children);

  return (
    <div className="relative h-dvh overflow-hidden bg-canvas">
      {/* Floating pill pager + theme toggle */}
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex flex-col items-center gap-2 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex rounded-pill border border-divider bg-paper/75 p-1 backdrop-blur-md backdrop-saturate-150">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-pill px-[14px] py-[7px] font-text text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                activeIdx === i ? "bg-ink text-canvas" : "text-ink-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ThemeToggle />
      </div>

      <div
        ref={viewportRef}
        className="absolute inset-0 select-none overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            width: `${tabs.length * 100}%`,
            transform: `translateX(calc(${-activeIdx * (100 / tabs.length)}% + ${dragOffset}px))`,
            transition: dragRef.current
              ? "none"
              : "transform 360ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
        >
          {panels.map((panel, i) => (
            <div
              key={i}
              className="h-full overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
              style={{
                width: `${100 / tabs.length}%`,
                paddingTop: "calc(104px + env(safe-area-inset-top))",
                paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
              }}
            >
              {panel}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
