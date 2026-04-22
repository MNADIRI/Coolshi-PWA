"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualBatchJobRow } from "@/lib/supabase/database.types";

interface Props {
  initialJob: ManualBatchJobRow | null;
  initialReserveCount: number;
  headerDate: string;
  useFixtures: boolean;
}

const ALREADY_USED_MESSAGES = [
  "already used today, see you tomorrow",
  "one pull a day, that's the rule",
  "take a break — your next unlocks at midnight",
];
const NO_RESERVE_MESSAGES = [
  "nothing in reserve right now — next batch brings fresh stock",
  "the shelves are empty, come back after the next scheduled run",
  "out of reserves — scheduled batches will restock them",
];

function pickMessage(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function BatchTrigger({
  initialJob,
  initialReserveCount,
  headerDate,
  useFixtures,
}: Props) {
  const router = useRouter();
  const [job, setJob] = useState<ManualBatchJobRow | null>(initialJob);
  const [reserveCount, setReserveCount] = useState(initialReserveCount);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const alreadyUsedToday = Boolean(job);
  const dimmed = alreadyUsedToday || reserveCount === 0 || pending;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleTap = async () => {
    if (useFixtures) {
      showToast("fixtures mode — switch off NEXT_PUBLIC_USE_FIXTURES");
      return;
    }
    if (pending) return;
    if (alreadyUsedToday) {
      showToast(pickMessage(ALREADY_USED_MESSAGES));
      return;
    }
    if (reserveCount === 0) {
      showToast(pickMessage(NO_RESERVE_MESSAGES));
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/batch", { method: "POST" });
      const data = await res.json();
      if (res.status === 409 && data.error === "already_used_today") {
        setJob(data.job);
        showToast(pickMessage(ALREADY_USED_MESSAGES));
        return;
      }
      if (res.status === 409 && data.error === "nothing_in_reserve") {
        setReserveCount(0);
        showToast(pickMessage(NO_RESERVE_MESSAGES));
        return;
      }
      if (!res.ok) {
        showToast("couldn't pull reserves right now, try again");
        return;
      }
      setJob(data.job);
      setReserveCount(0);
      showToast(`+${data.released} fresh card${data.released === 1 ? "" : "s"}`);
      router.refresh();
    } catch {
      showToast("network hiccup — try again");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        disabled={pending}
        aria-label={
          alreadyUsedToday
            ? "Manual batch already used today"
            : reserveCount > 0
              ? `Tap to release ${reserveCount} reserve cards`
              : "No reserves available"
        }
        className={`font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] transition-colors ${
          dimmed ? "text-ink-3" : "text-ink-2 hover:text-ink active:text-ink"
        }`}
      >
        {headerDate}
        {!alreadyUsedToday && reserveCount > 0 && (
          <span className="ml-2 text-ink">· +{reserveCount}</span>
        )}
      </button>
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
