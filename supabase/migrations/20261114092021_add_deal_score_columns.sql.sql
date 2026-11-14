/*
# Add Deal Score columns to products table

## Purpose
Adds Fırsat Skoru (Deal Score) system columns to the existing products table.
This enables a 0-100 score that ranks how good a product's current price is,
based on historical price data, discount percentage, price drop velocity,
campaign bonuses, and popularity (favorites count).

## New Columns on `products`
1. `deal_score` (integer, default 0) — 0-100 overall deal score
2. `deal_rating` (text, default 'unknown') — categorical rating: legendary | excellent | good | average | bad | unknown
3. `lowest_price_30d` (numeric, nullable) — lowest price in last 30 days
4. `lowest_price_90d` (numeric, nullable) — lowest price in last 90 days
5. `avg_price_30d` (numeric, nullable) — average price in last 30 days
6. `avg_price_90d` (numeric, nullable) — average price in last 90 days
7. `favorite_count` (integer, default 0) — number of users who favorited this product
8. `last_price_drop_at` (timestamptz, nullable) — when the price last dropped
9. `deal_calculated_at` (timestamptz, nullable) — when deal_score was last computed

## Security
- No new tables created.
- No RLS policy changes — products table already has existing policies.
- No grant changes needed — columns are added to an existing table with existing grants.
- service_role already has access to products table.

## Important Notes
1. All columns are nullable or have safe defaults so existing rows are not affected.
2. The `deal_rating` CHECK constraint ensures only valid rating values are stored.
3. An index on `deal_score` enables efficient sorting by deal score in the UI.
4. The edge function `recalculate-deal-scores` will populate these columns.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deal_score') THEN
    ALTER TABLE products ADD COLUMN deal_score integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deal_rating') THEN
    ALTER TABLE products ADD COLUMN deal_rating text NOT NULL DEFAULT 'unknown'
      CHECK (deal_rating IN ('legendary', 'excellent', 'good', 'average', 'bad', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'lowest_price_30d') THEN
    ALTER TABLE products ADD COLUMN lowest_price_30d numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'lowest_price_90d') THEN
    ALTER TABLE products ADD COLUMN lowest_price_90d numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'avg_price_30d') THEN
    ALTER TABLE products ADD COLUMN avg_price_30d numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'avg_price_90d') THEN
    ALTER TABLE products ADD COLUMN avg_price_90d numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'favorite_count') THEN
    ALTER TABLE products ADD COLUMN favorite_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'last_price_drop_at') THEN
    ALTER TABLE products ADD COLUMN last_price_drop_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deal_calculated_at') THEN
    ALTER TABLE products ADD COLUMN deal_calculated_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_deal_score_idx ON products (deal_score DESC);
CREATE INDEX IF NOT EXISTS products_deal_rating_idx ON products (deal_rating);
