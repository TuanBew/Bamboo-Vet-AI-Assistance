# Bamboo Vet — AI Assistant & Admin Dashboard

[![CI](https://github.com/TuanBew/Bamboo-Vet-AI-Assistance/actions/workflows/ci.yml/badge.svg)](https://github.com/TuanBew/Bamboo-Vet-AI-Assistance/actions/workflows/ci.yml)

> Trợ lý AI cho ngành thú y — AI-powered chatbot and business intelligence dashboard for Vietnamese veterinary distributors.

---

## Overview

Bamboo Vet is a full-stack web application built for **Công ty Cổ phần thương mại IMEXCO Việt Nam** and its distribution partner **Công ty CP Thú y Bamboovet Việt Nam**. It combines:

- **AI Chat Interface** — RAGflow-powered assistant that answers drug lookup, dosage, and treatment questions for veterinarians and distributors
- **Admin Analytics Dashboard** — Role-gated business intelligence panel with real-time sales data, inventory, customer maps, and revenue pivots drawn from live corporate ERP data
- **MCP Server** — Standalone Model Context Protocol HTTP server that exposes the RAGflow AI as a tool endpoint, enabling Claude and other MCP-compatible clients to query the veterinary knowledge base directly

---

## Deployment

### Primary — Company Server (Docker)

Full-stack deployment on the company Windows 11 server via Docker Compose + Caddy + Let's Encrypt.
The company server's IP is whitelisted on the corporate MySQL database, so all admin analytics work.

```powershell
# On the company server — one command after copying the project folder
.\deploy.ps1
```

See **[`docs/COMPANY-SERVER-SETUP.md`](docs/COMPANY-SERVER-SETUP.md)** for the complete first-time setup walkthrough.

| Feature | Status |
|---|---|
| Public AI chat — streaming via Docker-internal MCP | ✅ Live |
| Supabase authentication (login, session, admin JWT) | ✅ Live |
| Admin shell (sidebar + topbar) | ✅ Live |
| Admin analytics data (MySQL ERP) | ✅ Live — company server IP is whitelisted |
| API security (401/403 on all admin routes) | ✅ Live |
| HTTPS — Caddy + Let's Encrypt + DuckDNS | ✅ Auto-provisioned on first run |

### Public — Vercel (`bamboo-vet-ai.vercel.app`)

The Vercel deployment at **[https://bamboo-vet-ai.vercel.app](https://bamboo-vet-ai.vercel.app)** serves as the public-facing / staging environment.

| Feature | Status |
|---|---|
| Public AI chat — streaming via MCP + ngrok | ✅ Live |
| Supabase authentication (login, session, admin JWT) | ✅ Live |
| Admin shell (sidebar + topbar) | ✅ Live |
| Admin analytics data (MySQL ERP) | ⛔ Not available — Vercel serverless IPs not whitelisted on corporate MySQL |
| API security (401/403 on all admin routes) | ✅ Live |

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

### MCP Server (`/mcp-server`)

A standalone Node.js HTTP server that implements the [Model Context Protocol](https://modelcontextprotocol.io/) over HTTP, enabling any MCP-compatible client (Claude Desktop, Claude Code, etc.) to call the RAGflow veterinary knowledge base as a native tool.

| Feature | Detail |
|---|---|
| Protocol | MCP over HTTP (JSON-RPC 2.0) |
| Authentication | Bearer token (HMAC-SHA256, configurable expiry) |
| Rate limiting | 60 requests/minute per token (in-memory) |
| Tools exposed | `ragflow_chat`, `ragflow_list_chats` — query the RAGflow knowledge base |
| Logging | Structured JSON via `logger.ts` |
| Tunnel support | ngrok via `start-tunnel.ps1` — one-command server + tunnel launcher (Windows) |

See [`mcp-server/README.md`](mcp-server/README.md) for setup, token generation, and tunnel instructions.

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
| Testing | Vitest (unit) + Playwright (E2E — port 3001) |
| MCP Server | Node.js HTTP server, TypeScript, Vitest |

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
├── mcp-server/                # Standalone MCP HTTP server
│   ├── src/
│   │   ├── index.ts           # HTTP entry point (port 3100)
│   │   ├── server.ts          # MCP server + tool registration
│   │   ├── ragflow-client.ts  # RAGflow API bridge
│   │   ├── auth.ts            # Bearer token validation
│   │   ├── rate-limiter.ts    # Per-token rate limiting
│   │   └── logger.ts          # Structured JSON logger
│   ├── scripts/generate-token.ts  # CLI to issue signed tokens
│   ├── start-tunnel.ps1       # One-command MCP server + ngrok tunnel launcher (Windows)
│   └── tests/                 # Vitest unit tests for all modules
├── tests/
│   ├── e2e/                   # Playwright E2E specs (auth, all admin pages)
│   ├── production/            # Docker stack smoke tests (playwright.docker.config.ts)
│   └── performance/
│       └── global-setup.ts    # Admin login + storageState for E2E
├── TESTING.md                 # Formal QA Test Execution Report (QA-2026-001)
├── Dockerfile                 # Next.js app container (standalone build)
├── docker-compose.yml         # Full stack: next-app + mcp-server + caddy + duckdns-updater
├── docker-compose.local.yml   # HTTP-only override for local/LAN deployment (port 8080)
├── Caddyfile                  # Caddy reverse proxy — HTTPS with Let's Encrypt + DuckDNS
├── Caddyfile.local            # Caddy config — HTTP-only (port 8080)
├── deploy.ps1                 # One-command deployment script (Windows PowerShell)
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
npm test              # Unit tests (Vitest) — all API route + service unit tests
npm run test:e2e      # E2E tests (Playwright, requires dev server on :3000)
npm run test:all      # Both suites in sequence
```

The Playwright E2E suite covers auth guards, admin shell, and all six admin pages. Authenticated tests require `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` env vars (see `tests/performance/global-setup.ts`). Unauthenticated auth-guard tests run without credentials.

Full test execution results are documented in [`TESTING.md`](TESTING.md) (Report QA-2026-001 — 134 tests executed, 134 passed, 0 failed).

### Production Deployment Tests

**Docker stack — 12 tests (DOK-01 to DOK-12), requires Docker stack running:**
```bash
DOCKER_TEST_EMAIL="<admin-email>" DOCKER_TEST_PASSWORD="<admin-password>" \
  npx playwright test --config=playwright.docker.config.ts
# or: npm run test:docker   (reads DOCKER_TEST_EMAIL / DOCKER_TEST_PASSWORD from env)
```

Requires the full Docker Compose stack running via `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d`.

**Vercel — 9 tests (VRC-01 to VRC-09), targets `bamboo-vet-ai.vercel.app`:**
```bash
VERCEL_TEST_EMAIL="<admin-email>" VERCEL_TEST_PASSWORD="<admin-password>" \
  npx playwright test --config=playwright.vercel.config.ts tests/vercel/vercel-verify.spec.ts
# or: npm run test:vercel   (reads VERCEL_TEST_EMAIL / VERCEL_TEST_PASSWORD from env)
```

**Selenium — 8 tests (SEL-01 to SEL-08), targets Vercel URL:**
```bash
VERCEL_TEST_EMAIL="<admin-email>" VERCEL_TEST_PASSWORD="<admin-password>" \
  python -X utf8 tests/selenium/test_vercel_production.py
```
Requires: Python 3, `pip install selenium requests`, ChromeDriver on PATH.

### MCP Server Tests

```bash
cd mcp-server && npm test     # Vitest unit tests for auth, rate limiter, server, RAGflow client
```

---

## MCP Server Setup

The MCP server runs as a separate process alongside the Next.js app.

```bash
cd mcp-server
cp .env.example .env          # fill RAGFLOW_BASE_URL, RAGFLOW_API_KEY, MCP_JWT_SECRET
npm install
npm run generate-token        # prints a signed Bearer token to use in your MCP client
.\start-tunnel.ps1            # starts server on port 3100 + launches ngrok tunnel (Windows)
# or: npm start               # server only, no tunnel
```

`start-tunnel.ps1` prints the live ngrok URL and the exact `MCP_SERVER_URL=...` line to add to `.env.local`. Configure Claude Desktop or Claude Code to point at the ngrok URL with the generated token. See [`mcp-server/README.md`](mcp-server/README.md) for full configuration examples.

---

## License

Private — proprietary to Công ty Cổ phần thương mại IMEXCO Việt Nam. All rights reserved.
