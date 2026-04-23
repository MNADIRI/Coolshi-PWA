"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BriefLanguage, BriefRow } from "@/lib/supabase/database.types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Caption } from "@/components/card/primitives";

interface Props {
  brief: BriefRow | null;
  readOnly: boolean;
}

const WELCOME =
  "Hello, I'm coolshi, a content curator interfacing between you and the chaos of the web. I'll create two batches of content for you each day, one in the morning, another in the evening. Things that matter to you, nothing else. Let's set up your safe place.";

function normalizeTime(input: string, fallback: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(input);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Brussels";
  } catch {
    return "Europe/Brussels";
  }
}

export function BriefScreen({ brief, readOnly }: Props) {
  const [location, setLocation] = useState(brief?.location ?? "");
  const [scope, setScope] = useState<number>(brief?.international_scope ?? 50);
  const [recency, setRecency] = useState<number>(brief?.recency_days ?? 60);
  const [expertise, setExpertise] = useState<number>(brief?.expertise_level ?? 50);
  const [interests, setInterests] = useState(brief?.interests ?? "");
  const [preferences, setPreferences] = useState(brief?.preferences ?? "");
  const [mustNotMiss, setMustNotMiss] = useState(brief?.must_not_miss ?? "");
  const [amTime, setAmTime] = useState(normalizeTime(brief?.am_delivery_time ?? "07:00", "07:00"));
  const [pmTime, setPmTime] = useState(normalizeTime(brief?.pm_delivery_time ?? "18:00", "18:00"));
  const [timezone, setTimezone] = useState(brief?.timezone ?? "Europe/Brussels");
  const [language, setLanguage] = useState<BriefLanguage>(brief?.language ?? "en");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!brief?.timezone) {
      const detected = detectTimezone();
      if (detected) setTimezone(detected);
    }
  }, [brief?.timezone]);

  const pmBeforeAm = useMemo(() => pmTime <= amTime, [pmTime, amTime]);

  const save = () => {
    if (readOnly || !brief) return;
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase
          .from("briefs")
          .update({
            location: location.trim() || null,
            international_scope: scope,
            recency_days: recency,
            expertise_level: expertise,
            interests: interests.trim() || null,
            preferences: preferences.trim() || null,
            must_not_miss: mustNotMiss.trim() || null,
            am_delivery_time: amTime,
            pm_delivery_time: pmTime,
            timezone: timezone.trim() || "Europe/Brussels",
            language,
            updated_at: new Date().toISOString(),
          })
          .eq("id", brief.id);
        if (error) throw error;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <div className="px-5 pb-10">
      <div className="pb-[18px] pt-[18px] text-center">
        <div className="font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
          Brief
        </div>
      </div>

      <p className="mb-7 font-display text-[22px] font-medium leading-[1.25] tracking-[-0.02em] text-ink [text-wrap:pretty]">
        {WELCOME}
      </p>

      {!brief ? (
        <p className="font-text text-[14px] text-ink-2">
          No active brief yet. Insert one via the Supabase SQL editor to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Morning batch at">
              <input
                type="time"
                step={900}
                value={amTime}
                onChange={(e) => setAmTime(e.target.value)}
                readOnly={readOnly}
                className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] text-ink focus:border-ink focus:outline-none"
              />
            </Field>
            <Field label="Evening batch at">
              <input
                type="time"
                step={900}
                value={pmTime}
                onChange={(e) => setPmTime(e.target.value)}
                readOnly={readOnly}
                className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] text-ink focus:border-ink focus:outline-none"
              />
            </Field>
          </div>
          {pmBeforeAm && (
            <div className="-mt-3 font-text text-[11px] text-ink-3">
              Evening time must be later than morning. The routine will still run,
              but the batches may overlap.
            </div>
          )}

          <Field label="Timezone (auto-detected, edit if wrong)">
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              readOnly={readOnly}
              placeholder="Europe/Brussels"
              className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[13px] text-ink focus:border-ink focus:outline-none"
            />
          </Field>

          <Field label="Language">
            <div className="flex rounded-pill border border-divider-strong bg-paper p-1">
              {(["en", "fr"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => !readOnly && setLanguage(code)}
                  disabled={readOnly}
                  className={`flex-1 rounded-pill py-2 font-text text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    language === code ? "bg-ink text-canvas" : "text-ink-2"
                  }`}
                >
                  {code === "en" ? "English" : "Français"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Where do you live?">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              readOnly={readOnly}
              placeholder="Brussels, Belgium"
              className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
          </Field>

          <Field label="How international do you want me to be?">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={scope}
              onChange={(e) => setScope(Number(e.target.value))}
              disabled={readOnly}
              className="w-full accent-ink"
            />
            <div className="mt-1 flex justify-between font-text text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
              <span>local</span>
              <span className="text-ink">{scope}</span>
              <span>whole universe</span>
            </div>
          </Field>

          <Field label="Recency of context">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={recency}
              onChange={(e) => setRecency(Number(e.target.value))}
              disabled={readOnly}
              className="w-full accent-ink"
            />
            <div className="mt-1 flex justify-between font-text text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
              <span>last year</span>
              <span className="text-ink">{recency}</span>
              <span>last days</span>
            </div>
          </Field>

          <Field label="Expertise level of content">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={expertise}
              onChange={(e) => setExpertise(Number(e.target.value))}
              disabled={readOnly}
              className="w-full accent-ink"
            />
            <div className="mt-1 flex justify-between font-text text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
              <span>general</span>
              <span className="text-ink">{expertise}</span>
              <span>very niche</span>
            </div>
          </Field>

          <Field label="Give me your general interests in life">
            <textarea
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              readOnly={readOnly}
              rows={3}
              placeholder="Applied AI, radiology, monetary policy…"
              className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] leading-[1.55] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
          </Field>

          <Field label="What would you prefer to see here? Describe anything.">
            <textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              readOnly={readOnly}
              rows={3}
              placeholder="Technical, expert tone. Density over hand-holding."
              className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] leading-[1.55] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
          </Field>

          <Field label="Anything happening on the internet you wouldn't want to miss?">
            <textarea
              value={mustNotMiss}
              onChange={(e) => setMustNotMiss(e.target.value)}
              readOnly={readOnly}
              rows={3}
              placeholder="Major AI model releases; ECB and Fed decisions; landmark radiology trials."
              className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[14px] leading-[1.55] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
          </Field>

          <div className="mt-2 flex items-center justify-between">
            <span className="font-text text-[11px] text-ink-3">
              {readOnly
                ? "Fixture mode — set NEXT_PUBLIC_USE_FIXTURES=0 to edit."
                : status === "saved"
                  ? "Saved. Next batch will use this."
                  : status === "error"
                    ? "Error — retry."
                    : "Changes apply at the next batch."}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={readOnly || pending}
              className="rounded-btn bg-ink px-5 py-2.5 font-text text-[12px] font-semibold uppercase tracking-[0.12em] text-canvas disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Caption className="mb-2">{label}</Caption>
      {children}
    </div>
  );
}
