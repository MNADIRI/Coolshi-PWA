"use client";

import { useState, useTransition } from "react";
import type { BriefRow } from "@/lib/supabase/database.types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Caption } from "@/components/card/primitives";

interface Props {
  brief: BriefRow | null;
  readOnly: boolean;
}

function extractHeadline(markdown: string): string {
  const firstPara = markdown.split(/\n\s*\n/).find((p) => p.trim() && !p.startsWith("#"));
  if (!firstPara) return "Your curation profile.";
  const plain = firstPara.replace(/[*_#>`]/g, "").trim();
  return plain.length > 240 ? `${plain.slice(0, 240)}…` : plain;
}

function extractChips(markdown: string): string[] {
  const match = /Layer 1[\s\S]*?##/i.exec(markdown);
  const segment = match ? match[0] : markdown;
  const bolded = Array.from(segment.matchAll(/\*\*([^*]{3,40})\*\*/g)).map((m) => m[1]!);
  return Array.from(new Set(bolded)).slice(0, 6);
}

function extractTone(markdown: string): string | null {
  const tone = /(Writing level|Tone|Style)[:\s]*([\s\S]*?)(\n\n|$)/i.exec(markdown);
  return tone ? tone[2]!.replace(/\*\*/g, "").trim().slice(0, 260) : null;
}

export function BriefScreen({ brief, readOnly }: Props) {
  const [showEditor, setShowEditor] = useState(false);
  const [content, setContent] = useState(brief?.content ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (readOnly || !brief) return;
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase
          .from("briefs")
          .update({ content })
          .eq("id", brief.id);
        if (error) throw error;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    });
  };

  const markdown = brief?.content ?? "";
  const headline = extractHeadline(markdown);
  const chips = extractChips(markdown);
  const tone = extractTone(markdown);

  return (
    <div className="px-5 pb-10">
      <div className="pb-[18px] pt-[18px] text-center">
        <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
          Brief
        </div>
      </div>
      <div className="mb-7 font-display text-[30px] font-medium leading-[1.1] tracking-[-0.035em] text-ink [text-wrap:balance]">
        Your curation profile.
      </div>

      {!brief ? (
        <p className="font-text text-[14px] text-ink-2">
          No active brief. Insert one via Supabase SQL editor to get started.
        </p>
      ) : (
        <>
          <div className="mb-3 rounded-card border border-divider bg-paper px-5 py-[22px]">
            <Caption className="mb-[14px]">Paying attention to</Caption>
            <p className="mb-4 font-text text-[14.5px] leading-[1.6] text-ink [text-wrap:pretty]">
              {headline}
            </p>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((t) => (
                  <div
                    key={t}
                    className="rounded-pill border border-divider-strong px-[11px] py-[5px] font-text text-[12px] text-ink"
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          {tone && (
            <div className="mb-3 rounded-card bg-ink px-5 py-[22px] text-canvas">
              <Caption className="mb-[14px] !text-white/55">Tone</Caption>
              <p className="font-text text-[14.5px] leading-[1.6] [text-wrap:pretty]">{tone}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowEditor((v) => !v)}
            className="mb-2.5 flex w-full items-center justify-between rounded-card border border-divider bg-paper px-5 py-4"
          >
            <span className="font-display text-[15px] font-medium tracking-[-0.015em] text-ink">
              {showEditor ? "Hide editor" : "Edit markdown"}
            </span>
            <span className="font-text text-[11px] text-ink-3">
              {markdown.length.toLocaleString()} chars →
            </span>
          </button>

          {showEditor && (
            <div className="flex flex-col gap-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                readOnly={readOnly}
                spellCheck={false}
                className="min-h-[60vh] w-full rounded-card border border-divider bg-paper p-4 font-mono text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-ink-4"
              />
              <div className="flex items-center justify-between">
                <span className="font-text text-[11px] text-ink-3">
                  {readOnly
                    ? "Fixture mode — set NEXT_PUBLIC_USE_FIXTURES=0 to edit."
                    : status === "saved"
                      ? "Saved."
                      : status === "error"
                        ? "Error — retry."
                        : `${content.length} chars`}
                </span>
                <button
                  type="button"
                  onClick={save}
                  disabled={readOnly || pending}
                  className="rounded-btn bg-ink px-4 py-2 font-text text-[12px] font-semibold uppercase tracking-[0.12em] text-canvas disabled:opacity-40"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
