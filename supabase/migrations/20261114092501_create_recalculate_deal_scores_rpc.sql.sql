/*
# Create recalculate_deal_scores RPC function

Creates a SECURITY DEFINER function that recalculates deal scores for all
active products in a single database round-trip. This avoids the per-product
update latency that caused timeout issues with the edge function approach.

## New Function
- `recalculate_deal_scores()` — computes deal_score, deal_rating, lowest_price_30d,
  lowest_price_90d, avg_price_30d, avg_price_90d, favorite_count, last_price_drop_at,
  and deal_calculated_at for all active products using price_history, favorites, and
  campaign_products data.

## Security
- SECURITY DEFINER: runs with the function owner's privileges (service_role)
- REVOKE EXECUTE from PUBLIC and anon — only authenticated admins can call via the edge function
  (which uses the service role key)
- The edge function handles auth checks before calling this RPC
*/
CREATE OR REPLACE FUNCTION recalculate_deal_scores()
RETURNS TABLE(
  processed integer,
  legendary integer,
  excellent integer,
  good_rating integer,
  average_rating integer,
  bad_rating integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed integer := 0;
  v_legendary integer := 0;
  v_excellent integer := 0;
  v_good integer := 0;
  v_average integer := 0;
  v_bad integer := 0;
  v_now timestamptz := now();
BEGIN
  -- Update deal scores for all active products using price_history aggregates
  WITH price_stats AS (
    SELECT
      ph.product_id,
      MIN(CASE WHEN ph.recorded_at >= v_now - INTERVAL '30 days' THEN ph.price END) AS lowest_30d,
      MIN(CASE WHEN ph.recorded_at >= v_now - INTERVAL '90 days' THEN ph.price END) AS lowest_90d,
      AVG(CASE WHEN ph.recorded_at >= v_now - INTERVAL '30 days' THEN ph.price END) AS avg_30d,
      AVG(CASE WHEN ph.recorded_at >= v_now - INTERVAL '90 days' THEN ph.price END) AS avg_90d,
      (
        SELECT ph2.recorded_at
        FROM price_history ph2
        WHERE ph2.product_id = ph.product_id
        ORDER BY ph2.recorded_at ASC
        LIMIT 1
      ) AS first_recorded,
      (
        SELECT ph3.recorded_at
        FROM price_history ph3
        WHERE ph3.product_id = ph.product_id
          AND ph3.price < (
            SELECT ph4.price
            FROM price_history ph4
            WHERE ph4.product_id = ph3.product_id
              AND ph4.recorded_at < ph3.recorded_at
            ORDER BY ph4.recorded_at DESC
            LIMIT 1
          )
        ORDER BY ph3.recorded_at DESC
        LIMIT 1
      ) AS last_drop_at
    FROM price_history ph
    GROUP BY ph.product_id
  ),
  fav_counts AS (
    SELECT product_id, count(*)::integer AS fav_count
    FROM favorites
    GROUP BY product_id
  ),
  campaign_stats AS (
    SELECT
      cp.product_id,
      bool_or(c.coupon_code IS NOT NULL) AS has_coupon,
      bool_or(c.free_shipping) AS has_free_shipping,
      count(*)::integer AS campaign_count
    FROM campaign_products cp
    JOIN campaigns c ON c.id = cp.campaign_id
    WHERE c.is_active = true
      AND (c.end_date IS NULL OR c.end_date >= v_now)
      AND (c.start_date IS NULL OR c.start_date <= v_now)
    GROUP BY cp.product_id
  ),
  scored AS (
    SELECT
      p.id,
      -- Historical score (0-50): current price vs 90d low
      CASE
        WHEN ps.lowest_90d IS NULL OR ps.lowest_90d <= 0 THEN 0
        WHEN p.current_price <= ps.lowest_90d THEN 50
        ELSE LEAST(50, GREATEST(0, ROUND(50 * (1 - LEAST(1.0, (p.current_price - ps.lowest_90d) / GREATEST(ps.avg_90d - ps.lowest_90d, ps.lowest_90d * 0.5))))))
      END AS historical,
      -- Discount score (0-20)
      CASE
        WHEN p.discount_percentage IS NULL OR p.discount_percentage <= 0 THEN 0
        ELSE LEAST(20, GREATEST(0, ROUND((p.discount_percentage / 50.0) * 20)))
      END AS discount_pts,
      -- Velocity score (0-15)
      CASE
        WHEN ps.last_drop_at IS NULL THEN 0
        WHEN v_now - ps.last_drop_at <= INTERVAL '24 hours' THEN 15
        WHEN v_now - ps.last_drop_at <= INTERVAL '3 days' THEN 12
        WHEN v_now - ps.last_drop_at <= INTERVAL '7 days' THEN 8
        WHEN v_now - ps.last_drop_at <= INTERVAL '30 days' THEN 4
        ELSE 0
      END AS velocity_pts,
      -- Campaign score (0-10)
      CASE
        WHEN cs.campaign_count IS NULL OR cs.campaign_count = 0 THEN 0
        ELSE LEAST(10,
          (CASE WHEN cs.has_coupon THEN 4 ELSE 0 END) +
          (CASE WHEN cs.has_free_shipping THEN 2 ELSE 0 END) +
          LEAST((cs.campaign_count - 1) * 2, 4)
        )
      END AS campaign_pts,
      -- Popularity score (0-5)
      CASE
        WHEN COALESCE(fc.fav_count, 0) >= 200 THEN 5
        WHEN COALESCE(fc.fav_count, 0) >= 100 THEN 4
        WHEN COALESCE(fc.fav_count, 0) >= 50 THEN 3
        WHEN COALESCE(fc.fav_count, 0) >= 25 THEN 2
        WHEN COALESCE(fc.fav_count, 0) >= 10 THEN 1
        ELSE 0
      END AS popularity_pts
    FROM products p
    LEFT JOIN price_stats ps ON ps.product_id = p.id
    LEFT JOIN fav_counts fc ON fc.product_id = p.id
    LEFT JOIN campaign_stats cs ON cs.product_id = p.id
    WHERE p.product_status = 'active'
  ),
  final_scores AS (
    SELECT
      s.id,
      LEAST(100, GREATEST(0, s.historical + s.discount_pts + s.velocity_pts + s.campaign_pts + s.popularity_pts)) AS total_score,
      CASE
        WHEN LEAST(100, GREATEST(0, s.historical + s.discount_pts + s.velocity_pts + s.campaign_pts + s.popularity_pts)) >= 90 THEN 'legendary'
        WHEN LEAST(100, GREATEST(0, s.historical + s.discount_pts + s.velocity_pts + s.campaign_pts + s.popularity_pts)) >= 75 THEN 'excellent'
        WHEN LEAST(100, GREATEST(0, s.historical + s.discount_pts + s.velocity_pts + s.campaign_pts + s.popularity_pts)) >= 60 THEN 'good'
        WHEN LEAST(100, GREATEST(0, s.historical + s.discount_pts + s.velocity_pts + s.campaign_pts + s.popularity_pts)) >= 40 THEN 'average'
        ELSE 'bad'
      END AS rating
    FROM scored s
  )
  UPDATE products p
  SET
    deal_score = fs.total_score::integer,
    deal_rating = fs.rating,
    lowest_price_30d = ps.lowest_30d,
    lowest_price_90d = ps.lowest_90d,
    avg_price_30d = ps.avg_30d,
    avg_price_90d = ps.avg_90d,
    favorite_count = COALESCE(fc.fav_count, 0),
    last_price_drop_at = ps.last_drop_at,
    deal_calculated_at = v_now
  FROM final_scores fs
  LEFT JOIN price_stats ps ON ps.product_id = fs.id
  LEFT JOIN fav_counts fc ON fc.product_id = fs.id
  WHERE p.id = fs.id;

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  SELECT
    count(*) FILTER (WHERE deal_rating = 'legendary')::integer,
    count(*) FILTER (WHERE deal_rating = 'excellent')::integer,
    count(*) FILTER (WHERE deal_rating = 'good')::integer,
    count(*) FILTER (WHERE deal_rating = 'average')::integer,
    count(*) FILTER (WHERE deal_rating = 'bad')::integer
  INTO v_legendary, v_excellent, v_good, v_average, v_bad
  FROM products WHERE product_status = 'active';

  RETURN QUERY SELECT v_processed, v_legendary, v_excellent, v_good, v_average, v_bad;
END;
$$;

REVOKE EXECUTE ON FUNCTION recalculate_deal_scores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION recalculate_deal_scores() TO service_role, authenticated;
