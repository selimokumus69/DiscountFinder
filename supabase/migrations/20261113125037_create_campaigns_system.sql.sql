/*
# Campaign System: campaigns + campaign_products tables

## Purpose
Supports two distinct discount types in the system:
1. Product-based discounts (existing): product's own price is reduced (original_price, current_price, discount_percentage in products table)
2. Campaign-based discounts (new): site-wide or category-wide promotions applied at checkout via coupon codes (e.g., "2000 TL üzerine KTN30 kodu ile %30 indirim + ücretsiz kargo")

## New Tables

### campaigns
- id (uuid PK)
- source_id (FK -> sources.id, nullable): which scraping source this campaign was found on
- brand_id (FK -> brands.id, nullable): brand this campaign belongs to
- title (text): campaign title/headline
- description (text, nullable): full campaign description
- coupon_code (text, nullable): coupon code if applicable (e.g., KTN30)
- discount_type (text): 'percentage' | 'fixed_amount' | 'free_shipping' | 'other'
- discount_value (numeric, nullable): numeric discount value (30 for 30%, 500 for 500 TL)
- minimum_order_amount (numeric, nullable): minimum cart total required
- maximum_discount_amount (numeric, nullable): cap on discount amount
- free_shipping (boolean, default false): whether campaign includes free shipping
- start_date (date, nullable): campaign start date
- end_date (date, nullable): campaign end date
- terms (text, nullable): campaign terms and conditions
- source_url (text, nullable): URL where campaign was found
- is_active (boolean, default true): whether campaign is currently active
- scraped_at (timestamptz, nullable): when campaign was last scraped
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### campaign_products
- id (uuid PK)
- campaign_id (FK -> campaigns.id, ON DELETE CASCADE)
- product_id (FK -> products.id, ON DELETE CASCADE)
- created_at (timestamptz, default now())
- UNIQUE(campaign_id, product_id): prevents duplicate associations

## Security
- RLS enabled on both tables
- campaigns: SELECT for anon+authenticated (public browsing), INSERT/UPDATE/DELETE for authenticated (admin management)
- campaign_products: SELECT for anon+authenticated, INSERT/UPDATE/DELETE for authenticated
- service_role granted all (edge function uses service role key)

## Important Notes
1. The app has a sign-in screen for admin, but mobile browsing is public (no auth). So SELECT policies target anon+authenticated.
2. Admin mutations target authenticated only (admin role check is in app logic, not RLS, matching existing pattern).
3. Existing products and price_history are untouched.
4. No destructive changes to existing tables.
*/