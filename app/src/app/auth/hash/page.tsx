import { HashClient } from "./hash-client";

export const dynamic = "force-dynamic";

export default async function AuthHashPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : "/feed";
  return <HashClient next={safeNext} />;
}
