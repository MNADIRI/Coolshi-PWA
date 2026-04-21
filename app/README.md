# Coolshi — PWA

Next.js 15 App Router, TypeScript strict, Tailwind, Framer Motion, `@supabase/ssr`, `next-pwa`.

## Dev

```bash
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# Keep NEXT_PUBLIC_USE_FIXTURES=1 until Supabase is populated
npm install
npm run dev
```

Open `http://localhost:3000/feed`.

## Routes

| Path | Role |
|---|---|
| `/feed` | Active batch, swipe stack |
| `/brief` | Markdown editor for the active brief |
| `/library` | Past batches + recent cards |
| `/api/feedback` | POST `{card_id, signal, dwell_ms}` |

## Fixtures vs Supabase

`NEXT_PUBLIC_USE_FIXTURES=1` renders 10 sample cards from `src/lib/fixtures/cards.ts` without hitting Supabase. Feedback POSTs are no-ops in this mode.

`NEXT_PUBLIC_USE_FIXTURES=0` reads the most recent batch from `feed_cards` and records feedback to the `feedback` table.

## Design

All tokens in `src/styles/tokens.css`. Single `Card` component in `src/components/card/card.tsx` — no variants except the deep-dive badge.

Fonts: Inter for body, Inter 500 as the display stand-in. Drop a real `GeneralSans-Medium.woff2` into `public/fonts/` and swap `layout.tsx` to use `next/font/local` when you're ready.

## PWA

- `public/manifest.json` + iOS meta in `layout.tsx`
- `next-pwa` config in `next.config.mjs` (NetworkFirst for `/api`, CacheFirst for static)
- Export `public/icons/icon.svg` to PNG before deploying — see `public/icons/README.md`

## Deploy

Vercel free tier. Import the repo, set root to `app/`, add the env vars. Production build:

```bash
npm run build
npm run start
```
