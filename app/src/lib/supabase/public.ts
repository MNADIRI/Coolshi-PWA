import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Anonymous, sessionless client for the public sharing surface (/c/[slug]).
// Skips cookies → role is always `anon`, regardless of who's visiting.
// This pairs with the `feed_cards_public_select` RLS policy.
export function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
