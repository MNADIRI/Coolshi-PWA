-- 0003_release_notify_setup.sql
-- Push notifications for scheduled batch deliveries.
--
-- The fire-routine cron runs the agent ~1h before delivery. The agent stores
-- cards with delivered_at = user's delivery time (UTC), so they're hidden
-- from the feed until that moment (passive filter on /feed). This migration
-- adds the missing piece: a proactive push at delivery time.
--
-- Architecture (Vercel Hobby — only 2 daily crons allowed):
--   pg_cron (every 5 min)
--     → pg_net.http_post → /api/cron/release-and-notify
--       → finds pending_runs.completed AND notified_at IS NULL with cards
--         where delivered_at <= now()
--       → atomically claims and sends push via notifyUser()
--
-- Applied via Supabase MCP as `release_notify_setup`.
-- The pg_cron schedule itself is set up by supabase/setup-pg-cron.sql
-- (run once after the route is deployed and CRON_SECRET is in Vercel + Vault).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE pending_runs
  ADD COLUMN notified_at timestamptz NULL;

COMMENT ON COLUMN pending_runs.notified_at IS
  'Set by /api/cron/release-and-notify when push has been sent for this run''s batch. NULL until then. Atomic claim via UPDATE WHERE notified_at IS NULL.';
