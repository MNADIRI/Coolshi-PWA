import type { CardView } from "@/lib/card-format";
import { hostnameOf } from "@/lib/url";
import { HeroMedia } from "./hero-media";
import { Caption, Sources } from "./primitives";

// Pure content body shared by the reading modal and the public /c/[slug] page.
// No state, no client APIs — safe in both Server and Client Components.
export function CardBody({ view }: { view: CardView }) {
  const longFormSource = view.row.long_form?.trim()
    ? view.row.long_form
    : view.row.synthesis;
  const paragraphs = longFormSource
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <div className="mb-7 -mx-6 overflow-hidden">
        <HeroMedia
          imageUrl={view.row.hero_image_url}
          title={view.row.title}
          kicker={view.kicker}
          style={{ aspectRatio: "4/5" }}
        />
      </div>

      {view.sourceNames.length > 0 && (
        <div className="mb-7">
          <Sources items={view.sourceNames} readTime={view.readTime} />
        </div>
      )}

      <div className="mb-[18px] space-y-[1.05em]">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="font-text text-[15px] leading-[1.65] text-ink [text-wrap:pretty]"
          >
            {p}
          </p>
        ))}
      </div>

      {view.row.divergence_notes && (
        <div className="mb-6 rounded-btn bg-divider/60 p-4">
          <Caption className="mb-1.5">Divergence</Caption>
          <p className="font-text text-[13.5px] italic leading-[1.55] text-ink-2">
            {view.row.divergence_notes}
          </p>
        </div>
      )}

      {view.row.sources.length > 0 && (
        <div className="mt-9">
          <Caption className="mb-[14px]">Sources</Caption>
          {view.row.sources.map((source) => {
            const host = hostnameOf(source.url);
            return (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-t border-divider py-[14px]"
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
    </>
  );
}
