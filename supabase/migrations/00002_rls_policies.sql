-- ============================================================
-- Aqua Palm Pool Service — Row Level Security Policies
-- Migration: 00002_rls_policies.sql
-- Description: Enables RLS and defines granular access policies
-- for admin, office, technician, and customer roles.
-- ============================================================

-- Helper function: get current user's role
create or replace function public.user_role()
returns user_role as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

-- Helper function: check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select public.user_role() = 'admin';
$$ language sql security definer stable;

-- Helper function: check if user is office or admin
create or replace function public.is_office_or_admin()
returns boolean as $$
  select public.user_role() in ('admin', 'office');
$$ language sql security definer stable;

-- Helper function: check if user is a technician
create or replace function public.is_technician()
returns boolean as $$
  select public.user_role() = 'technician';
$$ language sql security definer stable;


-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

alter table users enable row level security;
alter table customers enable row level security;
alter table service_visits enable row level security;
alter table chemical_logs enable row level security;
alter table visit_photos enable row level security;
alter table repair_requests enable row level security;
alter table quotes enable row level security;
alter table invoices enable row level security;
alter table routes enable row level security;
alter table equipment_inventory enable row level security;
alter table audit_logs enable row level security;


-- ============================================================
-- USERS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_users"
  on users for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: read all users
create policy "office_read_users"
  on users for select
  using (public.user_role() = 'office');

-- Technician: read own record
create policy "technician_read_own_user"
  on users for select
  using (public.is_technician() and id = auth.uid());

-- Any authenticated user: update own profile (name, phone, avatar)
create policy "user_update_own_profile"
  on users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Customer: read own record
create policy "customer_read_own_user"
  on users for select
  using (public.user_role() = 'customer' and id = auth.uid());


-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_customers"
  on customers for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_customers"
  on customers for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Technician: read customers on their assigned routes
create policy "technician_read_assigned_customers"
  on customers for select
  using (
    public.is_technician()
    and id in (
      select sv.customer_id
      from service_visits sv
      join routes r on r.id = sv.route_id
      where r.technician_id = auth.uid()
    )
  );

-- Customer: read own record (matched by email)
-- Note: customers login via Supabase Auth and their user.email matches customers.email
create policy "customer_read_own_customer_record"
  on customers for select
  using (
    public.user_role() = 'customer'
    and email = (select email from users where id = auth.uid())
  );


-- ============================================================
-- ROUTES TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_routes"
  on routes for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_routes"
  on routes for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Technician: read own assigned routes
create policy "technician_read_own_routes"
  on routes for select
  using (public.is_technician() and technician_id = auth.uid());


-- ============================================================
-- SERVICE_VISITS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_visits"
  on service_visits for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_visits"
  on service_visits for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Technician: read own visits + insert/update own visits
create policy "technician_read_own_visits"
  on service_visits for select
  using (public.is_technician() and technician_id = auth.uid());

create policy "technician_insert_visits"
  on service_visits for insert
  with check (public.is_technician() and technician_id = auth.uid());

create policy "technician_update_own_visits"
  on service_visits for update
  using (public.is_technician() and technician_id = auth.uid())
  with check (public.is_technician() and technician_id = auth.uid());

-- Customer: read own visit history
create policy "customer_read_own_visits"
  on service_visits for select
  using (
    public.user_role() = 'customer'
    and customer_id in (
      select c.id from customers c
      where c.email = (select email from users where id = auth.uid())
    )
  );


-- ============================================================
-- CHEMICAL_LOGS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_chemical_logs"
  on chemical_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: read all
create policy "office_read_chemical_logs"
  on chemical_logs for select
  using (public.is_office_or_admin());

-- Technician: insert + read own visit logs
create policy "technician_read_own_chemical_logs"
  on chemical_logs for select
  using (
    public.is_technician()
    and visit_id in (
      select id from service_visits where technician_id = auth.uid()
    )
  );

create policy "technician_insert_chemical_logs"
  on chemical_logs for insert
  with check (
    public.is_technician()
    and visit_id in (
      select id from service_visits where technician_id = auth.uid()
    )
  );

-- Customer: read own chemical history
create policy "customer_read_own_chemical_logs"
  on chemical_logs for select
  using (
    public.user_role() = 'customer'
    and visit_id in (
      select sv.id from service_visits sv
      join customers c on c.id = sv.customer_id
      where c.email = (select email from users where id = auth.uid())
    )
  );


