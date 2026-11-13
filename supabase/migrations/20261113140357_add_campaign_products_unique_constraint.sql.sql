/*
# Add unique constraint on campaign_products

Prevents duplicate (campaign_id, product_id) pairs from concurrent or repeated scans.
*/
CREATE UNIQUE INDEX IF NOT EXISTS campaign_products_campaign_product_unique
  ON campaign_products (campaign_id, product_id);
