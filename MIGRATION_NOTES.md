# Migration notes — Coolshi → twobatch (iOS sibling)

This document inventories what stays in this repo (`Coolshi`), what is
shared with the new iOS app (`twobatch`), what is being ported, what is
being rewritten, and what is brand-new for iOS only. It is the contract
between the two repos.

**Status legend**

| Status | Meaning |
|---|---|
| **shared** | Lives in both repos, must stay byte-for-byte identical. Any change here must be mirrored to the other repo (or applied via Supabase MCP, which is the same backend project for both). |
| **coolshi-only** | PWA-specific. Stays in this repo, has no twobatch counterpart. |
| **port** | Logic is portable to twobatch with small/medium adaptation (Next.js → Expo, Tailwind → nativewind, Radix → Gorhom, etc.). The names of components, types, and functions are kept identical to ease cross-repo diff. |
| **rewrite** | Concept survives, implementation is fundamentally different on iOS (web push → APNs, Radix Dialog → BottomSheet, etc.). Don't try to share code; share the contract. |
| **new** | Pure twobatch addition, has no Coolshi equivalent at all. |

---

## Inventory

### Backend (shared)

| Path | Status | Justification |
|---|---|---|
| `supabase/schema.sql` | shared | Single source of truth for the DB shape. Both clients read it. |
| `supabase/migrations/0001..0005_*.sql` | shared | Applied to the same Supabase project. Mirror new migration files into the twobatch repo as they're added; apply once via MCP. |
| `supabase/seed.sql` | shared | Default brief / starter data. |
| `supabase/setup-pg-cron.sql` | shared | Reproducible record of the Vault secret + pg_cron schedules. |
| `routines/coolshi-briefing/` | shared | The Claude Code routine. **Keep the directory name `coolshi-briefing` even in the twobatch repo** — the deployed Anthropic remote trigger (`trig_01MgjazPFP9o7YN9p8y98jKB`) is bound to that name. Renaming would break production. |

### Coolshi-only (stays here, no twobatch port)

| Path | Status | Justification |
|---|---|---|
| `app/src/app/**` (all Next.js routes) | coolshi-only | App Router pages are web-specific. iOS uses React Navigation screens. |
| `app/src/app/c/[slug]/page.tsx` | coolshi-only | Public sharing surface — explicit choice to keep it as a web URL even after iOS launches (sharable, indexable, OG previews). |
| `app/src/app/api/og/card/[slug]/route.tsx` | coolshi-only | Open Graph image route for the public sharing surface. iOS doesn't need this. |
| `app/src/app/api/cron/**` | coolshi-only | Cron HTTP endpoints (fire-routine, release-and-notify, retry-orchestrator). Called by pg_cron, not by clients. |
| `app/src/app/api/batch/route.ts` | coolshi-only (web) | Manual batch trigger from PWA. iOS will have its own equivalent (RPC or Edge Function). |
| `app/src/app/api/save/route.ts` | coolshi-only (web) | The mobile client will call Supabase directly via JS client; no need to proxy through Next.js. |
| `app/src/app/api/feedback/route.ts` | coolshi-only (web) | Same — direct Supabase call from mobile. |
| `app/src/app/api/push/subscribe/route.ts` | coolshi-only | Web Push subscription endpoint. iOS uses APNs — separate flow. |
| `app/src/middleware.ts` | coolshi-only | Next.js auth/redirect middleware. iOS gates on Supabase session in-app. |
| `app/src/app/layout.tsx`, `app/src/app/page.tsx` | coolshi-only | Web app shell. iOS replaces with React Navigation root. |
| `app/public/**` | coolshi-only | PWA assets: manifest, icons, OG sky PNGs, fonts, service-worker fallbacks. iOS has its own asset bundle. |
| `app/worker/index.js` | coolshi-only | Custom service worker for next-pwa. |
| `app/next.config.mjs` | coolshi-only | next-pwa config. |
| `app/vercel.json` | coolshi-only | Vercel-specific. |
| `app/scripts/generate-sky-pngs.mjs` | coolshi-only | Generates the sky background PNGs used by the OG route. iOS draws the sky natively (LinearGradient), no PNG needed. |
| `worker/**` (root-level Python worker) | coolshi-only | macOS + launchd ingestion of Tier C/D connectors. Lives on Marwan's Mac, not in any client app. |