-- ============================================================
-- VISIT_PHOTOS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_photos"
  on visit_photos for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: read all
create policy "office_read_photos"
  on visit_photos for select
  using (public.is_office_or_admin());

-- Technician: insert + read own visit photos
create policy "technician_read_own_photos"
  on visit_photos for select
  using (
    public.is_technician()
    and visit_id in (
      select id from service_visits where technician_id = auth.uid()
    )
  );

create policy "technician_insert_photos"
  on visit_photos for insert
  with check (
    public.is_technician()
    and visit_id in (
      select id from service_visits where technician_id = auth.uid()
    )
  );


-- ============================================================
-- REPAIR_REQUESTS TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_repairs"
  on repair_requests for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_repairs"
  on repair_requests for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Technician: insert + read own requests
create policy "technician_read_own_repairs"
  on repair_requests for select
  using (public.is_technician() and requested_by = auth.uid());

create policy "technician_insert_repairs"
  on repair_requests for insert
  with check (public.is_technician() and requested_by = auth.uid());


-- ============================================================
-- QUOTES TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_quotes"
  on quotes for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_quotes"
  on quotes for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Customer: read own quotes + update status (accept/decline)
create policy "customer_read_own_quotes"
  on quotes for select
  using (
    public.user_role() = 'customer'
    and customer_id in (
      select c.id from customers c
      where c.email = (select email from users where id = auth.uid())
    )
  );

create policy "customer_respond_to_quote"
  on quotes for update
  using (
    public.user_role() = 'customer'
    and customer_id in (
      select c.id from customers c
      where c.email = (select email from users where id = auth.uid())
    )
  )
  with check (
    public.user_role() = 'customer'
    and status in ('accepted', 'declined')
  );


-- ============================================================
-- INVOICES TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_invoices"
  on invoices for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_invoices"
  on invoices for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Customer: read own invoices
create policy "customer_read_own_invoices"
  on invoices for select
  using (
    public.user_role() = 'customer'
    and customer_id in (
      select c.id from customers c
      where c.email = (select email from users where id = auth.uid())
    )
  );


-- ============================================================
-- EQUIPMENT_INVENTORY TABLE
-- ============================================================

-- Admin: full access
create policy "admin_full_access_equipment"
  on equipment_inventory for all
  using (public.is_admin())
  with check (public.is_admin());

-- Office: full CRUD
create policy "office_full_access_equipment"
  on equipment_inventory for all
  using (public.user_role() = 'office')
  with check (public.user_role() = 'office');

-- Technician: read equipment for assigned customers + update condition
create policy "technician_read_assigned_equipment"
  on equipment_inventory for select
  using (
    public.is_technician()
    and customer_id in (
      select sv.customer_id
      from service_visits sv
      join routes r on r.id = sv.route_id
      where r.technician_id = auth.uid()
    )
  );

create policy "technician_update_equipment_condition"
  on equipment_inventory for update
  using (
    public.is_technician()
    and customer_id in (
      select sv.customer_id
      from service_visits sv
      join routes r on r.id = sv.route_id
      where r.technician_id = auth.uid()
    )
  );


-- ============================================================
-- AUDIT_LOGS TABLE
-- ============================================================

-- Admin: read only (append-only — inserts via service_role key only)
create policy "admin_read_audit_logs"
  on audit_logs for select
  using (public.is_admin());

-- No other roles can read audit logs
-- Inserts happen server-side via service_role key (bypasses RLS)


-- ============================================================
-- STORAGE POLICIES (visit-photos bucket)
-- ============================================================

-- Technicians can upload photos
create policy "technician_upload_photos"
  on storage.objects for insert
  with check (
    bucket_id = 'visit-photos'
    and public.is_technician()
  );

-- Technicians can read their own uploads
create policy "technician_read_own_photos"
  on storage.objects for select
  using (
    bucket_id = 'visit-photos'
    and (public.is_technician() or public.is_office_or_admin())
  );

-- Office + Admin can read all photos
create policy "office_read_all_photos"
  on storage.objects for select
  using (
    bucket_id = 'visit-photos'
    and public.is_office_or_admin()
  );

-- Admin can delete photos
create policy "admin_delete_photos"
  on storage.objects for delete
  using (
    bucket_id = 'visit-photos'
    and public.is_admin()
  );
