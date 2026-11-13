/*
# Protect admin role from self-promotion

1. Change
- Removes broad authenticated UPDATE access on profiles.
- Allows signed-in users to update only display_name and email.
- The role column remains writable by service_role/server-side administration only.

2. Security
- A normal user cannot promote their own profile to admin through the Data API.
- Existing admin checks continue to use the database profiles.role field.
*/

REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, email) ON profiles TO authenticated;
