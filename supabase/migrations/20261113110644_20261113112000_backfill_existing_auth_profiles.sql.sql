/*
# Backfill profiles for existing Auth users

1. Purpose
- The profile trigger only runs for users created after the trigger exists.
- If an Auth account was created before the database schema was installed,
  it has no matching public.profiles row and cannot be promoted with SQL.

2. Changes
- Creates one profile for each existing auth.users row that does not already
  have a profile.
- Every backfilled profile receives role=user.
- Existing profiles are not changed.

3. Security
- No user receives admin access automatically.
- The existing trigger and RLS policies remain in place.
*/

INSERT INTO public.profiles (id, email, display_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(COALESCE(u.email, ''), '@', 1)),
  'user'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);
