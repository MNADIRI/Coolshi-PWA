"use client";

import { useCallback, useState, useTransition } from "react";
import type { BriefRow } from "@/lib/supabase/database.types";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface Props {
  initial: BriefRow | null;
  readOnly: boolean;
}

export function BriefEditor({ initial, readOnly }: Props) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    if (readOnly || !initial) return;
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase
          .from("briefs")
          .update({ content })
          .eq("id", initial.id);
        if (error) throw error;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
      }
    });
  }, [content, initial, readOnly]);

  return (
    <div className="flex flex-col gap-3 px-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="min-h-[60vh] w-full rounded-card bg-bg-surface p-4 font-mono text-[14px] leading-relaxed text-text-primary ring-1 ring-divider focus:outline-none focus:ring-2 focus:ring-accent-like/40"
      />

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-secondary">
          {readOnly
            ? "Mode fixture — bascule NEXT_PUBLIC_USE_FIXTURES=0 pour éditer."
            : status === "saved"
              ? "Enregistré."
              : status === "error"
                ? "Erreur — réessaie."
                : `${content.length} caractères`}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={readOnly || pending}
          className="rounded-btn bg-accent-like px-4 py-2 text-[14px] font-medium text-white disabled:opacity-40"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
