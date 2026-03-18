# Architecture Patterns

**Domain:** Admin SaaS Dashboard integrated into existing Next.js 16 App Router monorepo
**Researched:** 2026-03-18

## Critical Finding: Proxy Convention (Spec Correction)

**The design spec's "Critical Pre-Requisite" to rename `proxy.ts` to `middleware.ts` is WRONG for this codebase.**

The project runs Next.js 16.1.6 (confirmed in `package.json`). In Next.js 16, the `middleware` file convention was deprecated and replaced by `proxy`. The correct convention is:

- **File:** `proxy.ts` at project root (already exists)
- **Export:** `export async function proxy()` (already correct)
- **Config:** `export const config = { matcher: [...] }` (already correct)

The existing `proxy.ts` IS active and IS correctly recognized by Next.js 16. The compiled output at `.next/dev/server/middleware.js` confirms the proxy runs. The `lib/supabase/middleware.ts` helper is just an internal utility module -- its filename has no effect on Next.js routing.

**What actually needs to happen:** Do NOT rename anything. Instead, extend the existing `proxy.ts` -> `lib/supabase/middleware.ts` -> `updateSession()` pipeline to add admin route guards. The helper file at `lib/supabase/middleware.ts` can optionally be renamed to `lib/supabase/session.ts` for clarity, but this is cosmetic, not functional.

