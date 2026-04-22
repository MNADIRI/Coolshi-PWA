"use client";

import type { CardView } from "@/lib/card-format";
import { SkyWindow } from "@/components/sky/sky";
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
      <SkyWindow style={{ aspectRatio: "4/5" }} />
      <div className="px-[22px] pb-6 pt-[22px]">
        <Caption className="mb-[14px]">{view.kicker}</Caption>
        <h2 className="mb-[14px] font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink [text-wrap:balance]">
          {view.row.title}
        </h2>
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
  const image = (
    <SkyWindow
      className="shrink-0"
      style={{ flexBasis: "42%", minHeight: 180 }}
    />
  );
  const text = (
    <div className="flex flex-1 flex-col justify-center px-[22px] py-5">
      <Caption className="mb-[10px]">{view.kicker}</Caption>
      <h2 className="mb-[10px] font-display text-[18px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance]">
        {view.row.title}
      </h2>
      <Sources items={view.sourceNames} readTime={view.readTime} />
    </div>
  );
  return cardShell(
    <div className="flex items-stretch">
      {flip ? text : image}
      {flip ? image : text}
    </div>,
    onOpen,
  );
}

export function SquareCard({ view, onOpen }: Props) {
  return cardShell(
    <>
      <SkyWindow style={{ aspectRatio: "16/11" }} />
      <div className="px-5 pb-5 pt-[18px]">
        <Caption className="mb-[10px]">{view.kicker}</Caption>
        <h2 className="mb-[10px] font-display text-[19px] font-semibold leading-[1.18] tracking-[-0.025em] text-ink [text-wrap:balance]">
          {view.row.title}
        </h2>
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
    <div className="px-[22px] py-[22px]">
      <Caption className="mb-3">{view.kicker}</Caption>
      <h2 className="mb-[14px] font-display text-[22px] font-semibold leading-[1.12] tracking-[-0.03em] text-ink [text-wrap:balance]">
        {view.row.title}
      </h2>
      <p className="mb-4 font-text text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
        {view.row.synthesis}
      </p>
      <Sources items={view.sourceNames} readTime={view.readTime} />
    </div>,
    onOpen,
  );
}

export function LinkCard({ view, onOpen }: Props) {
  const publication = view.sourceNames[0] ?? "Link";
  return cardShell(
    <div className="flex items-center gap-[14px] px-[18px] py-4">
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
        <div className="font-text text-[11px] text-ink-3">
          {publication} · {view.readTime}
        </div>
      </div>
    </div>,
    onOpen,
  );
}

export function MicroCard({ view, onOpen }: Props) {
  return cardShell(
    <div className="flex h-full flex-col">
      <SkyWindow style={{ aspectRatio: "1/1.25" }} />
      <div className="flex flex-1 flex-col px-[14px] pb-4 pt-[14px]">
        <Caption className="mb-2" style={{ fontSize: 9 }}>
          {view.kicker}
        </Caption>
        <div className="flex-1 font-display text-[14.5px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink [text-wrap:balance]">
          {view.row.title}
        </div>
        <div className="mt-[10px] font-text text-[10.5px] text-ink-3">
          {view.sourceNames[0] ?? ""} · {view.readTime}
        </div>
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
