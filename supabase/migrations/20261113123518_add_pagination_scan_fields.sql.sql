ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS pages_scanned integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicates_skipped integer NOT NULL DEFAULT 0;

ALTER TABLE public.scraping_jobs
  ADD COLUMN IF NOT EXISTS pages_scanned integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicates_skipped integer NOT NULL DEFAULT 0;