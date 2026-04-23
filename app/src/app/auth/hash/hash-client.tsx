"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function HashClient({ next }: { next: string }) {
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.replace(/^#/, "");
        if (!hash) {
          setMessage("Missing auth tokens.");
          window.location.replace(`/login?error=missing_tokens`);
          return;
        }
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const errorDescription = params.get("error_description") ?? params.get("error");
        if (errorDescription) {
          window.location.replace(
            `/login?error=${encodeURIComponent(errorDescription)}`,
          );
          return;
        }
        if (!access_token || !refresh_token) {
          setMessage("Incomplete auth tokens in URL.");
          window.location.replace(`/login?error=incomplete_tokens`);
          return;
        }
        const supabase = getBrowserSupabase();
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          window.location.replace(
            `/login?error=${encodeURIComponent(error.message)}`,
          );
          return;
        }
        // Clean the URL and go
        window.location.replace(next);
      } catch (e) {
        window.location.replace(
          `/login?error=${encodeURIComponent(String(e))}`,
        );
      }
    })();
  }, [next]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 text-center">
      <div>
        <div className="mb-2 font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-3">
          Coolshi
        </div>
        <div className="font-display text-[18px] font-medium text-ink">
          {message}
        </div>
      </div>
    </div>
  );
}
