/*
# Add Campaign Fingerprint for Deduplication

## Purpose
The same campaign (e.g. "KTN30 kodu ile %30 indirim") appears on multiple Koton
category pages and is being saved as separate rows each time. This migration:
1. Adds a `fingerprint` text column to `campaigns` for deterministic deduplication.
2. Adds a unique index on `fingerprint` so concurrent scans can't create duplicates.
3. Computes fingerprints for all existing campaigns.
4. Merges duplicate campaigns: picks a canonical row, transfers any campaign_products
   links to it, then removes the duplicate rows.
5. Adds a `scope` text column to track campaign scope (site_wide, category, products, unknown).

## Fingerprint Logic
Built from: brand_id, coupon_code (normalized upper), discount_type, discount_value,
minimum_order_amount, and a normalized title (lowercased, stripped of punctuation/whitespace).
When coupon_code is present, it's the primary key — two campaigns with the same code
and brand are the same campaign regardless of title. When no coupon_code, the normalized
title + discount_value + minimum_order_amount distinguishes campaigns.

## Security
- No RLS policy changes needed (campaign_products already has anon SELECT + authenticated CUD).
- service_role already has access via grant.
*/

-- 1. Add fingerprint column
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scope text DEFAULT 'unknown';

-- 2. Backfill fingerprints for existing rows
UPDATE campaigns SET fingerprint =
  COALESCE(brand_id::text, 'no-brand') || '|' ||
  COALESCE(UPPER(TRIM(coupon_code)), 'no-code') || '|' ||
  COALESCE(discount_type, 'other') || '|' ||
  COALESCE(discount_value::text, '0') || '|' ||
  COALESCE(minimum_order_amount::text, '0') || '|' ||
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^\w\s%]', ' ', 'g'), '\s+', ' ', 'g'))
WHERE fingerprint IS NULL;

-- 3. Merge duplicates: for each fingerprint group with >1 row,
--    keep the oldest row (canonical), move campaign_products to it, delete the rest.
DO $$
DECLARE
  dup_row RECORD;
  canonical_id uuid;
BEGIN
  FOR dup_row IN
    SELECT fingerprint, count(*) as cnt
    FROM campaigns
    WHERE fingerprint IS NOT NULL
    GROUP BY fingerprint
    HAVING count(*) > 1
  LOOP
    -- Pick the oldest row as canonical
    SELECT id INTO canonical_id
    FROM campaigns
    WHERE fingerprint = dup_row.fingerprint
    ORDER BY created_at ASC
    LIMIT 1;

    -- Move campaign_products from duplicates to canonical (avoid duplicates)
    UPDATE campaign_products
    SET campaign_id = canonical_id
    WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE fingerprint = dup_row.fingerprint AND id != canonical_id
    )
    AND (campaign_id, product_id) NOT IN (
      SELECT canonical_id, product_id FROM campaign_products WHERE campaign_id = canonical_id
    );

    -- Delete campaign_products that would be exact duplicates (same product_id)
    DELETE FROM campaign_products
    WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE fingerprint = dup_row.fingerprint AND id != canonical_id
    )
    AND product_id IN (
      SELECT product_id FROM campaign_products WHERE campaign_id = canonical_id
    );

    -- Now safely delete the duplicate campaign rows
    DELETE FROM campaigns
    WHERE fingerprint = dup_row.fingerprint AND id != canonical_id;
  END LOOP;
END $$;

-- 4. Add unique index on fingerprint (partial — only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_fingerprint_unique
  ON campaigns (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- 5. Grant service_role access (it bypasses RLS but needs the grant)
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_products TO service_role;
