"use client";

import type { PastelHue } from "@/components/sky/sky";
import { PastelArt } from "@/components/sky/sky";

export interface LibrarySource {
  name: string;
  tier: "A" | "B" | "C" | "D";
  status: string;
  active: boolean;
  hue: PastelHue;
}

interface Props {
  sources: LibrarySource[];
}

const TIER_LABEL: Record<LibrarySource["tier"], string> = {
  A: "Daily anchors",
  B: "Weekly depth",
  C: "Ambient signal",
  D: "Institutional",
};

export function LibraryScreen({ sources }: Props) {
  const byTier: Record<LibrarySource["tier"], LibrarySource[]> = { A: [], B: [], C: [], D: [] };
  for (const s of sources) byTier[s.tier].push(s);

  const activeCount = sources.filter((s) => s.active).length;

  return (
    <div className="px-5 pb-10">
      <div className="pb-[18px] pt-[18px] text-center">
        <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
          Library
        </div>
      </div>
      <div className="mb-1.5 font-display text-[30px] font-medium tracking-[-0.035em] text-ink">
        {sources.length} sources
      </div>
      <div className="mb-7 font-text text-[12.5px] tracking-[0.02em] text-ink-3">
        {activeCount} active
      </div>

      {(["A", "B", "C", "D"] as const).map((tier) => {
        const list = byTier[tier];
        if (list.length === 0) return null;
        return (
          <div key={tier} className="mb-7">
            <div className="mb-2.5 flex items-baseline justify-between border-t border-divider-strong pt-[14px]">
              <div className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
                {TIER_LABEL[tier]}
              </div>
              <div className="font-text text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
                Tier {tier}
              </div>
            </div>
            {list.map((s, i) => (
              <div
                key={s.name}
                className={`flex items-center gap-3 py-2.5 ${
                  i < list.length - 1 ? "border-b border-divider" : ""
                }`}
              >
                <PastelArt
                  hue={s.hue}
                  className="h-7 w-7 shrink-0 rounded-lg border border-divider"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-display text-[14.5px] font-medium tracking-[-0.01em] ${
                      s.active ? "text-ink" : "text-ink-3"
                    }`}
                  >
                    {s.name}
                  </div>
                </div>
                <div className="font-text text-[10.5px] text-ink-3">{s.status}</div>
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.active ? "var(--color-ink)" : "var(--color-ink4)" }}
                />
              </div>
            ))}
          </div>
        );
      })}

      <div className="mt-2.5 cursor-pointer border-t border-divider-strong py-[14px] text-center font-display text-[13px] font-medium text-ink-2">
        +&nbsp;&nbsp;Add source
      </div>
    </div>
  );
}
