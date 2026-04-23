import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  return <LoginPageInner searchParamsPromise={searchParams} />;
}

async function LoginPageInner({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  const { next, sent, error } = await searchParamsPromise;

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
          You&rsquo;ll receive a one-time link. No password, no signup screen.
        </p>
      </div>

      {sent ? (
        <div className="rounded-card border border-divider bg-paper px-5 py-6 text-center">
          <div className="mb-1 font-display text-[18px] font-medium tracking-[-0.02em] text-ink">
            check your inbox
          </div>
          <p className="font-text text-[13px] leading-[1.5] text-ink-3 [text-wrap:pretty]">
            A magic link is on its way. Tap it from this device and you&rsquo;re in.
          </p>
        </div>
      ) : (
        <LoginForm next={next ?? "/feed"} initialError={error ?? null} />
      )}
    </div>
  );
}
