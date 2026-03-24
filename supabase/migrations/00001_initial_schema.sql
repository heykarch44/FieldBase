-- ============================================================
-- Aqua Palm Pool Service — Initial Database Schema
-- Migration: 00001_initial_schema.sql
-- Description: Creates all enums, tables, indexes, and triggers
-- for the Aqua Palm Pool Service platform.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================

create type user_role as enum ('admin', 'office', 'technician', 'customer');

create type pool_type as enum ('chlorine', 'saltwater', 'other');

create type day_of_week as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

create type customer_status as enum ('active', 'inactive', 'lead');

create type visit_status as enum ('scheduled', 'in_progress', 'completed', 'skipped');

create type chemical_unit as enum ('oz', 'lbs', 'gallons', 'tablets');

create type photo_type as enum ('before', 'after', 'issue', 'equipment');

create type repair_category as enum (
  'pump', 'filter', 'pipe', 'heater', 'tile',
  'acid_wash', 'resurface', 'electrical', 'plumbing', 'other'
);

create type urgency_level as enum ('low', 'medium', 'high', 'emergency');

create type repair_status as enum (
  'pending_review', 'quoted', 'approved', 'scheduled',
  'in_progress', 'completed', 'declined'
);

create type quote_status as enum (
  'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'
);

create type invoice_type as enum ('recurring', 'one_time');

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

create type equipment_type as enum (
  'pump', 'filter', 'heater', 'salt_cell',
  'automation', 'cleaner', 'light', 'other'
);

create type equipment_condition as enum ('good', 'fair', 'poor', 'needs_replacement');


-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 users
-- Extends Supabase Auth. Linked via id = auth.users.id
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  full_name     text not null,
  phone         text,
  role          user_role not null default 'customer',
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table users is 'Application user profiles linked to Supabase Auth';

