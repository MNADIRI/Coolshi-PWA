import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars missing in the browser bundle.");
  }
  return createBrowserClient<Database>(url, key);
}
