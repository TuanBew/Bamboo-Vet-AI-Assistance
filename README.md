# Bamboo Vet — AI Assistant & Admin Dashboard

> Trợ lý AI cho ngành thú y — AI-powered chatbot and business intelligence dashboard for Vietnamese veterinary distributors.

---

## Overview

Bamboo Vet is a mock full-stack web application built for **Công ty Cổ phần thương mại IMEXCO Việt Nam** and its distribution partner  **Công ty CP Thú y Bamboovet Việt Nam**. It combines:

- **AI Chat Interface** — RAGflow-powered assistant that answers drug lookup, dosage, and treatment questions for veterinarians and distributors
- **Admin Analytics Dashboard** — Role-gated business intelligence panel with real-time sales data, inventory, customer maps, and revenue pivots drawn from live ERP data

---

## Features

### AI Chat (Public)
- Conversational AI via RAGflow (OpenAI-compatible SSE streaming)
- Rate-limited per guest (30 req/60s) and authenticated user (60 req/60s) via Upstash Redis
- Conversation history stored in Supabase

### Admin Panel (`/admin/*`)
Access is restricted to users with `is_admin: true` in Supabase `app_metadata`.

| Page | Vietnamese | Purpose |
|---|---|---|
| Dashboard | Tổng quan | Sales + purchases KPIs, area/bar charts with 3-month forecast, customer map |
| Nhập hàng | Nhập hàng | Purchase receipt analytics — daily/monthly trends, top products, supplier breakdown |
| Tồn kho | Tồn kho | Inventory snapshot by date and SKU — value/quantity breakdowns per group |
| Khách hàng | Khách hàng | Customer analytics — new customers per month, by province, by type; interactive map |
| Check Khách hàng | Check KH | Paginated customer list with interactive Leaflet map, fly-to on click, and per-customer revenue pivot (brand × month, 2025-01 → present) |
| Check NPP | Check NPP | Distributor monthly ColorPivotTable with colour thresholds (green/yellow/red) |

**Shared Admin Components:**
- `DataTable` — TanStack Table v8 with Copy / Excel / CSV / PDF / Print export
- `ColorPivotTable` — monthly pivot with green (>50) / yellow (10-50) / red (1-9) / grey (0) thresholds
- `MapView` — SSR-safe Leaflet map with SVG customer-type icons and popup detail
- `KpiCard` — metric cards with configurable colours and icons
- `SectionHeader` — collapsible sections with chevron toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (TypeScript strict) |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL 17) — RPC functions + materialized views |
| Auth | Supabase Auth + SSR sessions; `is_admin` from JWT `app_metadata` |
| Charts | Recharts (Bar, Area, Line, Pie, Radar) |
| Maps | react-leaflet with `next/dynamic ssr:false` |
| Tables | TanStack React Table v8 |
| AI Backend | RAGflow (self-hosted, OpenAI-compatible SSE) |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) |
| Export | xlsx + jsPDF + jspdf-autotable (Vietnamese font embedded) |
| Testing | Vitest (unit) |

---

## Project Structure

```
├── app/
│   ├── (auth)/login/         # Login page
│   ├── (public)/chat/        # Public AI chat interface
│   ├── admin/                # Admin panel (middleware-gated)
│   │   ├── layout.tsx        # Admin shell: sidebar + top bar
│   │   ├── dashboard/        # Dashboard page
│   │   ├── nhap-hang/        # Purchase analytics
│   │   ├── ton-kho/          # Inventory
│   │   ├── khach-hang/       # Customer analytics
│   │   ├── check-customers/  # Customer detail + revenue pivot
│   │   └── check-distributor/# Distributor pivot
│   └── api/admin/            # Protected REST endpoints (requireAdmin guard)
├── components/
│   ├── admin/                # Business-aware admin UI components
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── admin/
│   │   ├── services/         # Data fetching + aggregation (one file per feature)
│   │   ├── auth.ts           # requireAdmin() API guard
│   │   ├── customer-types.ts # SVG icon + colour config per customer type
│   │   └── forecast.ts       # Linear regression forecast utility
│   ├── supabase/             # Client factories (browser / server / middleware)
│   └── ragflow.ts            # RAGflow API client + SSE parser
├── supabase/migrations/      # SQL migration files (committed)
└── scripts/                  # Utility scripts (seed, import, perf audit)
```

