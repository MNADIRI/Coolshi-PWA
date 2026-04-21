import type { FeedCardRow } from "@/lib/supabase/database.types";
import { sourceList, timeAgo } from "@/lib/format";
import { DeepDiveBadge } from "./deep-dive-badge";

interface Props {
  card: FeedCardRow;
}

function HeroFallback({ seed }: { seed: string }) {
  const hash = [...seed].reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const hue = hash % 360;
  return (
    <div
      className="h-[240px] w-full"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 32%, 82%), hsl(${(hue + 40) % 360}, 28%, 68%))`,
      }}
      aria-hidden
    />
  );
}

export function Card({ card }: Props) {
  return (
    <article className="relative flex w-full flex-col overflow-hidden rounded-card bg-bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-divider dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
      <div className="relative">
        {card.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.hero_image_url}
            alt=""
            className="h-[240px] w-full object-cover"
            draggable={false}
          />
        ) : (
          <HeroFallback seed={card.id} />
        )}
        {card.card_type === "deep_dive" && <DeepDiveBadge />}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <h2 className="line-clamp-2 font-display text-[18px] font-medium leading-tight text-text-primary">
          {card.title}
        </h2>

        <p className="line-clamp-3 text-[15px] leading-[1.55] text-text-primary/85">
          {card.synthesis}
        </p>

        {card.divergence_notes && (
          <p className="flex items-start gap-1.5 text-[13px] italic text-text-secondary">
            <span aria-hidden>ⓘ</span>
            <span>{card.divergence_notes}</span>
          </p>
        )}

        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-divider px-2 py-0.5 text-[11px] text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[12px] text-text-secondary">
          <span className="truncate">{sourceList(card.sources)}</span>
          <span className="shrink-0 pl-2">{timeAgo(card.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
