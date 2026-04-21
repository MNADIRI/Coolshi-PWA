"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import type { FeedCardRow } from "@/lib/supabase/database.types";
import { timeAgo } from "@/lib/format";

interface Props {
  card: FeedCardRow | null;
  onOpenChange: (open: boolean) => void;
}

export function CardModal({ card, onOpenChange }: Props) {
  return (
    <Dialog.Root open={card !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[20px] bg-bg-surface p-6 pb-10 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom safe-bottom sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card">
          {card && (
            <>
              <Dialog.Close
                className="absolute right-4 top-4 rounded-full p-2 text-text-secondary hover:bg-divider"
                aria-label="Fermer"
              >
                <X size={18} />
              </Dialog.Close>

              <Dialog.Title className="pr-8 font-display text-[22px] font-medium leading-tight text-text-primary">
                {card.title}
              </Dialog.Title>

              <Dialog.Description className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary/90">
                {card.synthesis}
              </Dialog.Description>

              {card.divergence_notes && (
                <p className="mt-4 rounded-btn bg-divider/60 p-3 text-[13px] italic text-text-secondary">
                  ⓘ {card.divergence_notes}
                </p>
              )}

              <div className="mt-5">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                  Sources
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {card.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[14px] text-accent-like hover:underline"
                      >
                        <ExternalLink size={14} />
                        {source.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-5 text-[12px] text-text-secondary">
                {timeAgo(card.created_at)}
                {card.importance_score !== null && ` · importance ${card.importance_score}/10`}
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
