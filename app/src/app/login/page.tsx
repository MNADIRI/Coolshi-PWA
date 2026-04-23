import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-stretch justify-center px-6 pb-10 pt-10">
      <div className="mb-8 text-center">
        <div className="mb-2 font-text text-[10.5px] font-semibold uppercase tracking-[0.24em] text-ink-2">
          Coolshi
        </div>
        <h1 className="font-display text-[28px] font-medium leading-[1.15] tracking-[-0.03em] text-ink [text-wrap:balance]">
          enter your email to get in
        </h1>
        <p className="mt-3 font-text text-[13px] leading-[1.5] text-ink-3 [text-wrap:pretty]">
          You&rsquo;ll receive a 6-digit code. No password, no signup screen.
        </p>
      </div>

      <LoginForm next={next ?? "/feed"} initialError={error ?? null} />
    </div>
  );
}
