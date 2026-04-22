"use client";

import type { CardView } from "@/lib/card-format";
import { HeroMedia } from "./hero-media";
import { hostnameOf } from "@/lib/url";
import { Caption, Sources } from "./primitives";

interface Props {
  view: CardView;
  onOpen: () => void;
}

function cardShell(children: React.ReactNode, onClick: () => void) {
  return (
    <article
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-card border border-divider bg-paper transition-transform active:scale-[0.99]"
    >
      {children}
    </article>
  );
}

export function HeroCard({ view, onOpen }: Props) {
  return cardShell(
    <>
      <HeroMedia
        imageUrl={view.row.hero_image_url}
        title={view.row.title}
        kicker={view.kicker}
        style={{ aspectRatio: "4/5" }}
      />
      <div className="px-[22px] pb-6 pt-5">
        <p className="mb-[18px] font-text text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
        <Sources items={view.sourceNames} readTime={view.readTime} />
      </div>
    </>,
    onOpen,
  );
}

export function WideCard({ view, onOpen, flip = false }: Props & { flip?: boolean }) {
  const media = (
    <HeroMedia
      imageUrl={view.row.hero_image_url}
      title={view.row.title}
      kicker={view.kicker}
      compact
      className="shrink-0"
      style={{ flexBasis: "46%", minHeight: 180 }}
    />
  );
  const text = (
    <div className="flex flex-1 flex-col justify-center px-[22px] py-5">
      <p className="mb-3 font-text text-[13px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
        {view.row.synthesis}
      </p>
      <Sources items={view.sourceNames} readTime={view.readTime} />
    </div>
  );
  return cardShell(
    <div className="flex items-stretch">
      {flip ? text : media}
      {flip ? media : text}
    </div>,
    onOpen,
  );
}

export function SquareCard({ view, onOpen }: Props) {
  return cardShell(
    <>
      <HeroMedia
        imageUrl={view.row.hero_image_url}
        title={view.row.title}
        kicker={view.kicker}
        style={{ aspectRatio: "16/11" }}
      />
      <div className="px-5 pb-5 pt-[14px]">
        <p className="mb-[14px] font-text text-[13.5px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
        <Sources items={view.sourceNames} readTime={view.readTime} />
      </div>
    </>,
    onOpen,
  );
}

export function TextCard({ view, onOpen }: Props) {
  return cardShell(
    <>
      <HeroMedia
        imageUrl={view.row.hero_image_url}
        title={view.row.title}
        kicker={view.kicker}
        style={{ aspectRatio: "3/1.6" }}
      />
      <div className="px-[22px] pb-5 pt-4">
        <p className="mb-3.5 font-text text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
          {view.row.synthesis}
        </p>
        <Sources items={view.sourceNames} readTime={view.readTime} />
      </div>
    </>,
    onOpen,
  );
}

export function LinkCard({ view, onOpen }: Props) {
  const publication = view.sourceNames[0] ?? "Link";
  const firstUrl = view.row.sources[0]?.url ?? "";
  const host = hostnameOf(firstUrl);
  return (
    <a
      href={firstUrl || "#"}
      onClick={(e) => {
        if (!firstUrl) {
          e.preventDefault();
          onOpen();
        }
      }}
      target={firstUrl ? "_blank" : undefined}
      rel={firstUrl ? "noopener noreferrer" : undefined}
      className="flex cursor-pointer items-center gap-[14px] overflow-hidden rounded-card border border-divider bg-paper px-[18px] py-4 transition-transform active:scale-[0.99]"
    >
      <div
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-btn bg-ink text-[16px] text-canvas"
        aria-hidden
      >
        ↗
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-display text-[15px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty]">
          {view.row.title}
        </div>
        <div className="truncate font-text text-[11px] text-ink-3">
          {publication}
          {host && publication.toLowerCase() !== host.toLowerCase() ? ` · ${host}` : ""} ·{" "}
          {view.readTime}
        </div>
      </div>
    </a>
  );
}

export function MicroCard({ view, onOpen }: Props) {
  return cardShell(
    <div className="flex h-full flex-col">
      <HeroMedia
        imageUrl={view.row.hero_image_url}
        title={view.row.title}
        kicker={view.kicker}
        compact
        style={{ aspectRatio: "1/1.25" }}
      />
      <div className="px-[14px] pb-3 pt-2.5 font-text text-[10.5px] text-ink-3">
        {view.sourceNames[0] ?? ""} · {view.readTime}
      </div>
    </div>,
    onOpen,
  );
}

export function MicroPair({
  a,
  b,
  onOpen,
}: {
  a: CardView;
  b: CardView;
  onOpen: (view: CardView) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[14px]">
      <MicroCard view={a} onOpen={() => onOpen(a)} />
      <MicroCard view={b} onOpen={() => onOpen(b)} />
    </div>
  );
}

// Keep Caption exported usage compatible
export { Caption };
