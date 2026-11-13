/*
# Core Schema: Kadın Giyim İndirim Keşif Platformu

## Açıklama
Bu migration, kadın giyim indirim keşif platformu için temel veritabanı yapısını oluşturur.
Platform, farklı e-ticaret sitelerinden ürün indirimlerini tek yerde toplar ve kullanıcılara sunar.

## Oluşturulan Tablolar
1. **profiles** - Kullanıcı profilleri (auth.users ile entegre, rol yönetimi)
2. **brands** - Marka bilgileri
3. **categories** - Ürün kategorileri (parent kategori desteği)
4. **sources** - Tarama kaynakları (e-ticaret sitesi/kategori bağlantıları)
5. **products** - Ürünler (fiyat, indirim, marka, kategori, durum)
6. **price_history** - Fiyat geçmişi
7. **favorites** - Kullanıcı favorileri (sahipli)
8. **scan_logs** - Tarama geçmişi

## Güvenlik
- Tüm tablolarda RLS etkin
- Admin işlemleri authenticated + admin rolü ile sınırlandırılmış
- Normal kullanıcılar sadece aktif ürünleri görebilir
- Favoriler sadece sahibi tarafından yönetilebilir
- Yeni kullanıcı kaydında otomatik profile oluşturma trigger'ı

## Önemli Notlar
1. Para değerleri numeric(10,2) tipinde (floating point değil)
2. products tablosunda (source_id, external_product_id) unique constraint
3. profiles önce oluşturulur çünkü diğer tabloların RLS politikaları profiles'a referans verir
4. İlk admin kullanıcısı kayıt olduktan sonra manuel atanmalıdır
*/

-- ============================================
-- 1. profiles tablosu (ÖNCE oluşturulmalı - diğer RLS politikaları buna referans verir)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Kullanıcı kendi profilini görebilir
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read"
ON profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Kullanıcı kendi profilini güncelleyebilir
DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin tüm profilleri görebilir
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
CREATE POLICY "profiles_admin_read"
ON profiles FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================
-- 2. brands tablosu
-- ============================================
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
CREATE POLICY "brands_public_read"
ON brands FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "brands_admin_all" ON brands;
CREATE POLICY "brands_admin_all"
ON brands FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 3. categories tablosu
-- ============================================
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
CREATE POLICY "categories_public_read"
ON categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_admin_all" ON categories;
CREATE POLICY "categories_admin_all"
ON categories FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 4. sources tablosu
-- ============================================
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
CREATE POLICY "sources_public_read"
ON sources FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sources_admin_all" ON sources;
CREATE POLICY "sources_admin_all"
ON sources FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 5. products tablosu
-- ============================================
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

CREATE UNIQUE INDEX IF NOT EXISTS products_source_external_idx
ON products (source_id, external_product_id)
WHERE external_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_brand_id_idx ON products (brand_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (product_status);
CREATE INDEX IF NOT EXISTS products_discount_idx ON products (discount_percentage DESC);
CREATE INDEX IF NOT EXISTS products_created_idx ON products (created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON products TO anon, authenticated;
GRANT ALL ON products TO service_role;

DROP POLICY IF EXISTS "products_public_read_active" ON products;
CREATE POLICY "products_public_read_active"
ON products FOR SELECT TO anon, authenticated
USING (product_status = 'active');

DROP POLICY IF EXISTS "products_admin_all" ON products;
CREATE POLICY "products_admin_all"
ON products FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 6. price_history tablosu
-- ============================================
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
CREATE POLICY "price_history_public_read"
ON price_history FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM products WHERE products.id = price_history.product_id AND products.product_status = 'active')
);

DROP POLICY IF EXISTS "price_history_admin_all" ON price_history;
CREATE POLICY "price_history_admin_all"
ON price_history FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 7. favorites tablosu
-- ============================================
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
CREATE POLICY "favorites_owner_read"
ON favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_owner_insert" ON favorites;
CREATE POLICY "favorites_owner_insert"
ON favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_owner_delete" ON favorites;
CREATE POLICY "favorites_owner_delete"
ON favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 8. scan_logs tablosu
-- ============================================
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
CREATE POLICY "scan_logs_public_read"
ON scan_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "scan_logs_admin_all" ON scan_logs;
CREATE POLICY "scan_logs_admin_all"
ON scan_logs FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- ============================================
-- 9. updated_at otomatik güncelleme
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. Yeni kullanıcı için otomatik profil oluşturma
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