Each admin feature follows the pattern:
```
app/admin/<feature>/
  page.tsx          # Server Component — Suspense wrapper + searchParams
  <X>Loader.tsx     # Server Component — fetches initialData from service
  <X>Client.tsx     # Client Component — interactive state + API refetch
  <X>Skeleton.tsx   # Suspense fallback skeleton
```

---

## Getting Started

### Prerequisites
- Node.js LTS
- npm
- A [Supabase](https://supabase.com) project
- A [RAGflow](https://ragflow.io) instance (self-hosted or cloud)
- An [Upstash Redis](https://upstash.com) database

### 1. Clone and install

```bash
git clone <repo-url>
cd bamboo-vet
npm install
```

### 2. Configure environment

Copy and fill in all required variables:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# RAGflow
RAGFLOW_BASE_URL=http://127.0.0.1:9380
RAGFLOW_API_KEY=<ragflow-api-key>
RAGFLOW_CHAT_ID=<ragflow-chat-id>

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://<redis>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

### 3. Apply database migrations

```bash
supabase db push
```

Or apply migrations manually from `supabase/migrations/` in order.

After migration, register the custom access token hook in Supabase Dashboard:
- **Authentication → Hooks → Custom Access Token** → select `public.custom_access_token_hook`

### 4. Seed data (optional)

```bash
npx tsx scripts/seed.ts          # Seed user profiles
npx tsx scripts/seed-sales.ts    # Seed sample sales data
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Authentication Flow

1. Users sign in at `/login` via email/password
2. Supabase Auth issues a JWT; the custom access token hook reads `profiles.is_admin` and injects it into `app_metadata`
3. Next.js middleware (`lib/supabase/middleware.ts`) reads `is_admin` from the JWT claim — zero DB round-trip on every request
4. `/admin/*` routes redirect unauthenticated or non-admin users to `/login`
5. All `/api/admin/*` route handlers call `requireAdmin()` for double-checking

---

## Database Architecture

The core ERP tables are:

| Table | Purpose |
|---|---|
| `door` | Sales / outbound order lines (ban hang) — 300k+ rows |
| `dpur` | Purchase / inbound order lines (nhap hang) |
| `product` | SKU master data |
| `profiles` | User profiles with `is_admin` flag |
| `clinics` | Clinic and customer location data |
| `conversations` / `messages` | Chat history |

Heavy aggregations are done via PostgreSQL **RPC functions** (SECURITY DEFINER) to keep row transfer minimal. A materialized view `mv_dashboard_kpis` pre-aggregates the main dashboard KPIs and can be refreshed from the admin top bar.

---

## Scripts

Useful utility scripts in `scripts/`:

| Script | Purpose |
|---|---|
| `seed.ts` | Seed user profiles |
| `seed-sales.ts` | Seed sample sales data |
| `import-real-data.ts` | Import ERP data from CSV |
| `refresh-views.ts` | Manually refresh materialized views |
| `perf-audit.ts` | Performance audit against live DB |

Run with:
```bash
npx tsx scripts/<script>.ts
```

---

## Development Notes

- **All Vietnamese UI strings** are centralised in `lib/i18n/vietnamese.ts`
- **Map components** must be loaded with `next/dynamic({ ssr: false })` — Leaflet requires a browser environment
- **Admin API routes** must call `requireAdmin()` before any data access
- **Service role key** must never appear in client bundles — only used in server-side `createServiceClient()`
- **Chart colours** are defined per-page in each `*Client.tsx` — see `CONCERNS.md` for the refactor opportunity

---

## License

Private — proprietary to Công ty Cổ phần thương mại IMEXCO Việt Nam. All rights reserved.
