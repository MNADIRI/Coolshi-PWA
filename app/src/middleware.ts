import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/auth/callback",
  "/auth/hash",
  "/auth/signout",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
  "/favicon.ico",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/workbox-")) return true;
  if (pathname.startsWith("/worker-")) return true;
  if (pathname.startsWith("/fallback-")) return true;
  if (pathname === "/") return true; // redirects to /feed which enforces auth
  return false;
}

export async function middleware(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === "1") {
    return NextResponse.next();
  }
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(redirect);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api/cron/|_next/|icons/|workbox-|worker-|fallback-|sw\\.js|manifest\\.json|offline\\.html|favicon\\.ico).*)"],
};
