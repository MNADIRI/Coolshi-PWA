# Coolshi

> **Sibling repo: `twobatch` (iOS app)**
>
> A separate iOS-native React Native (Expo) app called **twobatch** is a
> second client of this same backend. It is **not** a rewrite of Coolshi —
> Coolshi keeps running as the web/PWA surface and the agentic routine.
>
> What is shared between the two repos:
> - `supabase/` — schema, migrations, seed, pg_cron setup
> - `routines/coolshi-briefing/` — the Claude Code routine (kept named
>   `coolshi-briefing` so the deployed Anthropic trigger doesn't break)
>
> **Any change to `supabase/` or `routines/` here MUST be mirrored to the
> twobatch repo** (or applied via Supabase MCP, which is shared). See
> [`MIGRATION_NOTES.md`](./MIGRATION_NOTES.md) for the inventory of
> what's shared, what's Coolshi-only, and what's being ported.
>
> twobatch repo: <TBD — Marwan creates the GitHub remote and fills this in>.

---

Personal agentic news aggregator. Three active components:

- **`app/`** — Next.js 15 PWA (Vercel)
- **`worker/`** — Python worker for Tier C/D connectors (macOS + launchd)
- **`routines/coolshi-briefing/`** — Claude Code Routine for curation

Backed by Supabase (free tier, Postgres + pgvector). Single user, RLS off.

See the full spec (paste into Notion or keep locally) for design rationale. This README is the minimum path from clone to running briefings.

---

## Phase 1 — Frontend + Database

### 1. Supabase

Create a free-tier project at [supabase.com](https://supabase.com). In the SQL editor:

1. Paste `supabase/schema.sql` → Run
2. Paste `supabase/seed.sql` → Run (gives you an initial brief to edit)

Copy the project URL and `anon` key from Project Settings → API.

### 2. PWA

```bash
cd app
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# Leave NEXT_PUBLIC_USE_FIXTURES=1 for the first run
npm install
npm run dev
```

Open `http://localhost:3000/feed`. Swipe through the 10 fixture cards. Once you've confirmed the UX, set `NEXT_PUBLIC_USE_FIXTURES=0` to read from Supabase.

See [`app/README.md`](app/README.md) for deploy instructions (Vercel).

---

## Phase 2 — Worker on macOS

The worker runs on your Mac, fetches Tier C/D sources (Instagram, LinkedIn, paywalled press, Elsevier), and pushes `raw_items` to Supabase every 2h.

### Install

```bash
cd worker
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Bootstrap a source (one time per connector)

```bash
python bootstrap.py --source instagram
# A Chromium window opens. Log in. Close the window.
# Session state is encrypted and stored in storage/sessions/instagram.enc.json.
# A row is inserted into the `sources` table.
```

### Install launchd agent

```bash
bash bin/install-launchd.sh
launchctl list | grep coolshi   # should show a PID
tail -f logs/worker.log
```

See [`worker/README.md`](worker/README.md) for connector details, session expiry handling, and debug tips.

---

## Phase 3 — Claude Code Routine

The Routine runs on Anthropic infrastructure twice a day (`0 7,12 * * *`), reads `raw_items` via MCP Supabase, does WebSearch/WebFetch for coverage gaps, and writes up to 30 `feed_cards` per batch.

### Install

```bash
mkdir -p ~/.claude/routines
cp -r routines/coolshi-briefing ~/.claude/routines/
```

### Configure MCP

Claude Code settings need:

- **Supabase MCP** — with your project's `SERVICE_ROLE_KEY` (not the anon key — the Routine needs write access)
- **Gmail MCP** — Google OAuth
- **Notion MCP** — Notion integration token
- **ArXiv / PubMed MCPs** — if you want scientific coverage

See [Claude Code docs](https://docs.claude.com/en/docs/claude-code/mcp) for MCP server configuration.

### Run manually first

```bash
claude routine run coolshi-briefing
```

Verify:

```sql
select count(*) from feed_cards where batch_id = (
  select batch_id from feed_cards order by created_at desc limit 1
);
select * from agent_runs order by started_at desc limit 1;
```

Then set up the cron schedule (via your routine config or `claude routine schedule`).

Refresh `/feed` in the PWA — cards from the new batch render.

---

## Repository layout

```
/
├── app/                    Next.js 15 PWA (Vercel)
├── worker/                 Python worker (macOS + launchd)
├── routines/
│   └── coolshi-briefing/   Claude Code Routine
├── supabase/
│   ├── schema.sql          DB schema
│   └── seed.sql            Default brief
└── README.md               This file
```

Credentials never enter this repo. All live in `.env.local` (ignored), the macOS Keychain (session encryption keys), and Claude Code's MCP config.
