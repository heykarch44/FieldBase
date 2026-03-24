-- ============================================================
-- FieldBase — Row Level Security Policies
-- All data tables isolated by org_id
-- ============================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table org_members enable row level security;
alter table org_invites enable row level security;
alter table field_definitions enable row level security;
alter table field_values enable row level security;
alter table jobsites enable row level security;
alter table routes enable row level security;
alter table visits enable row level security;
alter table service_orders enable row level security;
alter table photos enable row level security;
alter table documents enable row level security;
alter table signatures enable row level security;
alter table equipment enable row level security;
alter table inventory enable row level security;
alter table inventory_usage enable row level security;

-- Helper: get current user's active org_id (in public schema)
create or replace function public.active_org_id()
returns uuid as $$
  select active_org_id from public.users where id = auth.uid();
$$ language sql security definer stable;

-- Helper: check if user is member of org with minimum role (in public schema)
create or replace function public.has_org_role(check_org_id uuid, min_role user_role)
returns boolean as $$
  select exists(
    select 1 from public.org_members
    where org_id = check_org_id
    and user_id = auth.uid()
    and role <= min_role  -- enum ordering: owner < admin < manager < technician < viewer
  );
$$ language sql security definer stable;

-- Organizations: members can view their orgs
create policy "org_select" on organizations for select using (
  id in (select org_id from org_members where user_id = auth.uid())
);
create policy "org_update" on organizations for update using (
  public.has_org_role(id, 'admin')
);

-- Users: can read own profile + can read other users in same org (for display names)
create policy "users_select_own" on users for select using (
  id = auth.uid()
  or id in (select user_id from org_members where org_id = public.active_org_id())
);
create policy "users_update_own" on users for update using (id = auth.uid());

-- Org Members: members can see other members in their org
create policy "members_select" on org_members for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);
create policy "members_insert" on org_members for insert with check (
  public.has_org_role(org_id, 'admin')
);
create policy "members_delete" on org_members for delete using (
  public.has_org_role(org_id, 'admin')
);

-- Jobsites
create policy "jobsites_select" on jobsites for select using (org_id = public.active_org_id());
create policy "jobsites_insert" on jobsites for insert with check (org_id = public.active_org_id());
create policy "jobsites_update" on jobsites for update using (org_id = public.active_org_id());
create policy "jobsites_delete" on jobsites for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Routes
create policy "routes_select" on routes for select using (org_id = public.active_org_id());
create policy "routes_insert" on routes for insert with check (org_id = public.active_org_id());
create policy "routes_update" on routes for update using (org_id = public.active_org_id());
create policy "routes_delete" on routes for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Visits
create policy "visits_select" on visits for select using (org_id = public.active_org_id());
create policy "visits_insert" on visits for insert with check (org_id = public.active_org_id());
create policy "visits_update" on visits for update using (org_id = public.active_org_id());
create policy "visits_delete" on visits for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Service Orders
create policy "so_select" on service_orders for select using (org_id = public.active_org_id());
create policy "so_insert" on service_orders for insert with check (org_id = public.active_org_id());
create policy "so_update" on service_orders for update using (org_id = public.active_org_id());
create policy "so_delete" on service_orders for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Photos
create policy "photos_select" on photos for select using (org_id = public.active_org_id());
create policy "photos_insert" on photos for insert with check (org_id = public.active_org_id());
create policy "photos_delete" on photos for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Documents
create policy "docs_select" on documents for select using (org_id = public.active_org_id());
create policy "docs_insert" on documents for insert with check (org_id = public.active_org_id());
create policy "docs_delete" on documents for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Signatures
create policy "sigs_select" on signatures for select using (org_id = public.active_org_id());
create policy "sigs_insert" on signatures for insert with check (org_id = public.active_org_id());

-- Equipment
create policy "equip_select" on equipment for select using (org_id = public.active_org_id());
create policy "equip_insert" on equipment for insert with check (org_id = public.active_org_id());
create policy "equip_update" on equipment for update using (org_id = public.active_org_id());
create policy "equip_delete" on equipment for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Field Definitions
create policy "fd_select" on field_definitions for select using (org_id = public.active_org_id());
create policy "fd_insert" on field_definitions for insert with check (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));
create policy "fd_update" on field_definitions for update using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));
create policy "fd_delete" on field_definitions for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Field Values
create policy "fv_select" on field_values for select using (org_id = public.active_org_id());
create policy "fv_insert" on field_values for insert with check (org_id = public.active_org_id());
create policy "fv_update" on field_values for update using (org_id = public.active_org_id());

-- Inventory
create policy "inv_select" on inventory for select using (org_id = public.active_org_id());
create policy "inv_insert" on inventory for insert with check (org_id = public.active_org_id());
create policy "inv_update" on inventory for update using (org_id = public.active_org_id());
create policy "inv_delete" on inventory for delete using (org_id = public.active_org_id() and public.has_org_role(org_id, 'admin'));

-- Inventory Usage
create policy "iu_select" on inventory_usage for select using (org_id = public.active_org_id());
create policy "iu_insert" on inventory_usage for insert with check (org_id = public.active_org_id());

-- Org Invites
create policy "invites_select" on org_invites for select using (org_id = public.active_org_id());
create policy "invites_insert" on org_invites for insert with check (public.has_org_role(org_id, 'admin'));
create policy "invites_update" on org_invites for update using (public.has_org_role(org_id, 'admin'));
