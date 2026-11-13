/*
# Recompute campaign fingerprints with Turkish-ASCII normalization

The JS normalizeText was stripping Turkish chars differently than SQL, causing duplicates.
This migration:
1. Drops the unique index temporarily
2. Recomputes all fingerprints with consistent Turkish->ASCII normalization
3. Merges duplicates: transfers campaign_products to canonical row, deletes duplicates
4. Recreates the unique index
*/

-- 1. Drop unique index temporarily
DROP INDEX IF EXISTS campaigns_fingerprint_unique;

-- 2. Recompute all fingerprints
UPDATE campaigns SET fingerprint =
  COALESCE(brand_id::text, 'no-brand') || '|' ||
  COALESCE(UPPER(TRIM(coupon_code)), 'no-code') || '|' ||
  COALESCE(discount_type, 'other') || '|' ||
  COALESCE(discount_value::text, '0') || '|' ||
  COALESCE(minimum_order_amount::text, '0') || '|' ||
  LOWER(
    TRIM(
      REGEXP_REPLACE(
        TRANSLATE(
          REGEXP_REPLACE(title, '&[#0-9a-z]+;', ' ', 'gi'),
          'ışğüöçİŞĞÜÖÇ',
          'isguocISGUOC'
        ),
        '[^a-z0-9%s ]',
        ' ',
        'gi'
      )
    )
  );

-- 3. Merge duplicates
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
    SELECT id INTO canonical_id
    FROM campaigns
    WHERE fingerprint = dup_row.fingerprint
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE campaign_products
    SET campaign_id = canonical_id
    WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE fingerprint = dup_row.fingerprint AND id != canonical_id
    )
    AND product_id NOT IN (
      SELECT product_id FROM campaign_products WHERE campaign_id = canonical_id
    );

    DELETE FROM campaign_products
    WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE fingerprint = dup_row.fingerprint AND id != canonical_id
    );

    DELETE FROM campaigns
    WHERE fingerprint = dup_row.fingerprint AND id != canonical_id;
  END LOOP;
END $$;

-- 4. Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_fingerprint_unique
  ON campaigns (fingerprint)
  WHERE fingerprint IS NOT NULL;
