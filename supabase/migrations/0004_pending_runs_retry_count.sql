-- 0004_pending_runs_retry_count.sql
-- Bounded automatic retries for the routine pipeline.
--
-- The retry-orchestrator cron (`/api/cron/retry-orchestrator`, scheduled
-- every 5 min via pg_cron) looks for stuck pending_runs and re-fires the
-- Anthropic trigger up to 3 times before marking the row permanently
-- failed and pushing a "your briefing failed" notification to the user.
--
-- Stuck = any of:
--   - status='processing' AND started_at < now() - interval '15 min'  (orphan)
--   - status='pending' AND created_at < now() - interval '3 min'       (never claimed)
--   - status='failed' AND retry_count < 3 AND completed_at recent      (retryable)
--
-- Applied via Supabase MCP as `pending_runs_add_retry_count`.

ALTER TABLE pending_runs
  ADD COLUMN retry_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN pending_runs.retry_count IS
  'Incremented by /api/cron/retry-orchestrator each time it re-fires a stuck row. Hard cap at 3 — beyond that the row is marked failed permanently and a push is sent.';
