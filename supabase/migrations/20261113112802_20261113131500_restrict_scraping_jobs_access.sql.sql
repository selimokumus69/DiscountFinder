/*
# Restrict scraping job access

1. Change
- Removes broad Data API privileges from anon and authenticated users.
- Keeps authenticated SELECT access for admin users through the existing RLS policy.
- Keeps service_role full access for the scraper worker.

2. Security
- Scraping job history is operational/admin data, not public catalog data.
- Normal authenticated users cannot insert, update, or delete job records.
- Anonymous users cannot read or modify job records.
*/

REVOKE ALL ON public.scraping_jobs FROM anon, authenticated;
GRANT SELECT ON public.scraping_jobs TO authenticated;
GRANT ALL ON public.scraping_jobs TO service_role;
