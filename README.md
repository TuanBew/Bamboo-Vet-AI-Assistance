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

### Public — Vercel (`bamboo-vet-ai.vercel.app`)

The Vercel deployment at **[https://bamboo-vet-ai.vercel.app](https://bamboo-vet-ai.vercel.app)** is the primary internet-facing app path. Vercel should run with `MYSQL_MODE=backup` and a hosted read-only backup MySQL database so admin analytics do not depend on company-server IP whitelisting.

- Main app: Vercel / custom domain
- Admin data: hosted read-only backup MySQL (`BACKUP_MYSQL_*` env vars)
- Chat: `MCP_SERVER_URL` must point to a stable public HTTPS tunnel/domain that reaches the local MCP server and local RAGflow
- Docker/company-server deployment remains available for the non-Vercel path

| Feature | Status |
|---|---|
| Public AI chat — streaming via MCP over stable HTTPS tunnel | ✅ Supported when `MCP_SERVER_URL` is reachable |
| Supabase authentication (login, session, admin JWT) | ✅ Live |
| Admin shell (sidebar + topbar) | ✅ Live |
| Admin analytics data | ✅ Via hosted read-only backup MySQL |
| API security (401/403 on all admin routes) | ✅ Live |

### Company Server (Docker)

Full-stack deployment on the company Windows 11 server via Docker Compose + Cloudflare Tunnel remains the non-Vercel path.
The company server's IP is whitelisted on the corporate MySQL database, so it can use company MySQL directly, or use a local Docker backup MySQL service when `MYSQL_MODE=backup`.
HTTPS is handled by Cloudflare — no inbound ports required on the server or router.

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
| Admin analytics data (MySQL ERP) | ✅ Live when company MySQL is reachable |
| API security (401/403 on all admin routes) | ✅ Live |
| HTTPS — Cloudflare Tunnel | ✅ Cloudflare-managed cert, no inbound ports needed |

### Local live deployment with backup MySQL

Bamboo Vet can run live from Tuan Anh's machine through Docker Compose and Cloudflare Tunnel. The stack contains:

- `next-app` — Next.js standalone runtime
- `mcp-server` — Docker-internal MCP relay to local RAGflow
- `cloudflared` — outbound Cloudflare Tunnel ingress
- `backup-mysql` — local MySQL 8.0 initialized from `samples/dashboard_bamboovet.sql`

Company MySQL remains the primary analytics source for the company-server path. Set `MYSQL_MODE=auto` to probe company MySQL once when the app initializes. If the probe succeeds, the process locks to primary mode. If it fails, the process locks to local backup mode and does not retry company MySQL on every request.

Supported modes:

| Mode | Behavior |
| --- | --- |
| `MYSQL_MODE=auto` | Probe company MySQL once, then lock to primary or backup until container restart. |
| `MYSQL_MODE=primary` | Use company MySQL only. Deployment fails clearly if it is unreachable. |
| `MYSQL_MODE=backup` | Use configured backup MySQL only. Company MySQL is not probed. Required for Vercel production. |

The backup SQL dump is deployment input, not source code. Do not commit `.env` or `samples/dashboard_bamboovet.sql` unless explicitly approved.

#### Backup dump refresh

The official MySQL image imports files from `/docker-entrypoint-initdb.d` only when the database volume is empty. Re-running `docker compose up` does not re-import a changed dump.

To refresh local Docker backup data, intentionally stop the stack and recreate only the backup volume after confirming the old local backup can be discarded:

```powershell
docker compose down
# Replace <project> with your Compose project name if it differs from bamboo-vet-prod.
docker volume rm <project>_backup-mysql-data
docker compose up -d --build
```

Never run this against company MySQL or the hosted backup MySQL. This only affects the local Docker backup volume.

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
├── docker-compose.yml         # Full stack: next-app + mcp-server + cloudflared (Cloudflare Tunnel)
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
- Access to a read-only MySQL source: hosted backup MySQL for Vercel, or corporate/company MySQL for Docker/company-server deployment
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

# Vercel production: hosted backup MySQL (read-only)
MYSQL_MODE=backup
BACKUP_MYSQL_HOST=<hosted-mysql-host>
BACKUP_MYSQL_PORT=3306
BACKUP_MYSQL_DATABASE=<hosted-backup-db>
BACKUP_MYSQL_USER=<readonly-user>
BACKUP_MYSQL_PASSWORD=<readonly-password>
BACKUP_MYSQL_SSL=true

# Docker/company-server: company MySQL or local backup service
# MYSQL_MODE=auto
# MYSQL_HOST=<company-mysql-host>
# MYSQL_PORT=3306
# MYSQL_DATABASE=<database>
# MYSQL_USER=<readonly-user>
# MYSQL_PASSWORD=<password>
# MYSQL_SSL=true
# BACKUP_MYSQL_HOST=backup-mysql
# BACKUP_MYSQL_PORT=3306
# BACKUP_MYSQL_SSL=false

# MCP/RAGflow for chat
# Vercel needs a stable public HTTPS MCP_SERVER_URL tunnel/domain.
# Docker/company-server can use http://mcp-server:3100.
MCP_SERVER_URL=https://<stable-mcp-tunnel-or-domain>
MCP_JWT_TOKEN=<mcp-jwt-token>
MCP_CHAT_ID=<ragflow-chat-id>
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

### MySQL (read-only ERP analytics)

All admin analytics read through `lib/mysql/client.ts`, which supports separate deployment modes:

- **Vercel production**: `MYSQL_MODE=backup` with hosted read-only backup MySQL (`BACKUP_MYSQL_*`), avoiding direct access from Vercel to the corporate database.
- **Docker/company-server**: `MYSQL_MODE=auto` or `MYSQL_MODE=primary` can use company MySQL directly when that server/network is whitelisted; `MYSQL_MODE=backup` can use the local Docker `backup-mysql` service.

The MySQL client enforces:
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
npm run test:e2e      # E2E tests (Playwright, requires dev server on :3001)
npm run test:all      # Both suites in sequence
```

The Playwright E2E suite covers auth guards, admin shell, and all six admin pages. Authenticated tests require `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` in `.env.local` (see `tests/performance/global-setup.ts`). Unauthenticated auth-guard tests run without credentials.

Full test execution results are documented in [`TESTING.md`](TESTING.md) (Report QA-2026-001 — 187 tests executed, 187 passed, 0 failed).

> **CI Note:** The GitHub Actions workflow runs Vercel smoke tests (VRC-01–VRC-09) on every push. These require `VERCEL_TEST_EMAIL` and `VERCEL_TEST_PASSWORD` to be configured as repository secrets (Settings → Secrets and variables → Actions).

### Production Deployment Tests

**Docker stack — 12 tests (DOK-01 to DOK-12), requires Docker stack running:**
```bash
DOCKER_TEST_EMAIL="<admin-email>" DOCKER_TEST_PASSWORD="<admin-password>" \
  npx playwright test --config=playwright.docker.config.ts
# or: npm run test:docker   (reads DOCKER_TEST_EMAIL / DOCKER_TEST_PASSWORD from env)
```

Requires the full Docker Compose stack running via `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d`.

**Vercel — 9 tests (VRC-01 to VRC-09), targets `bamboo-vet-ai.vercel.app` unless overridden:**
```bash
VERCEL_TEST_EMAIL="<admin-email>" VERCEL_TEST_PASSWORD="<admin-password>" \
  npx playwright test --config=playwright.vercel.config.ts tests/vercel/vercel-verify.spec.ts
# or: npm run test:vercel   (reads VERCEL_TEST_URL / VERCEL_TEST_EMAIL / VERCEL_TEST_PASSWORD from env)
```

Use `VERCEL_TEST_URL` for preview or custom-domain smoke tests. Admin/database checks require Vercel `MYSQL_MODE=backup` with hosted backup MySQL. Chat checks additionally require `MCP_SERVER_URL` to point at a stable public HTTPS tunnel/domain that can reach MCP/RAGflow.

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

`start-tunnel.ps1` prints the live ngrok URL and the exact `MCP_SERVER_URL=...` line to add to `.env.local`. For Vercel production, use a stable public HTTPS tunnel/domain for `MCP_SERVER_URL`; if that URL changes, update the Vercel environment variable and redeploy before expecting chat streaming to pass. Admin/database pages can still run from hosted backup MySQL independently of the MCP tunnel. Configure Claude Desktop or Claude Code to point at the tunnel URL with the generated token. See [`mcp-server/README.md`](mcp-server/README.md) for full configuration examples.

---

## License

Private — proprietary to Công ty Cổ phần thương mại IMEXCO Việt Nam. All rights reserved.
