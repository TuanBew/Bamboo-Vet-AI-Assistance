# Bamboo Vet — Admin SaaS Dashboard

## What This Is

Bamboo Vet is a bilingual (Vietnamese/English) AI veterinary chatbot platform. Product A (the chatbot at `/`, `/app`, `/chat`) is fully built and in production. This project adds Product B — an internal Vietnamese-only admin SaaS dashboard at `/admin/*` — to the same Next.js 15 monorepo, giving Bamboo Vet operators full visibility into platform usage: queries by clinic/province/drug group, knowledge base health, user engagement, and geographic distribution.

## Core Value

Admins can see exactly who is using the platform, what they're asking, and where they're located — so they can manage knowledge base quality, monitor clinic engagement, and identify usage patterns across the Vietnamese veterinary market.

## Requirements

### Validated

<!-- Existing chatbot (Product A) — shipped and working. Do not modify unless admin role redirect requires it. -->

- ✓ Bilingual AI veterinary chatbot UI (`/`, `/app`, `/chat`) — existing
- ✓ Supabase Auth with email/password login and email verification — existing
- ✓ SSE streaming chat with RAGflow backend — existing
- ✓ Conversation history stored in `conversations` + `messages` tables — existing
- ✓ Rate limiting via Upstash Redis — existing
- ✓ Next.js App Router with Tailwind CSS v4 + shadcn/ui — existing
- ✓ Vercel deployment — existing
- ✓ Content Security Policy headers — existing

### Active

<!-- Product B — Admin SaaS Dashboard (6 phases) -->

- [ ] Database: `profiles`, `chat_analytics`, `kb_documents` tables + materialized views
- [ ] Seed data: 80 users, ~4,000 conversations, ~20,000 messages, 120 KB documents (27 months)
- [ ] Admin role gate: `is_admin` field, middleware guard for `/admin/*`, redirect logic for admins at `/app`
- [ ] Admin shell: dark sidebar, top bar with refresh button, 7-page routing structure
- [ ] Dashboard page: KPI cards, time-series charts, category donuts, user table with sparklines, Leaflet clinic map
- [ ] New Activity page: 6 KPI cards, daily volume charts, recent sessions table, top questions, category donuts
- [ ] Knowledge Base page: 3 KPIs, 6 charts, paginated document table with Excel export
- [ ] Users Analytics page: 3 charts, 2 KPI sections, facility breakdown, heavy users table
- [ ] Check Users page: full-width Leaflet map, paginated user table with 5 export formats, monthly pivot table, conversation history drawer
- [ ] Check Clinics page: pivot table with color-coded cells, clinic detail modal (daily breakdown), multi-filter bar
- [ ] Settings page: admin profile display + manual data refresh trigger
- [ ] Middleware fix: rename `proxy.ts` → `middleware.ts`, rename export `proxy` → `middleware`

### Out of Scope

- Stripe / payments / usage limits — no monetization in this phase
- Mobile app — web-first; no React Native
- Multi-tenant clinic admin accounts — single admin role, SQL-promoted only
- File/image uploads in chat — Product A feature, not admin
- Voice input — out of scope
- Two-factor authentication — internal tool, not required
- Audit logging — future milestone
- External data integrations — seed data only; no live RAGflow analytics
- English language support in admin — Vietnamese only (internal operators)
- Real-time data — materialized views are batch-refreshed on demand
- Notification system — not needed for analytics dashboard
- Admin-UI role promotion — SQL-only by design

## Context

**Codebase state:** Next.js 15 (package.json says v16) App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui. Supabase Auth + Postgres + RLS. Upstash Redis rate limiting. RAGflow for AI chat (Product A only). Deployed on Vercel.

**Critical bug to fix first:** `proxy.ts` at project root exports a function named `proxy`, but Next.js only recognises `middleware.ts` with a `middleware` export. No middleware runs today. This must be fixed in Phase 2 before admin guards work.

**Existing tables:** `conversations`, `messages` (both with RLS). New tables `profiles`, `chat_analytics`, `kb_documents` and 4 materialized views are additive.

**Spec:** Full design spec at `docs/superpowers/specs/2026-03-18-admin-dashboard-design.md` (v3, approved). Reference screenshots in `samples/` directory. Spec is source of truth.

**Admin login flow (two-hop):** `/login` → `/app` → middleware detects `is_admin = true` → `/admin/dashboard`.

## Constraints

- **Tech stack:** Must use existing Next.js 15 + Tailwind v4 + shadcn/ui; add Recharts (charts), Leaflet + react-leaflet (maps), @tanstack/react-table (tables), xlsx + jspdf + jspdf-autotable (export)
- **Auth:** Supabase Auth (existing) — no new auth providers
- **Data:** Service role client (`createServiceClient()` from `lib/supabase/server.ts`) for all admin API routes; anon client cannot read `profiles` of other users
- **Chatbot:** Do not modify Product A routes/components unless strictly required for admin redirect
- **Language:** Vietnamese only in admin UI — no i18n toggle
- **Seed only:** All analytics data is seeded — no live RAGflow event capture

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Admin role in `profiles.is_admin` | Standard Supabase pattern, RLS-compatible, trigger-auto-created | — Pending |
| Materialized views for aggregation | Fast reads via plain SELECT; no per-request computation | — Pending |
| `mv_dashboard_kpis` non-concurrent refresh | Single-row aggregate has no unique key; `CONCURRENTLY` not possible | — Pending |
| Forecast via server-side linear regression | Simple, deterministic, no ML dependency | — Pending |
| `facility_code` as clinic pivot row key | Groups multiple staff under one clinic; `user_id` would create duplicate rows | — Pending |
| Two-hop admin login redirect | Reuses existing post-login flow; middleware intercepts `/app` for admins | — Pending |
| KPI cards unfiltered (platform-wide) | `mv_dashboard_kpis` has no filter dimensions; filter bar applies to charts only | — Pending |

---
*Last updated: 2026-03-18 after initialization*
