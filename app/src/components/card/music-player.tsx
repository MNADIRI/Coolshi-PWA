"use client";

import { useMemo, useState } from "react";
import { SkyWindow } from "@/components/sky/sky";

export interface DiscoveryTrack {
  title: string;
  artist: string;
  album: string;
  duration: string;
}

const DEFAULT_TRACK: DiscoveryTrack = {
  title: "Blue Lotus Feet",
  artist: "Alice Coltrane",
  album: "Journey in Satchidananda",
  duration: "2:14",
};

export function MusicPlayerCard({ track = DEFAULT_TRACK }: { track?: DiscoveryTrack }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.34);

  const bars = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const v = 0.3 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.3)) * 0.7;
      return Math.max(0.15, Math.min(1, v));
    });
  }, []);

  return (
    <div className="overflow-hidden rounded-card border border-divider bg-paper">
      <div className="flex items-stretch">
        <SkyWindow style={{ flex: "0 0 112px" }} />
        <div className="flex min-w-0 flex-1 flex-col justify-between px-4 pb-3 pt-[14px]">
          <div>
            <div
              className="mb-1.5 font-text text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-3"
            >
              Discovery · While you read
            </div>
            <div
              className="mb-0.5 truncate font-display text-[15.5px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink"
            >
              {track.title}
            </div>
            <div className="truncate font-text text-[11.5px] text-ink-2">
              {track.artist} — <span className="text-ink-3">{track.album}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-[10px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPlaying((p) => !p);
              }}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-ink text-canvas"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg width="10" height="12" viewBox="0 0 10 12">
                  <rect x="0" width="3" height="12" fill="currentColor" />
                  <rect x="7" width="3" height="12" fill="currentColor" />
                </svg>
              ) : (
                <svg width="10" height="12" viewBox="0 0 10 12">
                  <polygon points="0,0 10,6 0,12" fill="currentColor" />
                </svg>
              )}
            </button>
            <div
              className="flex h-[26px] flex-1 cursor-pointer items-center gap-[1.5px]"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setProgress(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
              }}
            >
              {bars.map((b, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[0.5px] transition-colors"
                  style={{
                    height: `${(b * 100).toFixed(2)}%`,
                    backgroundColor:
                      i / bars.length < progress
                        ? "var(--color-ink)"
                        : "var(--color-ink4)",
                  }}
                />
              ))}
            </div>
            <div className="shrink-0 font-text text-[10px] tabular-nums text-ink-3">
              {track.duration}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
