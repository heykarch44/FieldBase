-- ============================================================
-- FieldBase — Multi-Tenant Jobsite Management Platform
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. ENUMS (only universal ones — industry-specific enums go into field_definitions)
-- ============================================================

create type user_role as enum ('owner', 'admin', 'manager', 'technician', 'viewer');
create type org_plan as enum ('free', 'pro', 'enterprise');
create type visit_status as enum ('scheduled', 'en_route', 'in_progress', 'completed', 'skipped', 'canceled');
create type service_order_status as enum ('draft', 'pending', 'approved', 'scheduled', 'in_progress', 'completed', 'invoiced', 'canceled');
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');
create type urgency_level as enum ('low', 'medium', 'high', 'emergency');
create type field_type as enum ('text', 'number', 'enum', 'boolean', 'date', 'photo', 'signature', 'textarea', 'email', 'phone', 'url');
create type entity_type as enum ('jobsite', 'visit', 'service_order', 'inventory_item', 'equipment');
create type day_of_week as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
create type invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type doc_type as enum ('plan', 'permit', 'contract', 'photo_report', 'inspection', 'other');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- 2.1 Organizations (tenants)
create table organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  template_id     text,                          -- e.g. 'pool_cleaning', 'hood_cleaning', 'blank'
  plan            org_plan not null default 'free',
  logo_url        text,
  timezone        text not null default 'America/Phoenix',
  settings        jsonb not null default '{}'::jsonb,  -- branding, notification prefs, etc.
  stripe_customer_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2.2 Users (extends Supabase Auth)
create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text not null,
  phone           text,
  avatar_url      text,
  active_org_id   uuid references organizations(id),  -- currently selected org
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2.3 Org Members (many-to-many: users ↔ organizations)
create table org_members (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  role            user_role not null default 'technician',
  joined_at       timestamptz not null default now(),
  unique(org_id, user_id)
);

-- 2.4 Org Invites
create table org_invites (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            user_role not null default 'technician',
  invited_by      uuid not null references users(id),
  status          invite_status not null default 'pending',
  token           text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 3. DYNAMIC FIELD ENGINE
-- ============================================================

-- 3.1 Field Definitions (company-configurable schema)
create table field_definitions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  entity_type     entity_type not null,
  field_key       text not null,                   -- internal slug: "ph_before", "grease_depth"
  label           text not null,                   -- display name — company chooses this
  field_type      field_type not null default 'text',
  options         jsonb,                           -- for enum type: ["Good","Fair","Poor"]
  default_value   text,
  is_required     boolean not null default false,
  display_order   integer not null default 0,
  group_name      text,                            -- optional grouping: "Water Chemistry"
  show_on_report  boolean not null default true,
  active          boolean not null default true,
  description     text,                            -- help text shown under the field
  validation      jsonb,                           -- min, max, regex, etc.
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(org_id, entity_type, field_key)
);

