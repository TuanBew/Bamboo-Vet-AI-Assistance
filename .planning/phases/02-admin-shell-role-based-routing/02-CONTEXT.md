# Phase 2: Admin Shell & Role-Based Routing - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Next.js middleware guard, build the dark layout shell with collapsible sidebar, create the `requireAdmin()` utility, fix the globals.css dark mode selector, and scaffold all 7 shared admin components as renderable stubs. Product A routes are untouched.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Layout
- Desktop-only internal tool — no mobile compatibility, no hamburger toggle, no responsive collapse
- Fixed 240px sidebar, always expanded, no collapse toggle of any kind
- Dark sidebar: `#1a1f2e` background, teal/cyan section labels, white active item highlight
- Active nav item: white background pill (high contrast against dark sidebar)
- Sidebar is a static layout column — no state management needed

### Admin Redirect & Auth Flow
- **First task of Phase 2:** rename `proxy.ts` → `middleware.ts` at project root, rename the exported function `proxy` → `middleware`. Smoke-test that `/app` redirect still works before adding any admin guard code.
- Admin route guards live in `updateSession()` inside `lib/supabase/middleware.ts` — extend the existing function, do not create a new middleware file
- DB fetch for `is_admin` on every `/admin/*` request using `createServiceClient()` — ~10-30ms overhead is acceptable for an internal tool
- Two-hop login redirect preserved: `/login` → `/app` → `/admin/dashboard` (middleware intercepts `/app` for admins). No changes to login page or auth callbacks.
- `globals.css` dark mode selector fix is the very first code change in Phase 2 (before any layout work) so dark theme is testable immediately

### Protection Layers
- **Page routes:** Middleware only. `app/admin/layout.tsx` does NOT call `requireAdmin()` — trust middleware, no double DB query.
- **API routes:** `requireAdmin()` in each `/api/admin/*` route handler only. Middleware does NOT check `/api/admin/*` paths.
- Guard pattern in every API route:
  ```typescript
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const { user, profile } = auth
  ```

### globals.css Dark Mode Fix (AUTH-05)
- Fix `(&:is(.dark *))` → `(&:where(.dark, .dark *))` as the very first task
- The admin layout wraps its content in a `.dark` class div — this fix must land before any dark-theme rendering is attempted

### Claude's Discretion
- Exact breadcrumb implementation in top bar
- SectionHeader collapse animation timing
- Component stub content (placeholder text/data for non-wired components)
- shadcn component variants chosen for KpiCard, FilterBar, etc.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Full Design Spec
- `docs/2026-03-18-admin-dashboard-design.md` — Complete spec: sidebar nav structure (§7.1), auth logic (§4.1–4.4), all 7 shared components (§8), file structure (§10), decisions log (§12)

### Auth & Middleware
- `docs/2026-03-18-admin-dashboard-design.md` §4.1 — Critical pre-requisite: proxy.ts → middleware.ts rename details
- `docs/2026-03-18-admin-dashboard-design.md` §4.2 — Admin role detection, two-hop redirect flow
- `docs/2026-03-18-admin-dashboard-design.md` §4.3 — `requireAdmin()` utility exact signature and usage pattern
- `docs/2026-03-18-admin-dashboard-design.md` §4.4 — RLS summary table (which clients can access which tables)

### Shared Components
- `docs/2026-03-18-admin-dashboard-design.md` §8 — All 7 components: AdminSidebar, KpiCard, SectionHeader, DataTable, ColorPivotTable, ClinicDetailModal, UserHistoryDrawer, MapView, SparklineChart, FilterBar

### Existing Code (read before modifying)
- `lib/supabase/middleware.ts` — Current updateSession() implementation (add guards here)
- `lib/supabase/server.ts` — createClient() and createServiceClient() (use the exact function names)
- `proxy.ts` — Current root middleware (rename this file)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/server.ts::createServiceClient()` — Service role client, bypasses RLS. Use in `requireAdmin()` and all API routes.
- `lib/supabase/middleware.ts::updateSession()` — Existing session refresh + route guards. Extend with admin logic (do not rewrite).
- `lib/supabase/client.ts` — Anon client for browser components (not used in admin).

### Established Patterns
- Root layout (`app/layout.tsx`) wraps children in `<LanguageProvider>` — admin layout should NOT re-wrap with LanguageProvider (no i18n in admin)
- Product A layout (`app/app/layout.tsx`) pattern shows how to create a nested layout scoped to a route segment
- `createServiceClient()` is the correct function name (not `createServiceRoleClient()` or `createAdminClient()`)

### Integration Points
- `proxy.ts` → `middleware.ts` rename is the entry point. After rename, `updateSession()` in `lib/supabase/middleware.ts` is actually invoked on every request.
- Admin layout at `app/admin/layout.tsx` — new file, wraps all `/admin/*` pages with sidebar + top bar
- `lib/admin/auth.ts` — new file for `requireAdmin()` utility
- `lib/admin/forecast.ts` — new file for linear regression (Phase 3, not Phase 2)
- `components/admin/` — new directory for all 7 shared components

</code_context>

<specifics>
## Specific Ideas

- The spec explicitly warns: "proxy.ts is not currently active as Next.js middleware" — treat the rename as a critical unblocking step, not just housekeeping.
- The `is_admin` DB fetch in middleware uses `createServiceClient()` (service role), NOT the anon `supabase` client already initialized in `updateSession()` — the anon client cannot read other users' profile rows due to RLS.
- `mv_dashboard_kpis.refreshed_at` timestamp is used in the Settings page to show last refresh time — the "Làm mới dữ liệu" button triggers a server action to refresh all 4 views.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-admin-shell-role-based-routing*
*Context gathered: 2026-03-18*