### Port (logic carries over, implementation adapted)

| Path / item | Status | Justification |
|---|---|---|
| `app/src/lib/supabase/database.types.ts` | port (verbatim copy) | Type contract for the DB. Identical in both repos. |
| `app/src/lib/card-format.ts` | port (verbatim copy) | Pure TypeScript, no DOM. `CardView`, `toCardView`, etc. |
| `app/src/lib/url.ts` | port (verbatim copy) | `hostnameOf` helper, framework-agnostic. |
| `app/src/lib/fixtures/cards.ts` | port (verbatim copy) | Fixture data for fixture-mode dev. |
| `app/src/components/card/cards.tsx` (FeedItem) | port | Move to RN: View/Pressable instead of `<article onClick>`, replace HeroMedia source. |
| `app/src/components/card/hero-media.tsx` | port | Wrap an Image (with hero) or a sky gradient (fallback). Same prop signature. |
| `app/src/components/card/primitives.tsx` (Caption, Sources) | port | Pure presentation. Tailwind classes → nativewind classes. |
| `app/src/components/card/card-body.tsx` | port | Same structure (hero, sources line, paragraphs, divergence, source list). |
| `app/src/components/screens/feed-screen.tsx` | port | Continuous-scroll feed, batches, end message, "show previous batches" button. Logic identical; uses RN ScrollView / FlatList. |
| `app/src/components/screens/brief-screen.tsx` | port | Form fields → RN TextInput/Picker. Save action calls Supabase directly (no server action). |
| `app/src/components/screens/saved-screen.tsx` | port | List + tap-to-open. |
| `app/src/components/screens/curation-animation.tsx` | port | Framer Motion → react-native-reanimated v3. |
| `app/src/styles/tokens.css` | port (transform) | Becomes `theme/tokens.ts` — same names (`canvas`, `ink`, `ink-2`, etc.) consumed by nativewind. |

### Rewrite (concept stays, implementation differs)

| Item | Status | Justification |
|---|---|---|
| Auth flow | rewrite | Web: Supabase magic link via cookies + `signInWithOtp`. iOS: Sign in with Apple via `expo-apple-authentication` + `signInWithIdToken`, plus magic-link fallback over deep links (`twobatch://auth/callback`). |
| Push notifications | rewrite | Web: VAPID + `web-push` lib + Service Worker. iOS: APNs token via `expo-notifications` + Edge Function dispatcher that signs with .p8 and sends. The `push_subscriptions` table needs a `platform` column (migration `0006_push_subscriptions_platform.sql`, **shared change**). |
| Sharing | rewrite | Web: `navigator.share` + `/api/og/card/[slug]` PNG. iOS: native `UIActivityViewController` via `expo-sharing`, with the rendered card grabbed from the PWA's OG endpoint OR generated locally by `react-native-view-shot`. |
| `app/src/components/card/reading-modal.tsx` (Radix Dialog) | rewrite | iOS: `@gorhom/bottom-sheet` `BottomSheetModal` with snap points. Drag-to-close is native. |
| `app/src/components/shell/tab-pager.tsx` (CSS transforms + touch) | rewrite | iOS: `createMaterialTopTabNavigator` from React Navigation. Native swipe + animation. |
| `app/src/components/sky/sky.tsx` (CSS multi-radial gradient + JS slice math) | rewrite | iOS v1: a single continuous `LinearGradient` background behind the feed; the per-card "sky window" effect is dropped to v2 (would need Skia). Documented as a deliberate visual regression. |
| `app/src/components/screens/batch-trigger.tsx` | rewrite | iOS: same UI shell BUT becomes the host of the AppLovin "two batch" unlock flow (see "new" rows below). |
| `app/src/lib/og-image.ts` | rewrite | Currently a server-side scraper. iOS doesn't need it; if iOS needs a hero image fallback, derive client-side or call the existing PWA endpoint over HTTPS. |
| `app/src/lib/auth.ts` | rewrite | No cookies; read session via Supabase mobile client. |
| `app/src/lib/push.ts` | rewrite | Web-push fan-out → APNs JWT signer in an Edge Function (or two Edge Functions: one for web, one for APNs, both reading from `push_subscriptions`). |

