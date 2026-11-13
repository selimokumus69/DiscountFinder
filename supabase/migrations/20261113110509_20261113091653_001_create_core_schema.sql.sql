/*
# Create core schema for IndirimGO

1. Tables
- profiles: Auth-linked user profiles with a database-controlled admin/user role.
- brands: Public clothing brands managed by admins.
- categories: Public product categories with optional parent categories.
- sources: E-commerce category URLs used by backend scanners.
- products: Aggregated products, prices, availability, and status.
- price_history: Historical product prices.
- favorites: User-owned product favorites.
- scan_logs: Backend scan results and error details.

2. Security
- RLS is enabled on every table.
- Public users can read active products, brands, categories, sources, and active-product price history.
- Only users whose database profile role is admin can modify catalog and scan data.
- Favorites are readable and writable only by their owner.
- New auth users receive a profile with role=user automatically.
- service_role receives server-side access for the scraper.

3. Important notes
- Product identity is deduplicated by source_id + external_product_id.
- Prices use numeric types and all timestamps use timestamptz.
- The role is stored in profiles, not user-editable auth metadata.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
CREATE POLICY "profiles_admin_read" ON profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  website_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON brands TO anon, authenticated;
GRANT ALL ON brands TO service_role;
DROP POLICY IF EXISTS "brands_public_read" ON brands;
CREATE POLICY "brands_public_read" ON brands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "brands_admin_all" ON brands;
CREATE POLICY "brands_admin_all" ON brands FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON categories TO anon, authenticated;
GRANT ALL ON categories TO service_role;
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_admin_all" ON categories;
CREATE POLICY "categories_admin_all" ON categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  scraping_method text NOT NULL DEFAULT 'html',
  scraping_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  scan_interval_hours integer NOT NULL DEFAULT 12,
  is_active boolean NOT NULL DEFAULT true,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON sources TO anon, authenticated;
GRANT ALL ON sources TO service_role;
DROP POLICY IF EXISTS "sources_public_read" ON sources;
CREATE POLICY "sources_public_read" ON sources FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sources_admin_all" ON sources;
CREATE POLICY "sources_admin_all" ON sources FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  external_product_id text,
  name text NOT NULL,
  description text,
  image_url text,
  product_url text NOT NULL,
  current_price numeric(10,2) NOT NULL DEFAULT 0,
  original_price numeric(10,2),
  discount_percentage numeric(5,2),
  currency text NOT NULL DEFAULT 'TRY',
  availability_status text NOT NULL DEFAULT 'in_stock',
  product_status text NOT NULL DEFAULT 'active',
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_source_external_idx ON products (source_id, external_product_id) WHERE external_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_brand_id_idx ON products (brand_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (product_status);
CREATE INDEX IF NOT EXISTS products_discount_idx ON products (discount_percentage DESC);
CREATE INDEX IF NOT EXISTS products_created_idx ON products (created_at DESC);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON products TO anon, authenticated;
GRANT ALL ON products TO service_role;
DROP POLICY IF EXISTS "products_public_read_active" ON products;
CREATE POLICY "products_public_read_active" ON products FOR SELECT TO anon, authenticated USING (product_status = 'active');
DROP POLICY IF EXISTS "products_admin_all" ON products;
CREATE POLICY "products_admin_all" ON products FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  original_price numeric(10,2),
  discount_percentage numeric(5,2),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_history_product_idx ON price_history (product_id, recorded_at);
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON price_history TO anon, authenticated;
GRANT ALL ON price_history TO service_role;
DROP POLICY IF EXISTS "price_history_public_read" ON price_history;
CREATE POLICY "price_history_public_read" ON price_history FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM products WHERE products.id = price_history.product_id AND products.product_status = 'active'));
DROP POLICY IF EXISTS "price_history_admin_all" ON price_history;
CREATE POLICY "price_history_admin_all" ON price_history FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON favorites TO authenticated;
GRANT ALL ON favorites TO service_role;
DROP POLICY IF EXISTS "favorites_owner_read" ON favorites;
CREATE POLICY "favorites_owner_read" ON favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "favorites_owner_insert" ON favorites;
CREATE POLICY "favorites_owner_insert" ON favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "favorites_owner_delete" ON favorites;
CREATE POLICY "favorites_owner_delete" ON favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  products_found integer NOT NULL DEFAULT 0,
  products_added integer NOT NULL DEFAULT 0,
  products_updated integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS scan_logs_source_idx ON scan_logs (source_id);
CREATE INDEX IF NOT EXISTS scan_logs_started_idx ON scan_logs (started_at DESC);
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON scan_logs TO anon, authenticated;
GRANT ALL ON scan_logs TO service_role;
DROP POLICY IF EXISTS "scan_logs_public_read" ON scan_logs;
CREATE POLICY "scan_logs_public_read" ON scan_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "scan_logs_admin_all" ON scan_logs;
CREATE POLICY "scan_logs_admin_all" ON scan_logs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
