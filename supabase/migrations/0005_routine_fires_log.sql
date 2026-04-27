-- 0005_routine_fires_log.sql
-- Audit log of every POST to the Anthropic remote trigger.
-- Used by retry-orchestrator to enforce a daily quota cap (default 15/day,
-- configurable via Vercel env ROUTINE_DAILY_QUOTA) — Anthropic remote
-- triggers have a per-day rate limit and burning through it on retries
-- of stale runs is wasteful.
--
-- All three trigger callers must INSERT a row here:
--   - fire-routine (cron)
--   - retry-orchestrator (cron)
--   - manual-batch (user pulls to refresh)
--   - onboarding (first batch on brief save)
-- Use lib/routine-fire.ts:fireRoutineTrigger() so this happens automatically.
--
-- Applied via Supabase MCP as `routine_fires_log`.

CREATE TABLE routine_fires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_run_id uuid REFERENCES pending_runs(id) ON DELETE SET NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('fire-routine', 'retry-orchestrator', 'manual-batch', 'onboarding')),
  http_status int,
  ok boolean
);

CREATE INDEX routine_fires_fired_at_idx ON routine_fires(fired_at DESC);
CREATE INDEX routine_fires_source_idx ON routine_fires(source, fired_at DESC);

COMMENT ON TABLE routine_fires IS
  'Append-only log of trigger POSTs. Powers the daily quota check in retry-orchestrator and gives a precise picture of where the day''s budget went.';
