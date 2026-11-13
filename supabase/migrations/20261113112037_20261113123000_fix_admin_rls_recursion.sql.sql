/*
# Fix recursive admin authorization policies

1. Problem
- Admin policies on catalog tables queried profiles directly to check role.
- Profiles itself had an admin-read policy that also queried profiles.
- PostgreSQL therefore detected recursive RLS evaluation and returned 42P17.
- Authenticated users could sign in, but their profile query failed before the
  frontend could evaluate profiles.role.

2. Security fix
- Adds public.is_admin(), a SECURITY DEFINER function with a fixed search_path.
- The function checks auth.uid() against the database profiles row as the
  trusted database owner, avoiding recursive profiles RLS evaluation.
- Removes direct profiles subqueries from admin policies.
- Revokes function execution from public and anon; only authenticated users
  can invoke it through RLS evaluation.

3. Data safety
- No rows, roles, passwords, or existing admin permissions are changed.
- The current admin profile remains admin.
- Non-admin users still cannot modify catalog, sources, products, categories,
  scan logs, or price history.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "brands_admin_all" ON public.brands;
CREATE POLICY "brands_admin_all"
ON public.brands FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;
CREATE POLICY "categories_admin_all"
ON public.categories FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sources_admin_all" ON public.sources;
CREATE POLICY "sources_admin_all"
ON public.sources FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all"
ON public.products FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "price_history_admin_all" ON public.price_history;
CREATE POLICY "price_history_admin_all"
ON public.price_history FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "scan_logs_admin_all" ON public.scan_logs;
CREATE POLICY "scan_logs_admin_all"
ON public.scan_logs FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
