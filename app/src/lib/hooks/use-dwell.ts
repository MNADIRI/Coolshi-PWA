"use client";

import { useEffect, useRef } from "react";

export function useDwell(onUnmount: (dwellMs: number) => void) {
  const startRef = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && startRef.current === null) {
          startRef.current = performance.now();
        } else if (!entry.isIntersecting && startRef.current !== null) {
          const delta = performance.now() - startRef.current;
          startRef.current = null;
          if (delta > 50) onUnmount(Math.round(delta));
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (startRef.current !== null) {
        const delta = performance.now() - startRef.current;
        if (delta > 50) onUnmount(Math.round(delta));
        startRef.current = null;
      }
    };
  }, [onUnmount]);

  return elementRef;
}