**Confidence:** HIGH -- verified against [Next.js 16 proxy.js docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (v16.1.7, updated 2026-03-16) and confirmed `package.json` shows `"next": "16.1.6"`.

**Implication for roadmap:** Phase 2 does NOT need a file rename. It needs to extend `updateSession()` with admin guard logic. This is simpler and lower-risk than the spec suggests.

---

## Recommended Architecture

The admin dashboard is a parallel product (`/admin/*`) within the same Next.js monorepo, sharing auth infrastructure but isolated in components, API routes, and data access patterns.

```
Browser Request
    |
    v
proxy.ts (root)
    |
    v
lib/supabase/middleware.ts :: updateSession()
    |--- Session refresh (existing)
    |--- /app/* guard: redirect unauthenticated to /login (existing)
    |--- /app* admin redirect: if is_admin, redirect to /admin/dashboard (NEW)
    |--- /admin/* guard: if !is_admin, redirect to /login (NEW)
    |
    v
app/admin/layout.tsx (Server Component)
    |
    v
app/admin/[page]/page.tsx (Client Components with data fetching)
    |
    v
GET /api/admin/[endpoint] (Route Handlers)
    |--- requireAdmin() guard
    |--- createServiceClient() for DB access
    |
    v
Supabase Postgres
    |--- Materialized Views (pre-computed aggregations)
    |--- Base Tables (profiles, chat_analytics, kb_documents, conversations, messages)
```

### Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|---------------|----------|-------------------|
| Proxy (root) | Session refresh, route guards, admin redirect | `proxy.ts` | `lib/supabase/middleware.ts` |
| Admin Layout | Dark sidebar shell, top bar, refresh trigger | `app/admin/layout.tsx` | Admin page components |
| Admin Pages (7) | Page-specific data fetching and rendering | `app/admin/*/page.tsx` | `/api/admin/*` routes |
| Admin API Routes (8) | Auth guard, DB queries, response shaping | `app/api/admin/*/route.ts` | `lib/admin/auth.ts`, Supabase |
| Admin Auth Utility | `requireAdmin()` guard for API routes | `lib/admin/auth.ts` | `lib/supabase/server.ts` |
| Admin Components (10) | Reusable UI: charts, tables, maps, exports | `components/admin/*.tsx` | Admin pages (imported) |
| Supabase Client Factory | `createClient()` (session) vs `createServiceClient()` (bypass RLS) | `lib/supabase/server.ts` | All server-side code |
| Materialized Views (4) | Pre-computed aggregations for fast reads | Supabase Postgres | API routes via SELECT |
| Seed Data | Populate 27 months of analytics data | `data/seeds/`, `scripts/seed.ts` | Supabase tables |

### Data Flow

**Admin Dashboard Page Load:**

```
1. Browser → GET /admin/dashboard
2. proxy.ts → updateSession() refreshes session cookies
3. updateSession() → createServiceClient() → SELECT is_admin FROM profiles WHERE id = user.id
4. If is_admin = false → redirect to /login
5. If is_admin = true → allow through to app/admin/layout.tsx
6. layout.tsx renders sidebar + top bar (Server Component)
7. dashboard/page.tsx renders (Client Component, "use client")
8. Client-side useEffect → fetch('/api/admin/dashboard?year=2026&month=3')
9. API route → requireAdmin() → validates session + is_admin
10. API route → createServiceClient() → SELECT * FROM mv_dashboard_kpis (unfiltered KPIs)
11. API route → SELECT from mv_monthly_queries, mv_category_stats (filtered by params)
12. API route → compute 3-month forecast via linear regression
13. API route → return JSON response
14. Client renders KPI cards, Recharts charts, Leaflet map, DataTable
```

**Materialized View Refresh (manual trigger):**

```
1. Admin clicks "Lam moi du lieu" button in top bar
2. Server action calls scripts/refresh-views.ts logic
3. For mv_monthly_queries, mv_daily_queries, mv_category_stats:
   → REFRESH MATERIALIZED VIEW CONCURRENTLY (non-blocking, requires unique index)
4. For mv_dashboard_kpis:
   → REFRESH MATERIALIZED VIEW (blocking, but instant — single row, no unique index possible)
5. UI shows refresh timestamp from mv_dashboard_kpis.refreshed_at
```

**Admin Two-Hop Login:**

```
1. Admin enters credentials at /login (existing auth page)
2. Supabase creates session → existing redirect to /app
3. proxy.ts intercepts /app request
4. updateSession() checks profiles.is_admin via service role client
5. is_admin = true → redirect to /admin/dashboard
6. Subsequent /admin/* requests pass guard check directly
```

---

## Patterns to Follow

### Pattern 1: Service Role Client for Admin Data Access

**What:** All admin API routes use `createServiceClient()` from `lib/supabase/server.ts` to bypass RLS. Never use `createClient()` (session-scoped, anon key) for admin queries.

**When:** Every `/api/admin/*` route handler, the `requireAdmin()` utility, and the proxy admin guard.

**Why:** The anon client respects RLS, which restricts `profiles` reads to the user's own row. Admin needs to read all profiles, all chat_analytics, all kb_documents, and all materialized views. The service role key bypasses RLS entirely.

**File:** `lib/supabase/server.ts` (existing, no changes needed)

```typescript
// CORRECT: Service role client for admin routes
import { createServiceClient } from '@/lib/supabase/server'
const db = createServiceClient()
const { data } = await db.from('profiles').select('*')  // reads ALL rows

// WRONG: Session client cannot read other users' data
import { createClient } from '@/lib/supabase/server'
const db = await createClient()
const { data } = await db.from('profiles').select('*')  // only YOUR row (RLS)
```

**Important distinction:**
- `createServiceClient()` is synchronous (no cookies needed, uses service role key)
- `createClient()` is async (needs `await cookies()`)
- In the proxy/middleware context, neither can be used directly -- the proxy creates its own Supabase client inline using the request cookies (see existing `updateSession()` code). For the admin guard, create a SECOND client using the service role key.

### Pattern 2: `requireAdmin()` Guard for API Routes

**What:** A shared utility that validates the caller is an authenticated admin. Returns either the admin context or a 403 response.

**When:** First line of every `/api/admin/*` route handler.

**File:** `lib/admin/auth.ts` (new file)

```typescript
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  // 1. Get session via the ANON client (needs cookies for session)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Check is_admin via SERVICE ROLE client (bypasses RLS)
  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user, profile }
}
```

**Usage in route handlers:**

```typescript
// app/api/admin/dashboard/route.ts
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth  // early return 401/403

  const { user, profile } = auth
  const db = createServiceClient()
  // ... query materialized views, compute forecast, return JSON
}
```

### Pattern 3: Admin Route Guard in Proxy

**What:** Extend the existing `updateSession()` function in `lib/supabase/middleware.ts` to handle admin-specific routing.

**When:** Applied to every non-static request via the proxy matcher.

**File:** `lib/supabase/middleware.ts` (modify existing)

**Key architectural decision:** The admin guard in the proxy needs a service role client. The existing proxy only uses an anon client (for session refresh). Adding a second Supabase client call for admin detection adds ~10-30ms per request on `/admin/*` and `/app` routes. This is acceptable for an internal tool.

**Guard logic to add (after existing session refresh):**

```
// AFTER existing: const { data: { user } } = await supabase.auth.getUser()

// NEW: Admin route guards
if (request.nextUrl.pathname.startsWith('/admin')) {
  if (!user) → redirect to /login

  // Create service role client for admin check
  const serviceClient = createServerClient(URL, SERVICE_ROLE_KEY, { cookies: no-op })
  const { data: profile } = await serviceClient.from('profiles').select('is_admin').eq('id', user.id).single()

  if (!profile?.is_admin) → redirect to /login
  // else: allow through
}

// NEW: Redirect admins away from /app
if (user && request.nextUrl.pathname.startsWith('/app')) {
  const serviceClient = createServerClient(URL, SERVICE_ROLE_KEY, { cookies: no-op })
  const { data: profile } = await serviceClient.from('profiles').select('is_admin').eq('id', user.id).single()

  if (profile?.is_admin) → redirect to /admin/dashboard
}
```

**Note:** The service role client in the proxy must be created inline (not via `createServiceClient()` from `lib/supabase/server.ts`) because the proxy runs in a different context and cannot use `next/headers` cookies. Use a no-op cookie adapter like the existing `createServiceClient()` does.

### Pattern 4: Admin Component Isolation

**What:** All admin-specific components live under `components/admin/`. Product A (chatbot) components under `components/chat/`, `components/layout/`, `components/sidebar/`. Shared primitives stay in `components/ui/` (shadcn).

**Why:** Prevents import contamination. Admin pages import from `components/admin/` and `components/ui/`. Chatbot pages never import from `components/admin/`. No shared state, no shared context providers beyond what the root layout provides.

**Directory structure:**

```
components/
  admin/                    # NEW — admin-only components
    AdminSidebar.tsx        # Dark sidebar with nav groups
    KpiCard.tsx             # Colored metric card
    SectionHeader.tsx       # Collapsible section header
    DataTable.tsx           # @tanstack/react-table + export toolbar
    ColorPivotTable.tsx     # Monthly/daily pivot with color thresholds
    ClinicDetailModal.tsx   # Dark Dialog for clinic daily breakdown
    UserHistoryDrawer.tsx   # Sheet drawer for conversation history
    MapView.tsx             # Leaflet wrapper (dynamic import, ssr: false)
    SparklineChart.tsx      # Mini Recharts LineChart
    FilterBar.tsx           # Controlled filter row
  chat/                     # EXISTING — do not modify
    ChatInterface.tsx
    MessageBubble.tsx
    MessageInput.tsx
    TypingIndicator.tsx
  layout/                   # EXISTING — do not modify
    Header.tsx
    LandingNav.tsx
  sidebar/                  # EXISTING — do not modify
    AppSidebar.tsx
    ConversationItem.tsx
  ui/                       # SHARED — shadcn primitives (both products use)
    button.tsx, card.tsx, dialog.tsx, sheet.tsx, ...
```

### Pattern 5: Materialized View Architecture

**What:** 4 PostgreSQL materialized views pre-compute aggregations. API routes execute plain `SELECT` queries with optional `WHERE` filters. No per-request JOINs or aggregations for dashboard data.

**Views and their purpose:**

| View | Rows | Unique Index | CONCURRENTLY? | Used By |
|------|------|-------------|---------------|---------|
| `mv_monthly_queries` | ~user*month combos | `(user_id, year, month)` | Yes | Dashboard, Check Users pivot |
| `mv_daily_queries` | ~user*day combos | `(user_id, year, month, day)` | Yes | Clinic detail modal |
| `mv_category_stats` | ~category combos | `(year, month, province, clinic_type, drug_group, animal_type, query_type)` | Yes | Dashboard donuts, New Activity donuts |
| `mv_dashboard_kpis` | 1 row | None (impossible) | **No** | Dashboard KPI cards, Settings page |

**REFRESH CONCURRENTLY vs plain REFRESH:**

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a `UNIQUE INDEX` on the view. It performs an incremental diff (INSERT/UPDATE/DELETE) against the existing data, allowing concurrent reads during refresh. Use for all views that have a natural composite key.
- `REFRESH MATERIALIZED VIEW` (without CONCURRENTLY) locks the view during refresh, blocking all reads. However, for `mv_dashboard_kpis` (single aggregate row), this lock is essentially instantaneous and the view has no natural unique key, so CONCURRENTLY is impossible.
- **Confidence:** HIGH -- this is standard PostgreSQL behavior documented in [PostgreSQL materialized view docs](https://www.postgresql.org/message-id/CAB7nPqR+GDZF9S80rmP5wK4dainVVEaa5igr7rD3uddKm4KLcQ@mail.gmail.com).

**Refresh trigger:** Manual only via "Lam moi du lieu" button. Calls a server action that runs all 4 refreshes sequentially (concurrent views first, then KPI view).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Session Client for Admin Queries

**What:** Calling `createClient()` (anon key + user cookies) in admin API routes to query cross-user data.

**Why bad:** RLS restricts `profiles` to the user's own row. `chat_analytics` and `kb_documents` have no anon/authenticated policies at all. Queries will silently return empty results or only the admin's own data.

**Instead:** Always use `createServiceClient()` in admin API routes. The `requireAdmin()` guard already validates the session; after that, use service role for all data access.

### Anti-Pattern 2: Aggregating Data in API Routes

**What:** Writing `GROUP BY` queries in API route handlers instead of reading from materialized views.

**Why bad:** Per-request aggregation on 20K messages + 4K conversations is slow (~200-500ms). Materialized views pre-compute once and serve via simple SELECT (~5-20ms).

**Instead:** Query materialized views. Only compute on-the-fly for small datasets (e.g., `top_questions` in New Activity -- truncating message content to 60 chars and grouping, which operates on a single month's subset).

### Anti-Pattern 3: Importing Admin Components in Chatbot Pages

**What:** Sharing components between `components/admin/` and `components/chat/`.

**Why bad:** Admin components pull in heavy dependencies (Recharts, Leaflet, @tanstack/react-table, xlsx, jspdf) that bloat the chatbot bundle. The chatbot needs none of these.

**Instead:** Keep strict boundaries. Only `components/ui/` (shadcn primitives) is shared. If both products need a similar pattern, create separate implementations.

### Anti-Pattern 4: Renaming proxy.ts to middleware.ts

**What:** Following the spec's "critical prerequisite" to rename `proxy.ts` to `middleware.ts`.

**Why bad:** The project is on Next.js 16.1.6, where `proxy.ts` with `export function proxy()` IS the correct convention. Renaming to `middleware.ts` with `export function middleware()` uses the deprecated convention and will trigger a deprecation warning. The proxy IS currently active.

**Instead:** Keep `proxy.ts` as-is. Extend the `updateSession()` function in `lib/supabase/middleware.ts` with admin guard logic. Optionally rename `lib/supabase/middleware.ts` to `lib/supabase/session.ts` to avoid confusion between the v16 proxy convention and this internal helper module.

---

## API Route Structure

All admin API routes follow the same pattern:

```
app/api/admin/
  dashboard/route.ts          → GET: KPIs + charts + users + map
  new-activity/route.ts       → GET: monthly KPIs + daily charts + recent sessions
  knowledge-base/route.ts     → GET: KB stats + paginated doc table
  users/
    route.ts                  → GET: user analytics + breakdowns
    [userId]/
      conversations/
        route.ts              → GET: conversation list for a user
        [conversationId]/
          messages/route.ts   → GET: messages for a conversation
  check-users/route.ts        → GET: map pins + paginated user table + pivot
  check-clinics/
    route.ts                  → GET: clinic pivot table
    [facilityCode]/
      detail/route.ts         → GET: daily breakdown for a clinic
```

Every route handler follows this template:

```typescript
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  // 1. Auth guard
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  // 2. Parse query params
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year')) || new Date().getFullYear()

  // 3. Query via service role
  const db = createServiceClient()
  const { data, error } = await db.from('mv_monthly_queries').select('*')...

  // 4. Shape and return
  return NextResponse.json({ ... })
}
```

---

## Build Order Dependencies

This is the critical ordering for implementation phases. Items higher in the list must exist before items below.

```
LAYER 0: Database Foundation (no code dependencies)
  ├── Migration: profiles table + SECURITY DEFINER trigger
  ├── Migration: chat_analytics table
  ├── Migration: kb_documents table
  ├── Migration: 4 materialized views + unique indexes
  └── RLS policies for all new tables

LAYER 1: Auth Infrastructure (depends on Layer 0)
  ├── lib/admin/auth.ts (requireAdmin utility)
  └── lib/supabase/middleware.ts (extend updateSession with admin guards)
      NOTE: proxy.ts does NOT need renaming. It already works on Next.js 16.

LAYER 2: Seed Data (depends on Layer 0)
  ├── data/seeds/*.ts (profile, conversation, message, analytics, KB data)
  ├── scripts/seed.ts (idempotent upsert runner)
  └── scripts/refresh-views.ts (REFRESH all 4 materialized views)

LAYER 3: Admin Shell (depends on Layer 1)
  ├── app/admin/layout.tsx (sidebar + top bar)
  ├── components/admin/AdminSidebar.tsx
  └── Placeholder pages for all 7 routes

LAYER 4: Shared Admin Components (depends on nothing, but used by Layer 5)
  ├── components/admin/KpiCard.tsx
  ├── components/admin/SectionHeader.tsx
  ├── components/admin/FilterBar.tsx
  ├── components/admin/DataTable.tsx (generic, with export toolbar)
  ├── components/admin/ColorPivotTable.tsx
  ├── components/admin/MapView.tsx (Leaflet, dynamic import)
  └── components/admin/SparklineChart.tsx

LAYER 5: API Routes + Pages (depends on Layers 1, 2, 3, 4)
  ├── /api/admin/dashboard + /admin/dashboard page
  ├── /api/admin/new-activity + /admin/new-activity page
  ├── /api/admin/knowledge-base + /admin/knowledge-base page
  ├── /api/admin/users + /admin/users page
  ├── /api/admin/check-users + /admin/check-users page
  ├── /api/admin/check-clinics + /admin/check-clinics page
  ├── components/admin/ClinicDetailModal.tsx
  ├── components/admin/UserHistoryDrawer.tsx
  └── /admin/settings page

LAYER 6: Forecast + Polish (depends on Layer 5)
  ├── lib/admin/forecast.ts (linear regression)
  └── Integration into dashboard API route
```

**Key dependency insight:** Layers 0 and 2 (database + seed) can run in parallel with Layer 4 (shared components). Layer 1 (auth) blocks Layer 3 (admin shell). Layer 5 (pages) needs everything below it.

---

## Scalability Considerations

| Concern | Current (seed data) | At 100K conversations | At 1M conversations |
|---------|--------------------|-----------------------|---------------------|
| View refresh time | <1s | ~5-10s | ~30-60s, may need pg_cron |
| API response time | <50ms (SELECT on views) | <100ms | <200ms (views still fast) |
| Dashboard page load | <2s | Same (views) | Same (views) |
| Bundle size | Admin components tree-shaken from chatbot | Same | Same |
| Auth check latency | ~10-30ms per request | Same | Same |

Materialized views are the key scalability pattern. They shift computation from read-time to refresh-time. For an internal tool with manual refresh, this is ideal.

---

## File Path Reference (Exact Paths)

| Purpose | File Path |
|---------|-----------|
| Proxy (root) | `proxy.ts` |
| Session/guard logic | `lib/supabase/middleware.ts` |
| Supabase client factory | `lib/supabase/server.ts` |
| Admin auth utility | `lib/admin/auth.ts` (NEW) |
| Forecast helper | `lib/admin/forecast.ts` (NEW) |
| Admin layout | `app/admin/layout.tsx` (NEW) |
| Dashboard page | `app/admin/dashboard/page.tsx` (NEW) |
| Dashboard API | `app/api/admin/dashboard/route.ts` (NEW) |
| New Activity page | `app/admin/new-activity/page.tsx` (NEW) |
| New Activity API | `app/api/admin/new-activity/route.ts` (NEW) |
| Knowledge Base page | `app/admin/knowledge-base/page.tsx` (NEW) |
| Knowledge Base API | `app/api/admin/knowledge-base/route.ts` (NEW) |
| Users page | `app/admin/users/page.tsx` (NEW) |
| Users API | `app/api/admin/users/route.ts` (NEW) |
| User conversations API | `app/api/admin/users/[userId]/conversations/route.ts` (NEW) |
| User messages API | `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts` (NEW) |
| Check Users page | `app/admin/check-users/page.tsx` (NEW) |
| Check Users API | `app/api/admin/check-users/route.ts` (NEW) |
| Check Clinics page | `app/admin/check-clinics/page.tsx` (NEW) |
| Check Clinics API | `app/api/admin/check-clinics/route.ts` (NEW) |
| Clinic Detail API | `app/api/admin/check-clinics/[facilityCode]/detail/route.ts` (NEW) |
| Settings page | `app/admin/settings/page.tsx` (NEW) |
| Admin Sidebar | `components/admin/AdminSidebar.tsx` (NEW) |
| KPI Card | `components/admin/KpiCard.tsx` (NEW) |
| Section Header | `components/admin/SectionHeader.tsx` (NEW) |
| Data Table | `components/admin/DataTable.tsx` (NEW) |
| Color Pivot Table | `components/admin/ColorPivotTable.tsx` (NEW) |
| Clinic Detail Modal | `components/admin/ClinicDetailModal.tsx` (NEW) |
| User History Drawer | `components/admin/UserHistoryDrawer.tsx` (NEW) |
| Map View | `components/admin/MapView.tsx` (NEW) |
| Sparkline Chart | `components/admin/SparklineChart.tsx` (NEW) |
| Filter Bar | `components/admin/FilterBar.tsx` (NEW) |
| Seed profiles | `data/seeds/profiles.ts` (NEW) |
| Seed conversations | `data/seeds/conversations.ts` (NEW) |
| Seed messages | `data/seeds/messages.ts` (NEW) |
| Seed analytics | `data/seeds/chat_analytics.ts` (NEW) |
| Seed KB docs | `data/seeds/kb_documents.ts` (NEW) |
| Seed runner | `scripts/seed.ts` (NEW) |
| View refresh script | `scripts/refresh-views.ts` (NEW) |
| Migrations | `supabase/migrations/YYYYMMDD_*.sql` (NEW, 5 files) |

## Sources

- [Next.js 16 proxy.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) -- v16.1.7, updated 2026-03-16 (HIGH confidence)
- [Next.js 15 middleware.js file convention](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware) -- v15.5.13, confirms middleware is the v15 convention (HIGH confidence)
- [Next.js middleware-to-proxy migration guide](https://nextjs.org/docs/messages/middleware-to-proxy) -- confirms v16 deprecation of middleware in favor of proxy (HIGH confidence)
- [PostgreSQL materialized view REFRESH CONCURRENTLY](https://www.postgresql.org/message-id/CAB7nPqR+GDZF9S80rmP5wK4dainVVEaa5igr7rD3uddKm4KLcQ@mail.gmail.com) -- unique index requirement for CONCURRENTLY (HIGH confidence)
- Existing codebase files: `proxy.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `package.json` (HIGH confidence, direct inspection)
- Design spec: `docs/2026-03-18-admin-dashboard-design.md` v3 (HIGH confidence for feature requirements; CORRECTED for middleware/proxy convention)
