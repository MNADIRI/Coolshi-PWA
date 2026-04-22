"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { CardView } from "@/lib/card-format";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { SkyWindow } from "@/components/sky/sky";
import { hostnameOf } from "@/lib/url";
import { Caption, Sources } from "./primitives";

interface Props {
  view: CardView | null;
  savedIds?: Set<string>;
  useFixtures?: boolean;
  onOpenChange: (open: boolean) => void;
  onSavedChange?: (row: FeedCardRow, saved: boolean) => void;
}

export function ReadingModal({
  view,
  savedIds,
  useFixtures,
  onOpenChange,
  onSavedChange,
}: Props) {
  const initial = view ? savedIds?.has(view.row.id) ?? false : false;
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSaved(view ? savedIds?.has(view.row.id) ?? false : false);
  }, [view, savedIds]);

  const toggleSaved = async () => {
    if (!view || pending) return;
    const row = view.row;
    const next = !saved;
    setSaved(next);
    onSavedChange?.(row, next);
    if (useFixtures) return;
    setPending(true);
    try {
      if (next) {
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: row.id }),
        });
      } else {
        await fetch(`/api/save?card_id=${encodeURIComponent(row.id)}`, {
          method: "DELETE",
        });
      }
    } catch {
      setSaved(!next);
      onSavedChange?.(row, !next);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root
      open={view !== null}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm [animation:cs-fade-in_260ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex h-[93dvh] flex-col overflow-hidden rounded-t-[24px] bg-canvas shadow-[0_-20px_60px_rgba(0,0,0,0.18)] focus:outline-none [animation:cs-slide-up_380ms_cubic-bezier(0.2,0.8,0.2,1)] safe-bottom"
          aria-describedby={undefined}
        >
          {view && <ModalBody view={view} saved={saved} onToggleSaved={toggleSaved} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function LongFormBody({
  longForm,
  synthesis,
}: {
  longForm: string | null;
  synthesis: string;
}) {
  const source = longForm?.trim() ? longForm : synthesis;
  const paragraphs = source
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
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
  );
}

function ModalBody({
  view,
  saved,
  onToggleSaved,
}: {
  view: CardView;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const showHero = view.format !== "link";
  return (
    <>
      <div className="relative flex items-center justify-between px-5 pb-1.5 pt-2.5">
        <div
          aria-hidden
          className="absolute left-1/2 top-[10px] h-[4px] w-[38px] -translate-x-1/2 rounded-[2px] bg-divider-strong"
        />
        <button
          type="button"
          onClick={onToggleSaved}
          className={`mt-2.5 rounded-pill border border-divider-strong px-[14px] py-1.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            saved ? "bg-ink text-canvas" : "bg-transparent text-ink"
          }`}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <Dialog.Close className="mt-2.5 rounded-pill border border-divider-strong bg-transparent px-[14px] py-1.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink">
          Close
        </Dialog.Close>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-[60px] pt-[14px]">
        {showHero && (
          <div className="mb-6 overflow-hidden rounded-[18px]">
            <SkyWindow style={{ aspectRatio: "4/5" }} />
          </div>
        )}

        <Caption className="mb-[14px]">{view.kicker}</Caption>

        <Dialog.Title
          asChild
        >
          <h1 className="mb-6 font-display text-[28px] font-medium leading-[1.08] tracking-[-0.035em] text-ink [text-wrap:balance]">
            {view.row.title}
          </h1>
        </Dialog.Title>

        {view.sourceNames.length > 0 && (
          <div className="mb-7">
            <Sources items={view.sourceNames} readTime={view.readTime} />
          </div>
        )}

        <LongFormBody
          longForm={view.row.long_form}
          synthesis={view.row.synthesis}
        />

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
      </div>
    </>
  );
}
