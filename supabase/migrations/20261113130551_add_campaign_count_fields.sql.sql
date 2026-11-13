/*
# Add campaign count fields to scraping_jobs and scan_logs

## Changes
- scraping_jobs: add campaigns_found, campaigns_added, campaigns_updated (int, default 0)
- scan_logs: add campaigns_found, campaigns_added, campaigns_updated (int, default 0)

## Notes
- Non-destructive: columns are ADD COLUMN IF NOT EXISTS
- Default 0 so existing rows are unaffected
*/
ALTER TABLE public.scraping_jobs
  ADD COLUMN IF NOT EXISTS campaigns_found integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_added integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_updated integer NOT NULL DEFAULT 0;

ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS campaigns_found integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_added integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_updated integer NOT NULL DEFAULT 0;