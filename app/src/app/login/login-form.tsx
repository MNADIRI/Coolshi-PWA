"use client";

import { useState, useTransition } from "react";
import { signInWithMagicLink } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("That doesn't look like an email.");
      return;
    }
    startTransition(async () => {
      const res = await signInWithMagicLink(trimmed, next);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
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
        {pending ? "Sending…" : "Send me a link"}
      </button>
      {error && (
        <div className="font-text text-[12px] text-ink-2">{error}</div>
      )}
    </form>
  );
}
