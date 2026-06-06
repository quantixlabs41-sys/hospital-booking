-- ============================================================
-- MEDIBOOK — Scheduled Reminder Cron Job
-- Runs the send-reminders Edge Function every 30 minutes.
-- Requires pg_cron extension enabled in Supabase.
-- Run in: Supabase SQL Editor
-- ============================================================

-- Enable pg_cron if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the reminder function to run every 30 minutes
SELECT cron.schedule(
  'medibook-send-reminders',          -- unique job name
  '*/30 * * * *',                     -- every 30 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove the job:
-- SELECT cron.unschedule('medibook-send-reminders');
