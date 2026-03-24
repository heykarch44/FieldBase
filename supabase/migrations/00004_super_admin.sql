-- ============================================================
-- 00004 FIX: Super-Admin Role (replaces original 00004)
-- ============================================================
-- The original 00004 caused infinite recursion on the users table
-- because the RLS policy on users queried users to check is_super_admin.
-- Fix: use a SECURITY DEFINER function to bypass RLS when checking the flag.
-- ============================================================

-- 1. Add super-admin flag (skip if already exists from partial run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Mark your account as super-admin
UPDATE users SET is_super_admin = true WHERE email = 'heykarch44@gmail.com';

-- 3. SECURITY DEFINER function to check super-admin without hitting RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
  result boolean;
BEGIN
  SELECT u.is_super_admin INTO result
  FROM public.users u
  WHERE u.id = auth.uid();
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- 4. Drop the broken policies from original 00004 (if they exist)
DROP POLICY IF EXISTS "super_admins_read_all_orgs" ON organizations;
DROP POLICY IF EXISTS "super_admins_update_all_orgs" ON organizations;
DROP POLICY IF EXISTS "super_admins_read_all_users" ON users;
DROP POLICY IF EXISTS "super_admins_read_all_org_members" ON org_members;

-- 5. Recreate policies using the safe helper function
CREATE POLICY "super_admins_read_all_orgs"
  ON organizations FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "super_admins_update_all_orgs"
  ON organizations FOR UPDATE
  USING (public.is_super_admin());

CREATE POLICY "super_admins_read_all_users"
  ON users FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "super_admins_read_all_org_members"
  ON org_members FOR SELECT
  USING (public.is_super_admin());
