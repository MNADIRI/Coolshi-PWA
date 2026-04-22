"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualBatchJobRow } from "@/lib/supabase/database.types";

interface Props {
  initialJob: ManualBatchJobRow | null;
  headerDate: string;
  useFixtures: boolean;
}

const LOADING_MESSAGES = [
  "your content is being curated, it will be available soon",
  "pulling fresh takes from the chaos, one moment",
  "cooking up a new batch — give it a few minutes",
];
const ALREADY_USED_MESSAGES = [
  "already used today, see you tomorrow",
  "one manual batch a day, that's the rule. come back tomorrow.",
  "take a break — your next free pull unlocks at midnight",
];

function pickMessage(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function BatchTrigger({ initialJob, headerDate, useFixtures }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<ManualBatchJobRow | null>(initialJob);
  const [toast, setToast] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const isInProgress = job?.status === "in_progress";
  const alreadyUsedToday = Boolean(job) && !isInProgress;

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current !== null) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch("/api/batch", { cache: "no-store" });
        const data = (await res.json()) as { job: ManualBatchJobRow | null };
        if (data.job) {
          setJob(data.job);
          if (data.job.status !== "in_progress") {
            stopPolling();
            if (data.job.status === "completed") {
              router.refresh();
            }
          }
        }
      } catch {
        // network blip — keep polling
      }
    }, 6000);
  }, [router, stopPolling]);

  useEffect(() => {
    if (isInProgress) startPolling();
    else stopPolling();
    return stopPolling;
  }, [isInProgress, startPolling, stopPolling]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleTap = async () => {
    if (useFixtures) {
      showToast("fixtures mode — no batch triggered");
      return;
    }
    if (isInProgress) return;
    if (alreadyUsedToday) {
      showToast(pickMessage(ALREADY_USED_MESSAGES));
      return;
    }
    try {
      const res = await fetch("/api/batch", { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        setJob(data.job);
        showToast(pickMessage(ALREADY_USED_MESSAGES));
        return;
      }
      if (res.status === 501) {
        showToast("manual batch not wired up yet — your scheduled batches still run 2x a day");
        return;
      }
      if (!res.ok) {
        showToast("couldn't start a batch right now, try again");
        return;
      }
      setJob(data.job);
      startPolling();
    } catch {
      showToast("network hiccup — try again");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        disabled={isInProgress}
        aria-label={
          isInProgress
            ? "A manual batch is being prepared"
            : alreadyUsedToday
              ? "Manual batch already used today"
              : "Tap to trigger a manual batch"
        }
        className={`font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] transition-colors ${
          isInProgress
            ? "text-ink"
            : alreadyUsedToday
              ? "text-ink-3"
              : "text-ink-2 hover:text-ink active:text-ink"
        }`}
      >
        {headerDate}
      </button>
      {isInProgress && <CurationOverlay />}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+110px)] z-50 -translate-x-1/2 rounded-pill border border-divider bg-paper/90 px-4 py-2 font-text text-[12px] text-ink shadow-md backdrop-blur-md"
        >
          {toast}
        </div>
      )}
    </>
  );
}

function CurationOverlay() {
  const [message] = useState(() => pickMessage(LOADING_MESSAGES));
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+130px)] z-30 mx-auto max-w-[380px] overflow-hidden rounded-card border border-divider bg-paper/90 px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <SkyPulse />
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 font-text text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            curating
          </div>
          <div className="font-display text-[14px] font-medium leading-[1.3] tracking-[-0.02em] text-ink [text-wrap:pretty]">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkyPulse() {
  return (
    <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full">
      <div
        className="absolute inset-0"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, #f8d6c5, #c6dcf2, #dce8c9, #f3e0a8, #e4c8e8, #f8d6c5)",
          animation: "cs-sky-spin 4.2s linear infinite",
        }}
      />
      <div
        className="absolute inset-[3px] rounded-full"
        style={{
          background: "var(--color-paper)",
          boxShadow: "inset 0 0 14px rgba(0,0,0,0.06)",
        }}
      />
    </div>
  );
}
