/*
# Create campaigns and campaign_products tables

## New Tables
### campaigns
Stores campaign-based discounts (coupon codes, free shipping, minimum order thresholds).
### campaign_products
Many-to-many junction linking campaigns to the products they apply to.

## Security
- RLS enabled on both tables.
- SELECT: anon + authenticated (public mobile browsing).
- INSERT/UPDATE/DELETE: authenticated only (admin panel).
- service_role: all privileges (edge function).
*/

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  coupon_code text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric,
  minimum_order_amount numeric,
  maximum_discount_amount numeric,
  free_shipping boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  terms text,
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.campaigns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO service_role;

DROP POLICY IF EXISTS "campaigns_select_public" ON public.campaigns;
CREATE POLICY "campaigns_select_public"
  ON public.campaigns FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "campaigns_insert_authenticated" ON public.campaigns;
CREATE POLICY "campaigns_insert_authenticated"
  ON public.campaigns FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "campaigns_update_authenticated" ON public.campaigns;
CREATE POLICY "campaigns_update_authenticated"
  ON public.campaigns FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaigns_delete_authenticated" ON public.campaigns;
CREATE POLICY "campaigns_delete_authenticated"
  ON public.campaigns FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.campaign_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, product_id)
);

ALTER TABLE public.campaign_products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.campaign_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaign_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_products TO service_role;

DROP POLICY IF EXISTS "campaign_products_select_public" ON public.campaign_products;
CREATE POLICY "campaign_products_select_public"
  ON public.campaign_products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "campaign_products_insert_authenticated" ON public.campaign_products;
CREATE POLICY "campaign_products_insert_authenticated"
  ON public.campaign_products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_products_update_authenticated" ON public.campaign_products;
CREATE POLICY "campaign_products_update_authenticated"
  ON public.campaign_products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "campaign_products_delete_authenticated" ON public.campaign_products;
CREATE POLICY "campaign_products_delete_authenticated"
  ON public.campaign_products FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_campaigns_source_id ON public.campaigns(source_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON public.campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active ON public.campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign_id ON public.campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_products_product_id ON public.campaign_products(product_id);