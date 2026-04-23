"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";

export async function signInWithMagicLink(
  email: string,
  next: string,
): Promise<{ error?: string } | void> {
  const supabase = await getServerSupabase();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : "";
  const redirectTo = base
    ? `${base}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("allow list") || msg.includes("allow_list")) {
      return { error: "This email isn't on the allow list. Ask Marwan to add it." };
    }
    return { error: error.message };
  }

  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}

export async function signOut(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
