"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PHRASES = [
  "digging the web…",
  "curating content…",
  "cooking up your feed…",
  "reading so you don't have to…",
  "pulling the interesting threads…",
  "sorting the signal from the noise…",
  "composing your morning…",
  "distilling the internet…",
];

export function CurationAnimation() {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  // Cycle through phrases every 2.6s
  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  // Poll /api/batch. When status flips to completed → refresh the page.
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/batch", { cache: "no-store" });
        const data = (await res.json()) as { job: { status?: string } | null };
        if (data.job?.status === "completed") {
          window.clearInterval(id);
          router.refresh();
        }
      } catch {
        // keep polling
      }
    }, 10_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
      <SkyPulse />
      <div
        key={index}
        className="font-display text-[22px] font-medium leading-[1.2] tracking-[-0.02em] text-ink [text-wrap:balance] [animation:cs-phrase-in_420ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        {PHRASES[index]}
      </div>
      <div className="font-text text-[11.5px] leading-[1.5] text-ink-3 [text-wrap:pretty]">
        Your first batch is being assembled. This takes a few minutes.
        <br />
        You can close this tab — we&rsquo;ll be here.
      </div>
    </div>
  );
}

function SkyPulse() {
  return (
    <div className="relative h-[54px] w-[54px] overflow-hidden rounded-full">
      <div
        className="absolute inset-0"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, #f8d6c5, #c6dcf2, #dce8c9, #f3e0a8, #e4c8e8, #f8d6c5)",
          animation: "cs-sky-spin 5s linear infinite",
        }}
      />
      <div
        className="absolute inset-[4px] rounded-full"
        style={{
          background: "var(--color-paper)",
          boxShadow: "inset 0 0 18px rgba(0,0,0,0.06)",
        }}
      />
    </div>
  );
}
