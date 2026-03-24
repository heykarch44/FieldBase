# FieldBase

An industry-agnostic field service management platform. FieldBase enables organizations to manage jobsites, schedule technician visits, capture dynamic field data, track service orders, and operate offline-first from the field.

## Tech Stack

- **Mobile App**: Expo / React Native (SDK 54, Expo Router)
- **Dashboard**: Next.js 16 (App Router, React Server Components)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Deployment**: Cloudflare Pages (dashboard), EAS (mobile)
- **Offline Storage**: expo-sqlite with sync queue

## Key Features

- **Multi-tenant**: Organizations with role-based access (owner, admin, manager, technician, viewer)
- **Dynamic Fields**: Define custom data fields per organization — no schema changes needed for new industries
- **Industry Templates**: Pre-built field templates for pool service, HVAC, pest control, landscaping, and more
- **Offline-first Mobile**: Full offline support with automatic background sync when connectivity returns
- **GPS Geofencing**: Arrival/departure verification with GPS coordinates
- **Photo & Signature Capture**: Attach photos and collect signatures on visits
- **Service Orders**: Technicians can submit follow-up work requests from the field
- **Route Management**: Drag-and-drop route optimization with daily scheduling

## Getting Started

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations:
   ```bash
   # Apply schema
   psql $DATABASE_URL < supabase/migrations/00001_fieldbase_schema.sql
   psql $DATABASE_URL < supabase/migrations/00002_fieldbase_rls.sql
   ```
3. Seed with sample data:
   ```bash
   psql $DATABASE_URL < supabase/seed.sql
   ```

### 2. Dashboard Setup

```bash
cd dashboard
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

The dashboard runs at `http://localhost:3000`.

### 3. Mobile App Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npx expo start
```

Scan the QR code with Expo Go or run on a simulator.

### 4. Cloudflare Deployment (Dashboard)

```bash
cd dashboard
npm run deploy
```

## Industry Templates

FieldBase ships with field definition templates for:

- Pool Service (chemical readings, equipment checks)
- HVAC (system diagnostics, filter conditions)
- Pest Control (treatment types, infestation levels)
- Landscaping (service areas, seasonal tasks)
- General Field Service (customizable)

Templates are applied per-organization and can be customized through the Field Manager in the dashboard.

## Project Structure

```
├── app/                    # Expo Router mobile app screens
│   ├── auth/               # Login screen
│   ├── (tabs)/             # Tab navigator (Today, History, Profile)
│   └── visit/              # Visit detail / service workflow
├── src/
│   ├── components/         # Shared React Native components
│   ├── constants/          # Theme, colors
│   ├── hooks/              # Custom hooks (route data, visit history, etc.)
│   ├── lib/                # Supabase client, offline DB, sync engine
│   ├── providers/          # Auth, Network providers
│   └── types/              # TypeScript type definitions
├── dashboard/              # Next.js 16 dashboard app
│   ├── app/                # App Router pages
│   │   └── dashboard/      # Authenticated dashboard routes
│   ├── components/         # Dashboard UI components
│   └── lib/                # Supabase client, utilities
├── supabase/
│   ├── migrations/         # SQL migration files
│   └── seed.sql            # Sample data
└── assets/                 # App icons, splash screen
```
