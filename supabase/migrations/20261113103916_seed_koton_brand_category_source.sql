/*
# Seed Koton brand, Dış Giyim category, and Koton source

1. Purpose
- The mobile app shows 0 products because all reference tables are empty.
- This migration seeds the minimum data needed to start scraping Koton:
  - A "Koton" brand
  - A "Dış Giyim" (outerwear) category
  - A source linking to Koton's women's outerwear page
- The scrape-koton edge function requires a source_id to run, and the source
  needs brand_id and category_id to populate products correctly.

2. New Data
- brands: "Koton" row (id is auto-generated)
- categories: "Dış Giyim" row (id is auto-generated)
- sources: Koton source row referencing the brand and category above

3. Security
- No RLS or policy changes. Existing policies already allow:
  - anon + authenticated SELECT on all three tables (public read)
  - admin-only INSERT/UPDATE/DELETE via profiles role check
- service_role has full grants on all tables (used by edge function)

4. Idempotency
- Uses ON CONFLICT DO NOTHING on unique slug columns to be safe to re-run.
- The source is inserted with explicit brand_id and category_id from the
  CTE results, so re-runs won't create duplicates.
*/

INSERT INTO brands (name, slug, website_url, is_active)
VALUES ('Koton', 'koton', 'https://www.koton.com', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, is_active)
VALUES ('Dış Giyim', 'dis-giyim', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (name, brand_id, category_id, source_url, scraping_method, scan_interval_hours, is_active)
SELECT
  'Koton Kadın Dış Giyim',
  b.id,
  c.id,
  'https://www.koton.com/kadin-dis-giyim/',
  'html',
  12,
  true
FROM brands b, categories c
WHERE b.slug = 'koton' AND c.slug = 'dis-giyim'
AND NOT EXISTS (
  SELECT 1 FROM sources s WHERE s.source_url = 'https://www.koton.com/kadin-dis-giyim/'
);
