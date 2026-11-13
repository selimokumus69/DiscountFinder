/*
# Add durable scraping job tracking and source uniqueness

1. New table
- scraping_jobs.id: unique scan job identifier.
- scraping_jobs.source_id: source being scanned.
- scraping_jobs.status: running, success, or failed.
- scraping_jobs.request_url: URL recorded for auditability.
- scraping_jobs.products_found: products parsed from the source.
- scraping_jobs.products_added: newly inserted products.
- scraping_jobs.products_updated: existing products refreshed.
- scraping_jobs.error_message: safe operational error detail for administrators.
- scraping_jobs.started_at and completed_at: scan timing.

2. Existing data
- Existing scan_logs and products are preserved.
- The source URL receives a case-insensitive unique index so the same URL
  cannot be added twice.

3. Security
- RLS is enabled on scraping_jobs.
- Only authenticated administrators can read job records.
- The service_role used by the scraper can create and update jobs.
- No public or anonymous access is granted.
*/

CREATE TABLE IF NOT EXISTS public.scraping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  request_url text NOT NULL,
  products_found integer NOT NULL DEFAULT 0,
  products_added integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS scraping_jobs_source_idx ON public.scraping_jobs (source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS scraping_jobs_started_idx ON public.scraping_jobs (started_at DESC);

ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.scraping_jobs TO authenticated;
GRANT ALL ON public.scraping_jobs TO service_role;

DROP POLICY IF EXISTS "scraping_jobs_admin_read" ON public.scraping_jobs;
CREATE POLICY "scraping_jobs_admin_read"
ON public.scraping_jobs FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS sources_source_url_unique_idx
ON public.sources (lower(source_url));