-- 2.2 customers
create table customers (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  email             text,
  phone             text,
  address_line1     text not null,
  address_line2     text,
  city              text not null,
  state             text not null default 'AZ',
  zip               text not null,
  lat               decimal(10,7),
  lng               decimal(10,7),
  gate_code         text,
  access_notes      text,
  pool_type         pool_type not null default 'chlorine',
  pool_volume_gallons integer,
  service_day       day_of_week,
  monthly_rate      decimal(10,2),
  status            customer_status not null default 'lead',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table customers is 'Customer records with property and pool details';

-- 2.3 routes
create table routes (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  technician_id            uuid not null references users(id) on delete restrict,
  day_of_week              day_of_week not null,
  optimized_order          jsonb default '[]'::jsonb,
  total_estimated_minutes  integer,
  total_distance_miles     decimal(6,1),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table routes is 'Daily route definitions per technician with optimized stop ordering';

-- 2.4 service_visits
create table service_visits (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete restrict,
  technician_id   uuid not null references users(id) on delete restrict,
  route_id        uuid references routes(id) on delete set null,
  scheduled_date  date not null,
  arrived_at      timestamptz,
  departed_at     timestamptz,
  arrived_lat     decimal(10,7),
  arrived_lng     decimal(10,7),
  departed_lat    decimal(10,7),
  departed_lng    decimal(10,7),
  status          visit_status not null default 'scheduled',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table service_visits is 'Individual service stops with GPS timestamps';

-- 2.5 chemical_logs
create table chemical_logs (
  id                uuid primary key default gen_random_uuid(),
  visit_id          uuid not null references service_visits(id) on delete cascade,
  chemical_name     text,
  amount            decimal(8,2),
  unit              chemical_unit,
  ph_before         decimal(4,2),
  ph_after          decimal(4,2),
  chlorine_before   decimal(4,2),
  chlorine_after    decimal(4,2),
  alkalinity_before integer,
  alkalinity_after  integer,
  cya_before        integer,
  cya_after         integer,
  calcium_hardness  integer,
  salt_level        integer,
  water_temp        decimal(5,1),
  logged_at         timestamptz not null default now()
);

comment on table chemical_logs is 'Chemical readings and treatments per service visit';

-- 2.6 visit_photos
create table visit_photos (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references service_visits(id) on delete cascade,
  storage_url   text not null,
  caption       text,
  photo_type    photo_type not null default 'after',
  lat           decimal(10,7),
  lng           decimal(10,7),
  taken_at      timestamptz,
  uploaded_at   timestamptz not null default now()
);

comment on table visit_photos is 'Geotagged photos captured during service visits';

-- 2.7 repair_requests
create table repair_requests (
  id              uuid primary key default gen_random_uuid(),
  visit_id        uuid references service_visits(id) on delete set null,
  customer_id     uuid not null references customers(id) on delete restrict,
  requested_by    uuid not null references users(id) on delete restrict,
  category        repair_category not null default 'other',
  description     text not null,
  urgency         urgency_level not null default 'medium',
  estimated_cost  decimal(10,2),
  status          repair_status not null default 'pending_review',
  photos          text[] default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table repair_requests is 'Field-submitted repair requests routed to office';

-- 2.8 quotes
create table quotes (
  id                  uuid primary key default gen_random_uuid(),
  repair_request_id   uuid references repair_requests(id) on delete set null,
  customer_id         uuid not null references customers(id) on delete restrict,
  created_by          uuid not null references users(id) on delete restrict,
  line_items          jsonb not null default '[]'::jsonb,
  subtotal            decimal(10,2) not null default 0,
  tax_rate            decimal(5,4) not null default 0.0000,
  tax_amount          decimal(10,2) not null default 0,
  total               decimal(10,2) not null default 0,
  status              quote_status not null default 'draft',
  valid_until         date,
  stripe_invoice_id   text,
  sent_at             timestamptz,
  responded_at        timestamptz,
  created_at          timestamptz not null default now()
);

comment on table quotes is 'Formal quotes sent to customers for approval';

-- 2.9 invoices
create table invoices (
  id                      uuid primary key default gen_random_uuid(),
  customer_id             uuid not null references customers(id) on delete restrict,
  quote_id                uuid references quotes(id) on delete set null,
  type                    invoice_type not null default 'recurring',
  line_items              jsonb not null default '[]'::jsonb,
  subtotal                decimal(10,2) not null default 0,
  tax_rate                decimal(5,4) not null default 0.0000,
  tax_amount              decimal(10,2) not null default 0,
  total                   decimal(10,2) not null default 0,
  status                  invoice_status not null default 'draft',
  stripe_invoice_id       text,
  stripe_payment_intent_id text,
  due_date                date,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now()
);

comment on table invoices is 'Recurring and one-time billing records';

-- 2.10 equipment_inventory
create table equipment_inventory (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  equipment_type  equipment_type not null,
  brand           text,
  model           text,
  serial_number   text,
  install_date    date,
  warranty_expiry date,
  last_serviced   date,
  condition       equipment_condition not null default 'good',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table equipment_inventory is 'Per-customer pool equipment tracking';

-- 2.11 audit_logs (append-only)
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  action      text not null,
  table_name  text not null,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

comment on table audit_logs is 'Append-only audit trail for sensitive operations';


-- ============================================================
-- 3. INDEXES
-- ============================================================

-- users
create index idx_users_role on users(role);
create index idx_users_email on users(email);

-- customers
create index idx_customers_status on customers(status);
create index idx_customers_city on customers(city);
create index idx_customers_service_day on customers(service_day);
create index idx_customers_name on customers(last_name, first_name);

-- service_visits
create index idx_visits_customer on service_visits(customer_id);
create index idx_visits_technician on service_visits(technician_id);
create index idx_visits_route on service_visits(route_id);
create index idx_visits_date on service_visits(scheduled_date);
create index idx_visits_status on service_visits(status);
create index idx_visits_date_tech on service_visits(scheduled_date, technician_id);

-- chemical_logs
create index idx_chemical_logs_visit on chemical_logs(visit_id);
create index idx_chemical_logs_date on chemical_logs(logged_at);

-- visit_photos
create index idx_photos_visit on visit_photos(visit_id);
create index idx_photos_type on visit_photos(photo_type);

-- repair_requests
create index idx_repairs_customer on repair_requests(customer_id);
create index idx_repairs_status on repair_requests(status);
create index idx_repairs_urgency on repair_requests(urgency);

-- quotes
create index idx_quotes_customer on quotes(customer_id);
create index idx_quotes_status on quotes(status);

-- invoices
create index idx_invoices_customer on invoices(customer_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_due_date on invoices(due_date);

-- routes
create index idx_routes_technician on routes(technician_id);
create index idx_routes_day on routes(day_of_week);

-- equipment_inventory
create index idx_equipment_customer on equipment_inventory(customer_id);
create index idx_equipment_warranty on equipment_inventory(warranty_expiry);

-- audit_logs
create index idx_audit_user on audit_logs(user_id);
create index idx_audit_table on audit_logs(table_name);
create index idx_audit_created on audit_logs(created_at);


-- ============================================================
-- 4. updated_at TRIGGER FUNCTION
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at column
create trigger trg_users_updated_at
  before update on users for each row execute function update_updated_at();

create trigger trg_customers_updated_at
  before update on customers for each row execute function update_updated_at();

create trigger trg_service_visits_updated_at
  before update on service_visits for each row execute function update_updated_at();

create trigger trg_repair_requests_updated_at
  before update on repair_requests for each row execute function update_updated_at();

create trigger trg_routes_updated_at
  before update on routes for each row execute function update_updated_at();

create trigger trg_equipment_updated_at
  before update on equipment_inventory for each row execute function update_updated_at();


-- ============================================================
-- 5. HELPER FUNCTION: Auto-create user profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================

-- Create private bucket for jobsite photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visit-photos',
  'visit-photos',
  false,
  10485760, -- 10MB max per photo
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
);
