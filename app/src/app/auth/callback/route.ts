import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type OtpType = "magiclink" | "signup" | "invite" | "recovery" | "email_change" | "email";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/feed";
  const safeNext = next.startsWith("/") ? next : "/feed";
  const supabase = await getServerSupabase();

  // Path A: PKCE — ?code=…
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
      );
    }
    return NextResponse.redirect(new URL(safeNext, url));
  }

  // Path B: OTP token_hash — ?token_hash=…&type=magiclink|email|signup
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as OtpType;
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url),
      );
    }
    return NextResponse.redirect(new URL(safeNext, url));
  }

  // Path C: implicit flow — tokens are in #hash, only visible client-side.
  // Punt to a small client page that extracts the hash and calls
  // supabase.auth.setSession, then redirects.
  return NextResponse.redirect(
    new URL(`/auth/hash?next=${encodeURIComponent(safeNext)}`, url),
  );
}
