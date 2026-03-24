-- ============================================================
-- 00003: Waitlist / Early-Access Signup Flow
-- ============================================================
-- Adds org status (waitlist/active/suspended), and upgrades the
-- handle_new_user trigger to auto-provision an org + membership
-- when a user signs up with metadata from the sales site form.
-- ============================================================

-- 1. New enum for org lifecycle status
create type org_status as enum ('waitlist', 'active', 'suspended');

-- 2. Add status column (existing orgs get 'active')
alter table organizations
  add column status org_status not null default 'active';

-- 3. New orgs created by the signup trigger should default to 'waitlist'.
--    We'll set that explicitly in the trigger, keeping the column default
--    as 'active' so manually-created orgs via admin still work without surprises.

-- 4. Replace the handle_new_user trigger to auto-create org + membership
--    when signup includes metadata (company_name, trade).
create or replace function handle_new_user()
returns trigger as $$
declare
  _org_id uuid;
  _slug   text;
  _template text;
begin
  -- Always create the users row
  insert into users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- If signup came from the sales site form, auto-create an org
  if new.raw_user_meta_data->>'company_name' is not null then
    -- Build a URL-safe slug from company name
    _slug := lower(regexp_replace(
      trim(new.raw_user_meta_data->>'company_name'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    -- Ensure uniqueness by appending random suffix
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 6);

    _template := coalesce(nullif(new.raw_user_meta_data->>'trade', ''), 'blank');

    insert into organizations (name, slug, template_id, status)
    values (
      new.raw_user_meta_data->>'company_name',
      _slug,
      _template,
      'waitlist'
    )
    returning id into _org_id;

    -- Make the user the org owner
    insert into org_members (org_id, user_id, role)
    values (_org_id, new.id, 'owner');

    -- Set as active org
    update users set active_org_id = _org_id where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger already exists from 00001, just replacing the function is enough.
-- But if the trigger was dropped earlier (during debugging), recreate it:
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
