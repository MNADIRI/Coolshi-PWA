-- supabase/setup-pg-cron.sql
-- Run-once setup that wires the release-and-notify cron.
--
-- Migration 0003_release_notify_setup.sql enabled pg_cron + pg_net and added
-- pending_runs.notified_at. This file does the operational setup that can't
-- live in a migration (the secret value would leak into git history).
--
-- WHO RUNS THIS: applied directly via the Supabase MCP `execute_sql` from
-- the Claude session that owns CRON_SECRET. Keep this file as a reproducible
-- record of what was done.

-- 1. Store the shared secret in Vault. Same value as Vercel env CRON_SECRET.
--    Replace <SECRET> with the actual value before running.
SELECT vault.create_secret(
  '<SECRET>',
  'cron_secret',
  'Shared bearer token used by pg_cron to authenticate against Vercel /api/cron/* routes. Same value as Vercel env CRON_SECRET.'
);

-- 2. Schedule the cron. Hits the Vercel route every 5 minutes; the route
--    handles deduplication via pending_runs.notified_at, so this is safe
--    to over-call.
SELECT cron.schedule(
  'release-and-notify',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://coolshi-orpin.vercel.app/api/cron/release-and-notify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_secret' LIMIT 1
      )
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- Inspect afterwards:
--   SELECT * FROM cron.job;                    -- one row per schedule
--   SELECT * FROM cron.job_run_details         -- recent firings
--     ORDER BY start_time DESC LIMIT 10;
--   SELECT id, status, status_code, error_msg  -- pg_net request log
--     FROM net._http_response ORDER BY id DESC LIMIT 5;