-- 3.2 Field Values (EAV storage)
create table field_values (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  field_definition_id uuid not null references field_definitions(id) on delete cascade,
  entity_type     entity_type not null,
  entity_id       uuid not null,                   -- the visit, jobsite, service_order, etc.
  value_text      text,                            -- stores everything as text
  value_numeric   decimal(15,4),                   -- indexed numeric copy for filtering/sorting
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_field_values_entity on field_values(org_id, entity_type, entity_id);
create index idx_field_values_definition on field_values(field_definition_id);
create index idx_field_values_numeric on field_values(value_numeric) where value_numeric is not null;

-- ============================================================
-- 4. BUSINESS TABLES (all with org_id)
-- ============================================================

-- 4.1 Jobsites (was: customers — now a generic location)
create table jobsites (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,                   -- "Smith Residence", "Building 4A"
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  address_line1   text not null,
  address_line2   text,
  city            text not null,
  state           text not null default 'AZ',
  zip             text not null,
  lat             decimal(10,7),
  lng             decimal(10,7),
  access_notes    text,                            -- gate codes, parking, etc.
  status          text not null default 'active',  -- active, inactive, lead
  tags            text[] default '{}',             -- freeform tags
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_jobsites_org on jobsites(org_id);

-- 4.2 Routes
create table routes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  technician_id   uuid not null references users(id) on delete restrict,
  day_of_week     day_of_week not null,
  optimized_order jsonb default '[]'::jsonb,
  total_estimated_minutes integer,
  total_distance_miles    decimal(6,1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_routes_org on routes(org_id);

-- 4.3 Visits (was: service_visits)
create table visits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  jobsite_id      uuid not null references jobsites(id) on delete cascade,
  technician_id   uuid not null references users(id) on delete restrict,
  route_id        uuid references routes(id) on delete set null,
  scheduled_date  date not null,
  scheduled_time  time,
  arrived_at      timestamptz,
  departed_at     timestamptz,
  arrived_lat     decimal(10,7),
  arrived_lng     decimal(10,7),
  departed_lat    decimal(10,7),
  departed_lng    decimal(10,7),
  geofence_radius_meters integer default 150,
  geofence_verified boolean default false,
  status          visit_status not null default 'scheduled',
  notes           text,
  duration_minutes integer,                        -- computed on departure
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_visits_org on visits(org_id);
create index idx_visits_date on visits(org_id, scheduled_date);
create index idx_visits_tech on visits(technician_id, scheduled_date);

-- 4.4 Service Orders (formal work orders)
create table service_orders (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  jobsite_id      uuid not null references jobsites(id) on delete cascade,
  visit_id        uuid references visits(id) on delete set null,
  assigned_to     uuid references users(id),
  requested_by    uuid references users(id),
  title           text not null,
  description     text,
  urgency         urgency_level not null default 'medium',
  status          service_order_status not null default 'draft',
  estimated_cost  decimal(10,2),
  actual_cost     decimal(10,2),
  scheduled_date  date,
  completed_at    timestamptz,
  tags            text[] default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_service_orders_org on service_orders(org_id);

-- 4.5 Photos
create table photos (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  entity_type     entity_type not null,            -- jobsite, visit, service_order
  entity_id       uuid not null,
  storage_url     text not null,
  thumbnail_url   text,
  caption         text,
  tags            text[] default '{}',
  lat             decimal(10,7),
  lng             decimal(10,7),
  taken_at        timestamptz,
  uploaded_by     uuid references users(id),
  created_at      timestamptz not null default now()
);

create index idx_photos_entity on photos(org_id, entity_type, entity_id);

-- 4.6 Documents (plans, permits, contracts)
create table documents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  entity_type     entity_type,                     -- nullable = org-level doc
  entity_id       uuid,
  doc_type        doc_type not null default 'other',
  name            text not null,
  storage_url     text not null,
  file_size_bytes bigint,
  mime_type       text,
  uploaded_by     uuid references users(id),
  created_at      timestamptz not null default now()
);

create index idx_documents_entity on documents(org_id, entity_type, entity_id);

-- 4.7 Signatures
create table signatures (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  entity_type     entity_type not null,            -- service_order, visit
  entity_id       uuid not null,
  signer_name     text not null,
  signer_email    text,
  signer_role     text,                            -- "Customer", "Site Manager", "Inspector"
  signature_url   text not null,                   -- stored image of signature
  ip_address      text,
  signed_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index idx_signatures_entity on signatures(org_id, entity_type, entity_id);

-- 4.8 Equipment (per-jobsite)
create table equipment (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  jobsite_id      uuid not null references jobsites(id) on delete cascade,
  name            text not null,                   -- "Main Pool Pump", "Exhaust Hood #3"
  equipment_type  text,                            -- freeform — defined by industry
  brand           text,
  model           text,
  serial_number   text,
  install_date    date,
  warranty_expiry date,
  last_serviced   date,
  condition       text default 'good',             -- freeform
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_equipment_jobsite on equipment(org_id, jobsite_id);

-- 4.9 Inventory (parts/materials — per tech truck or per jobsite)
create table inventory (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  sku             text,
  category        text,
  unit            text default 'each',
  unit_cost       decimal(10,2),
  quantity_on_hand decimal(10,2) not null default 0,
  reorder_point   decimal(10,2),
  location_type   text not null default 'warehouse',  -- warehouse, truck, jobsite
  location_id     uuid,                               -- truck=user_id, jobsite=jobsite_id
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_inventory_org on inventory(org_id);

-- 4.10 Inventory Usage Log
create table inventory_usage (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  inventory_id    uuid not null references inventory(id) on delete cascade,
  visit_id        uuid references visits(id),
  service_order_id uuid references service_orders(id),
  quantity_used   decimal(10,2) not null,
  used_by         uuid references users(id),
  notes           text,
  used_at         timestamptz not null default now()
);

-- 4.11 Industry Templates (reference table — seeds field_definitions for new orgs)
create table industry_templates (
  id              text primary key,                 -- 'pool_cleaning', 'hood_cleaning', etc.
  name            text not null,
  description     text,
  icon            text,
  field_definitions jsonb not null default '[]'::jsonb,  -- array of field def objects to seed
  default_settings jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger trg_organizations_updated before update on organizations for each row execute function update_updated_at();
create trigger trg_users_updated before update on users for each row execute function update_updated_at();
create trigger trg_jobsites_updated before update on jobsites for each row execute function update_updated_at();
create trigger trg_routes_updated before update on routes for each row execute function update_updated_at();
create trigger trg_visits_updated before update on visits for each row execute function update_updated_at();
create trigger trg_service_orders_updated before update on service_orders for each row execute function update_updated_at();
create trigger trg_equipment_updated before update on equipment for each row execute function update_updated_at();
create trigger trg_field_definitions_updated before update on field_definitions for each row execute function update_updated_at();
create trigger trg_field_values_updated before update on field_values for each row execute function update_updated_at();
create trigger trg_inventory_updated before update on inventory for each row execute function update_updated_at();

-- Auto-create user profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Compute visit duration on departure
create or replace function compute_visit_duration()
returns trigger as $$
begin
  if new.departed_at is not null and new.arrived_at is not null then
    new.duration_minutes = extract(epoch from (new.departed_at - new.arrived_at)) / 60;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_visit_duration before update on visits for each row execute function compute_visit_duration();
