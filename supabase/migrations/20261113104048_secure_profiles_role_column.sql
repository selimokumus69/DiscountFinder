/*
# Secure profiles.role column against self-promotion

## Purpose
- Currently, profiles_self_update policy allows users to UPDATE their own profile
  with WITH CHECK (auth.uid() = id), which does NOT restrict which columns can be changed.
- A regular user could potentially UPDATE their own role to 'admin' via the Data API.
- This migration:
  1. Revokes the broad UPDATE grant on profiles from anon and authenticated.
  2. Grants UPDATE only on display_name and email columns (safe, user-editable fields).
  3. Keeps service_role with full UPDATE for admin operations.

## Security Changes
- REVOKE UPDATE ON profiles FROM anon, authenticated
- GRANT UPDATE (display_name, email) ON profiles TO authenticated
- service_role retains ALL privileges (used by edge functions)
- The profiles_self_update RLS policy remains, but now column-level privileges
  prevent users from modifying the role column even if the RLS check passes.
*/

REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (display_name, email) ON profiles TO authenticated;
