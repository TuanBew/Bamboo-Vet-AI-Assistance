# Bamboo Vet — AI Assistant & Admin Dashboard

> Trợ lý AI cho ngành thú y — AI-powered chatbot and business intelligence dashboard for Vietnamese veterinary distributors.

---

## Overview

Bamboo Vet is a full-stack web application built for **Công ty Cổ phần thương mại IMEXCO Việt Nam** and its distribution partner **Công ty CP Thú y Bamboovet Việt Nam**. It combines:

- **AI Chat Interface** — RAGflow-powered assistant that answers drug lookup, dosage, and treatment questions for veterinarians and distributors
- **Admin Analytics Dashboard** — Role-gated business intelligence panel with real-time sales data, inventory, customer maps, and revenue pivots drawn from live corporate ERP data

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
| Dashboard | Tổng quan | Sales + purchases KPIs, area/bar charts with 3-month SMA forecast, customer map |
| Nhập hàng | Nhập hàng | Purchase receipt analytics — daily/monthly trends, top products, supplier breakdown |
| Tồn kho | Tồn kho | Inventory snapshot by date and SKU — value/quantity breakdowns per group |
| Khách hàng | Khách hàng | Customer analytics — new customers per month, by province, by type; interactive map |
| Check Khách hàng | Check KH | Paginated customer list with Leaflet map, fly-to on click, per-customer revenue pivot (brand × month) |
| Check NPP | Check NPP | Distributor monthly ColorPivotTable with colour thresholds (green/yellow/red) |

**Shared Admin Components:**
- `DataTable` — TanStack Table v8 with Copy / Excel / CSV / PDF / Print export
- `ColorPivotTable` — monthly pivot with green (>50) / yellow (10-50) / red (1-9) / grey (0) thresholds
- `MapView` — SSR-safe Leaflet map with SVG customer-type icons and popup detail
- `KpiCard` — metric cards with configurable colours and icons
- `SectionHeader` — collapsible sections with chevron toggle
- `AIAnalysisBoard` — Gemini-powered AI insight panel with streaming analysis

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (TypeScript strict) |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| Auth & Chat DB | Supabase (PostgreSQL) — Auth + conversation history |
| ERP Data | MySQL — corporate database (read-only, SQL validator enforced) |
| AI Backend | RAGflow (self-hosted, OpenAI-compatible SSE) + Google Gemini |
| Auth | Supabase Auth + SSR sessions; `is_admin` from JWT `app_metadata` |
| Charts | Recharts (Bar, Area, Line, Pie, Radar) |
| Maps | react-leaflet with `next/dynamic ssr:false` |
| Tables | TanStack React Table v8 |
| Rate Limiting | Upstash Redis (`@upstash/ratelimit`) |
| Export | xlsx + jsPDF + jspdf-autotable (Vietnamese font embedded) |
| Testing | Vitest (unit) + Playwright (E2E) |

---

## Project Structure

```
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (public)/chat/         # Public AI chat interface
│   ├── admin/                 # Admin panel (middleware-gated)
│   │   ├── layout.tsx         # Admin shell: sidebar + top bar
│   │   ├── dashboard/         # Dashboard page
│   │   ├── nhap-hang/         # Purchase analytics
│   │   ├── ton-kho/           # Inventory
│   │   ├── khach-hang/        # Customer analytics
│   │   ├── check-customers/   # Customer detail + revenue pivot
│   │   └── check-distributor/ # Distributor pivot
│   └── api/admin/             # Protected REST endpoints (requireAdmin guard)
├── components/
│   ├── admin/                 # Business-aware admin UI components
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── admin/
│   │   ├── services/          # Data fetching + aggregation (one file per feature)
│   │   ├── auth.ts            # requireAdmin() API guard
│   │   ├── customer-types.ts  # SVG icon + colour config per customer type
│   │   └── forecast.ts        # 2-month SMA rolling forecast utility
│   ├── mysql/                 # MySQL connection pool + read-only query client
│   ├── supabase/              # Supabase client factories (browser / server / middleware)
│   └── ragflow.ts             # RAGflow API client + SSE parser
└── supabase/migrations/       # Supabase schema migration files (reference)
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
- A [Supabase](https://supabase.com) project (for Auth + conversation storage)
- Access to the corporate MySQL database (read-only credentials)
- A [RAGflow](https://ragflow.io) instance (self-hosted or cloud)
- An [Upstash Redis](https://upstash.com) database (rate limiting)

### 1. Clone and install

```bash
git clone <repo-url>
cd bamboo-vet
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all variables in `.env.local`:

```env
# Supabase (Auth + Chat history)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# MySQL (Corporate ERP — read-only)
MYSQL_HOST=<host>
MYSQL_PORT=3306
MYSQL_DATABASE=<database>
MYSQL_USER=<user>
MYSQL_PASSWORD=<password>
MYSQL_SSL=true

# RAGflow
RAGFLOW_BASE_URL=http://127.0.0.1:9380
RAGFLOW_API_KEY=<ragflow-api-key>
RAGFLOW_CHAT_ID=<ragflow-chat-id>

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://<redis>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

### 3. Set up Supabase Auth

Apply the Supabase migrations for auth and conversation tables:

```bash
supabase db push
```

Register the custom access token hook in Supabase Dashboard:
- **Authentication → Hooks → Custom Access Token** → select `public.custom_access_token_hook`

This injects `is_admin` from the `profiles` table into the JWT `app_metadata` claim, enabling zero-DB-roundtrip admin checks in middleware.

### 4. Run the development server

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
5. All `/api/admin/*` route handlers call `requireAdmin()` for an additional server-side check

---

## Database Architecture

### MySQL (Corporate ERP — read-only)

All admin analytics read from the corporate MySQL database via `lib/mysql/client.ts`, which enforces:
- **SQL validator** — rejects any non-SELECT/CALL/SHOW/DESCRIBE statement at the application level
- **Audit logger** — logs every query with execution time to `.mysql-audit.log`

Key ERP tables:

| Table | Purpose |
|---|---|
| `door` | Sales / outbound order lines (bán hàng) — 300k+ rows |
| `dpur` | Purchase / inbound order lines (nhập hàng) |
| `product` | SKU master data |
| `CustClass` | Customer classification types |

### Supabase (Auth + Conversations)

| Table | Purpose |
|---|---|
| `profiles` | User profiles with `is_admin` flag |
| `conversations` / `messages` | Chat history |
| `clinics` | Clinic/customer location data (geo pins) |

---

## Testing

```bash
npm test              # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright, requires dev server on :3000)
npm run test:all      # Both
```

---

## License

Private — proprietary to Công ty Cổ phần thương mại IMEXCO Việt Nam. All rights reserved.
