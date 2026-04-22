"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import type { CardView } from "@/lib/card-format";
import { groupFeed, viewsFromRows } from "@/lib/card-format";
import { SkyProvider } from "@/components/sky/sky";
import { MusicPlayerCard } from "@/components/card/music-player";
import {
  HeroCard,
  LinkCard,
  MicroPair,
  SquareCard,
  TextCard,
  WideCard,
} from "@/components/card/cards";
import { ReadingModal } from "@/components/card/reading-modal";

interface Props {
  rows: FeedCardRow[];
  useFixtures: boolean;
}

function todayHeader(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })
    .format(now)
    .replace(",", " ·");
}

function nextBriefLabel(): string {
  const h = new Date().getHours();
  if (h < 7) return "07:00";
  if (h < 12) return "12:00";
  return "07:00";
}

export function FeedScreen({ rows, useFixtures }: Props) {
  const [modalView, setModalView] = useState<CardView | null>(null);

  const views = useMemo(() => viewsFromRows(rows), [rows]);
  const grouped = useMemo(() => groupFeed(views), [views]);
  const headerDate = useMemo(todayHeader, []);
  const nextBrief = useMemo(nextBriefLabel, []);

  const recordOpen = useCallback(
    (view: CardView) => {
      setModalView(view);
      if (useFixtures) return;
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: view.row.id, signal: "neutral", dwell_ms: null }),
        keepalive: true,
      }).catch(() => {
        // best effort
      });
    },
    [useFixtures],
  );

  return (
    <>
      <div className="px-[18px] pb-10">
        <div className="pb-8 pt-[18px] text-center">
          <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
            {headerDate}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState nextBrief={nextBrief} />
        ) : (
          <SkyProvider>
            <div className="flex flex-col gap-4">
              <MusicPlayerCard />
              {grouped.map((node, idx) => {
                if (node.kind === "micro-pair") {
                  return (
                    <MicroPair
                      key={`pair-${idx}`}
                      a={node.views[0]}
                      b={node.views[1]}
                      onOpen={recordOpen}
                    />
                  );
                }
                const v = node.view;
                const props = { view: v, onOpen: () => recordOpen(v) };
                switch (v.format) {
                  case "hero":
                    return <HeroCard key={v.row.id} {...props} />;
                  case "wide":
                    return <WideCard key={v.row.id} {...props} />;
                  case "wide-flip":
                    return <WideCard key={v.row.id} {...props} flip />;
                  case "square":
                    return <SquareCard key={v.row.id} {...props} />;
                  case "text":
                    return <TextCard key={v.row.id} {...props} />;
                  case "link":
                    return <LinkCard key={v.row.id} {...props} />;
                  default:
                    return <TextCard key={v.row.id} {...props} />;
                }
              })}
            </div>
          </SkyProvider>
        )}

        {rows.length > 0 && (
          <div className="mt-[60px] pb-10 pt-10 text-center">
            <div className="mx-auto mb-6 h-[40px] w-px bg-divider-strong" />
            <div className="mb-3 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
              That&rsquo;s the morning.
            </div>
            <div className="font-text text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
              Next briefing · {nextBrief}
            </div>
          </div>
        )}
      </div>

      <ReadingModal view={modalView} onOpenChange={(o) => !o && setModalView(null)} />
    </>
  );
}

function EmptyState({ nextBrief }: { nextBrief: string }) {
  return (
    <div className="mt-20 text-center">
      <div className="mx-auto mb-8 h-[40px] w-px bg-divider-strong" />
      <div className="mb-3 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">
        No briefing yet today.
      </div>
      <div className="font-text text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">
        Next briefing · {nextBrief}
      </div>
    </div>
  );
}
