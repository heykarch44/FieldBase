-- ============================================================
-- 00004: FieldIQ Super-Admin Role
-- ============================================================
-- Adds a platform-level super-admin flag to users.
-- Super-admins can manage all orgs, approve waitlist, etc.
-- This is separate from org-level roles (owner/admin/manager/etc).
-- ============================================================

-- 1. Add super-admin flag (default false for all existing users)
alter table users
  add column is_super_admin boolean not null default false;

-- 2. Mark your account as super-admin
-- (Replace the email below if needed)
update users set is_super_admin = true where email = 'heykarch44@gmail.com';

-- 3. RLS policy: super-admins can read all organizations
create policy "super_admins_read_all_orgs"
  on organizations for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.is_super_admin = true
    )
  );

-- 4. RLS policy: super-admins can update any organization (status, plan, etc)
create policy "super_admins_update_all_orgs"
  on organizations for update
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.is_super_admin = true
    )
  );

-- 5. RLS policy: super-admins can read all users
create policy "super_admins_read_all_users"
  on users for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.is_super_admin = true
    )
  );

-- 6. RLS policy: super-admins can read all org_members
create policy "super_admins_read_all_org_members"
  on org_members for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid()
        and users.is_super_admin = true
    )
  );