### New (no Coolshi equivalent)

| Item | Status | Justification |
|---|---|---|
| Sign in with Apple integration | new | iOS-only auth path; Apple credentials are dedicated to the twobatch bundle ID. |
| APNs delivery (Edge Function) | new | New `applovin-reward-callback`-style Supabase Edge Function dispatches APNs payloads using a .p8 key signed JWT. |
| AppLovin MAX SDK + config plugin | new | The "two batch" mechanism. Native pods, custom Expo config plugin under `plugins/withAppLovin.js`. |
| `lib/ads/applovin.ts` | new | TS wrapper: `initializeAds()`, `loadRewardedAd()`, `showRewardedAd()`. |
| Ad unlocks data layer | new | New tables `ad_unlocks` + `ad_progress` (migration `0007_ad_unlocks.sql`, shared change applied via MCP). RLS forbids client inserts; an Edge Function `applovin-reward-callback` validates the AppLovin S2S signature and grants unlocks. |
| ATT (App Tracking Transparency) prompt | new | Required by Apple before personalised ads. Asked just before the first ad session. |
| Privacy Manifest (`PrivacyInfo.xcprivacy`) | new | Apple 2024 requirement. Lists AppLovin + mediation partners and required-reason API uses. |
| EAS build/release pipeline | new | `eas.json` profiles (development / preview / production), TestFlight, App Store Connect entry dedicated to twobatch. |
| Universal Links coordination | new | `apple-app-site-association` hosted on the PWA's domain, scoped so `https://<coolshi-domain>/c/{slug}` opens twobatch when installed. **Cross-repo coordination needed.** |
| Daily unlock cap (8/day → 16 ads max) | new | Soft addiction cap + cost guard (each unlock fires the routine, which is paid agentic compute). |

---

## Open questions for Marwan

1. **Bundle identifier**: `app.twobatch` vs `com.<owner>.twobatch`. Must match the App Store Connect entry and the Apple Sign-In Service ID.
2. **Domain for Universal Links**: does twobatch get its own domain (`twobatch.app`?) or share `coolshi.app`? Affects where `apple-app-site-association` is hosted and what's set in OG metadata.
3. **Coolshi PWA sunset path**: keep `/feed`, `/brief`, `/saved` indefinitely vs redirect to App Store after iOS launches? Documented as a decision to take in Phase 10.
4. **Repo location for twobatch**: confirmed sibling of `coolshi/` directory (i.e. `~/coolshi/`'s parent gets a new `~/twobatch/`)?
5. **GitHub owner for twobatch repo**: same as `MNADIRI/Coolshi-PWA`, or a new account? Affects the bundle ID suggestion above.

---

## Sync rules between the two repos

- **Backend changes** (`supabase/`) — apply once via Supabase MCP (the live DB is the same project for both clients). Mirror the migration `.sql` file into both repos.
- **Routine changes** (`routines/coolshi-briefing/`) — update the SKILL.md AND the deployed remote trigger via `RemoteTrigger update` (see memory file `coolshi_routine_deployment.md`). Mirror the SKILL.md file into both repos.
- **Shared library code** (`lib/card-format.ts`, `lib/url.ts`, `lib/fixtures/cards.ts`, `lib/supabase/database.types.ts`) — update in Coolshi first, then run `scripts/sync-shared.sh` in twobatch (created in Phase 10) to copy over.
- **Migrations** affecting tables both clients use (e.g. `push_subscriptions`, `ad_unlocks`) — apply via MCP, mirror SQL into both repos.
