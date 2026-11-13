/*
# Seed Koton discovery source

1. Changes
- Adds the Koton brand.
- Adds the Dış Giyim category.
- Adds the Koton women's outerwear source URL.

2. Security
- Uses existing RLS policies.
- The source is readable publicly, but only an admin can edit it.

3. Idempotency
- Existing rows with the same slug or URL are reused rather than duplicated.
*/

INSERT INTO brands (name, slug, website_url, is_active)
VALUES ('Koton', 'koton', 'https://www.koton.com', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, is_active)
VALUES ('Dış Giyim', 'dis-giyim', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sources (name, brand_id, category_id, source_url, scraping_method, scan_interval_hours, is_active)
SELECT 'Koton Kadın Dış Giyim', b.id, c.id, 'https://www.koton.com/kadin-dis-giyim/', 'html', 12, true
FROM brands b CROSS JOIN categories c
WHERE b.slug = 'koton' AND c.slug = 'dis-giyim'
AND NOT EXISTS (SELECT 1 FROM sources WHERE source_url = 'https://www.koton.com/kadin-dis-giyim/');
