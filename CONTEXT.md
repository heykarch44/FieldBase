# FieldIQ / FieldBase — Project Context

## Overview
Field service management platform for small/mid field service companies. Multi-tenant SaaS with dynamic field engine, configurable per-org workflows, and mobile app for technicians.

- **Repo (Core/Dashboard):** https://github.com/heykarch44/FieldBase
- **Sales Site:** fldiq.com
- **Office Dashboard:** wrk.fldiq.com (auto-deploys via GitHub push to main)
- **Tech Stack:** Next.js, Supabase (Postgres, Auth, Storage, RLS), Cloudflare Workers
- **Mobile App:** React Native / Expo

---

## Architecture

### Multi-Tenant Core
- Organizations with slug, template_id, plan tier, Stripe billing placeholder
- `org_members` + `org_invites` — team management with role-based access (owner/admin/manager/technician/viewer)
- All tables enforced by `org_id` via Supabase RLS
- Helper functions: `auth.active_org_id()`, `auth.has_org_role()`

### Dynamic Field Engine
- `field_definitions` + `field_values` — companies define their own fields, labels, types, groupings, and validation rules
- Industry templates are just sets of `field_definitions` copied to a new org on signup
- Companies can modify everything — rename labels, add/remove/reorder fields
- Template is a starting point, never a constraint

### Database Schema (16 tables)
- `organizations` — multi-tenant with slug, template_id, plan tier
- `org_members` — team management with roles
- `org_invites` — email invitations
- `users` — linked to auth.users
- `field_definitions` + `field_values` — dynamic field engine
- `jobsites` (renamed to "Sites" in UI) — generic location model
- `visits` — scheduled service visits
- `service_orders` — work orders with kanban workflow
- `service_order_assignees` — junction table for multi-tech assignment
- `routes` — for route-based companies
- `photos`, `documents`, `signatures` — capture and documentation
- `equipment`, `inventory`, `inventory_usage` — parts and asset tracking
- `industry_templates` — seeded with 7 templates

### Industry Templates (Seeded)
1. Pool Cleaning
2. Hood Cleaning
3. Cabinet Installation
4. HVAC
5. Pest Control
6. Duct Cleaning
7. Blank

---

## Key Requirements

### Tech View (Configurable Per Org)
- **Routes mode:** Daily route list with ordered stops (for route-based companies)
- **Schedule mode:** Appointments and multi-day projects (kanban/project view)
- Toggle lives in admin dashboard: Settings > Organization > Workflow card
- Two visual buttons — Routes vs Schedule — saved to org settings

### Timeclock
- Clock in/out is per visit (not per day)
- "Day" defined from first visit to last visit
- Geofenced

### Routes
- Toggleable per org (some companies use routes, others don't)

---

## Dashboard Features

### Service Orders (Kanban)
- Kanban board with status columns (pending → approved → in_progress → completed)
- Multi-tech assignment via `service_order_assignees` junction table
- Edit modal with multi-select tech picker (teal chip tags with X to remove)
- Cards show all assigned tech names

### Sites (formerly "Jobsites")
- Renamed throughout dashboard — sidebar nav, page header, modal, forms, search
- Add site form includes org_id and status for RLS compliance

### Team Management
- Invite Member flow (email-based with role selection)
- **Direct Add Member** — admin can create tech accounts instantly from dashboard:
  - Fill in name, email, role (defaults to Technician), optional temp password
  - Account created immediately, no email confirmation needed
  - Share temp password with tech to log in right away

### Field Manager (Settings → Fields)
- Admin UI for companies to add, rename, reorder, and configure their fields
- Live mobile preview panel

---

## Mobile App (Expo/React Native)

### Tech Home Screen
- Visits grouped into: Active (in-progress), Today, Upcoming (next 7 days)
- Each card: site name, address, scheduled time, status

### Visit Workflow
Step-by-step tabs: Arrive → Fields → Photos → Notes → Order → Depart
- "Order" tab: create service order (request to office for follow-up work)

### Service Orders Tab (Bottom Nav)
- Between Schedule and History, clipboard icon
- Pulls all orders assigned to tech via `service_order_assignees`
- Grouped into: In Progress (teal), Assigned (sorted by urgency), Completed (last 20)
- Each card: title, site name, urgency badge, status chip
- Tap to expand: full description, scheduled date, requester, estimated cost, site address
- "Tap to navigate" opens Apple/Google Maps
- Pull to refresh

---

## Auth & Signup Flow

### Signup
- Early access form on fldiq.com
- `emailRedirectTo: 'https://wrk.fldiq.com'` — confirmation link redirects to dashboard (not sales site)
- Root page is client component that detects auth tokens in URL hash, lets Supabase JS pick them up, redirects to /dashboard

### Trigger Function (`handle_new_user`)
- Fires on `auth.users` INSERT
- Creates user record in `public.users`
- If `company_name` provided in metadata: creates org, org_member (owner role), sets active_org_id
- Uses `SET search_path = public` and fully-qualified table names (`public.users`, `public.organizations`, etc.) — required because auth service fires trigger under different execution context

### Known Fix Applied
- Recursive RLS policies caused infinite loop — fixed with explicit search_path
- Login check uses `memberships.length > 0` (not `user.org_role` which doesn't exist on User type)
- Profile role badge displays `memberships.role`

---

## Development Phases

| Phase | What | Status |
|-------|------|--------|
| 1 | Multi-tenant core + dynamic field engine (16 tables, 3,847 lines) | Done |
| 2 | Supabase project setup + deploy to Cloudflare | Done |
| 3 | Route optimization + geofencing polish | Pending |
| 4 | Stripe billing + plan tiers + onboarding | Pending |
| 5 | Additional templates (JSON configs, ~1 day each) | Pending |

---

## Cleanup Actions Taken
- Deleted 7 spam/test waitlisted orgs ("Acme", "Goods", "fdsaf", "fds", "fdas", "afds", "as") along with associated org_members, public.users, and auth.users entries
- Early access signups now properly route to appropriate org

---

## Key Conversation Links
- FieldBase fork & Phase 1: https://perplexity.ai/search/e7930b35-3011-496d-8fea-26cf9d293c86
- Phase 2 deployment: https://perplexity.ai/search/23a85e2c-c45c-4294-8ad3-46b5b94d902e
- Auth trigger fix (search_path): https://perplexity.ai/search/d630fe57-0ff6-4999-aa95-4a7dc00c6269
- Email redirect fix: https://perplexity.ai/search/6eb67097-26f7-4036-ab31-0f71f4e413f0
- Login bug fix: https://perplexity.ai/search/e06d124b-b3a5-4a15-bb53-7026a9831dc2
- Tech view toggle: https://perplexity.ai/search/5f6d594b-b437-4897-aa3c-5f4e0cc54dc4
- Sites rename + add fix: https://perplexity.ai/search/cc6d7f3a-ed1b-4d95-95eb-f495b047f0a9
- Direct tech onboarding: https://perplexity.ai/search/c781cfa9-070f-49ed-931f-b6c70b53ec7f
- Multi-tech service orders: https://perplexity.ai/search/cd6ff937-dc81-475c-b291-e74ff0e8ef2c
- Mobile service orders tab: https://perplexity.ai/search/37dfb020-2ba5-4ad5-97ae-4c9ecc5c6ffe
