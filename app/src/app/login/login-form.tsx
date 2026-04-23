"use client";

import { useState, useTransition } from "react";
import { sendSignInCode, verifySignInCode } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitEmail = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("That doesn't look like an email.");
      return;
    }
    startTransition(async () => {
      const res = await sendSignInCode(trimmed, next);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEmail(trimmed);
      setInfo(null);
      setStep("code");
    });
  };

  const submitCode = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("The code is 6 digits.");
      return;
    }
    startTransition(async () => {
      const res = await verifySignInCode(email, trimmed, next);
      if (res && "error" in res) setError(res.error);
    });
  };

  const resend = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendSignInCode(email, next);
      if ("error" in res) setError(res.error);
      else setInfo("New code sent. Check your inbox.");
    });
  };

  if (step === "code") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-3">
        <div className="mb-1 text-center font-text text-[12px] leading-[1.5] text-ink-2">
          A 6-digit code was sent to <span className="text-ink">{email}</span>.
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          spellCheck={false}
          required
          disabled={pending}
          className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 text-center font-display text-[28px] font-medium tracking-[0.3em] tabular-nums text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-btn bg-ink px-5 py-3 font-text text-[12px] font-semibold uppercase tracking-[0.12em] text-canvas disabled:opacity-50"
        >
          {pending ? "Verifying…" : "Sign in"}
        </button>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setInfo(null);
            }}
            className="font-text text-[11px] text-ink-3 underline"
          >
            use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={pending}
            className="font-text text-[11px] text-ink-3 underline disabled:opacity-40"
          >
            resend code
          </button>
        </div>
        {error && <div className="font-text text-[12px] text-ink-2">{error}</div>}
        {info && <div className="font-text text-[12px] text-ink-3">{info}</div>}
      </form>
    );
  }

  return (
    <form onSubmit={submitEmail} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="email"
        required
        disabled={pending}
        className="w-full rounded-btn border border-divider-strong bg-paper px-4 py-3 font-text text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-btn bg-ink px-5 py-3 font-text text-[12px] font-semibold uppercase tracking-[0.12em] text-canvas disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send me a code"}
      </button>
      {error && <div className="font-text text-[12px] text-ink-2">{error}</div>}
    </form>
  );
}
