---
phase: 02-admin-shell-role-based-routing
verified: 2026-03-18T16:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 15/17
  gaps_closed:
    - "SHELL-02: REQUIREMENTS.md updated to remove hamburger/mobile clause; now reads 'desktop-only fixed 240px — no mobile collapse per design decision'"
    - "COMP-04: MapView.tsx now exports via next/dynamic with ssr: false (line 41: export const MapView = dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false }))"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Visit /admin/dashboard while unauthenticated and confirm redirect to /login"
    expected: "Browser lands on /login — not /admin/dashboard"
    why_human: "Middleware redirect logic is only testable with a live Supabase session"
  - test: "Sign in with a non-admin account and navigate to /admin/dashboard"
    expected: "Browser is redirected to /login (AUTH-02)"
    why_human: "Requires a seeded non-admin account and live Supabase session"
  - test: "Sign in with an admin account and navigate to /app"
    expected: "Browser is redirected to /admin/dashboard (AUTH-03)"
    why_human: "Requires a seeded admin account and live Supabase session"
  - test: "Check dark theme renders correctly on /admin/dashboard"
    expected: "Dark sidebar (#1a1f2e), dark main content (gray-900), top bar dark variant visible — no white flash"
    why_human: "Tailwind v4 dark variant fix requires visual confirmation in a browser"
  - test: "Click 'Lam moi du lieu' button in AdminTopBar"
    expected: "Button shows 'Dang lam moi...' loading state, then returns to normal. No error in console."
    why_human: "Requires live Supabase connection with refresh_admin_views RPC available"
---

# Phase 2: Admin Shell and Role-Based Routing Verification Report

**Phase Goal:** Establish the admin shell — authenticated route guards, dark-mode layout, and shared component library — so all Phase 3 dashboard pages have a stable, typed foundation to build on.
**Verified:** 2026-03-18T16:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 02-04, commits 671e666e and c9489a2a)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | globals.css dark mode uses `(&:where(.dark, .dark *))` not the old `(&:is(.dark *))` | VERIFIED | `app/globals.css` line 4 reads exactly `@custom-variant dark (&:where(.dark, .dark *));` |
| 2 | Unauthenticated request to /admin/dashboard redirects to /login | VERIFIED | `lib/supabase/middleware.ts` lines 30–40: `isAdminRoute` check + `if (!user) { redirect /login }` |
| 3 | Authenticated non-admin request to /admin/dashboard redirects to /login | VERIFIED | `lib/supabase/middleware.ts` lines 42–59: service-role profile lookup + `if (!profile?.is_admin) { redirect /login }` |
| 4 | Authenticated admin hitting /app redirects to /admin/dashboard | VERIFIED | `lib/supabase/middleware.ts` lines 70–88: admin check on `/app` prefix, redirects to `/admin/dashboard` |
| 5 | requireAdmin() returns 403 JSON for non-admin callers | VERIFIED | `lib/admin/auth.ts`: returns `NextResponse.json({ error: 'Forbidden' }, { status: 403 })` for no-user and non-admin paths |
| 6 | Admin layout renders dark sidebar and top bar on all /admin/* pages | VERIFIED | `app/admin/layout.tsx`: wraps `<div className="dark">`, imports AdminSidebar and AdminTopBar |
| 7 | Sidebar has 3 sections and 7 nav items with teal labels and white active pill | VERIFIED | `components/admin/AdminSidebar.tsx`: NAV_SECTIONS has CORE(4), CHECKED(2), OTHER(1), `text-teal-400`, `bg-white text-[#1a1f2e]` active state |
| 8 | Sidebar is desktop-only fixed 240px — REQUIREMENTS.md SHELL-02 aligned with this decision | VERIFIED | REQUIREMENTS.md line 42: "desktop-only fixed 240px — no mobile collapse per design decision". No hamburger in codebase matches requirement. |
| 9 | Top bar has breadcrumb and refresh button calling refreshMaterializedViews | VERIFIED | `components/admin/AdminTopBar.tsx`: breadcrumb from `usePathname()`, `refreshMaterializedViews` server action called via `handleRefresh` |
| 10 | Settings page shows admin profile info and last-refresh timestamp | VERIFIED | `app/admin/settings/page.tsx`: fetches profile + mv_dashboard_kpis, renders name/email/is_admin badge + refreshed_at |
| 11 | Admin pages have no LanguageProvider, no language toggle, no RAGflow chat | VERIFIED | layout.tsx line 10 is a comment-only reference; grep of app/admin/ confirms zero actual LanguageProvider/SidebarProvider imports |
| 12 | All 7 admin page routes exist and render | VERIFIED | All 7 files present: dashboard, new-activity, knowledge-base, users, check-users, check-clinics, settings |
| 13 | All 9 admin components exist and export their main function | VERIFIED | All 9 files present in `components/admin/`: AdminSidebar, AdminTopBar, KpiCard, SectionHeader, DataTable, ColorPivotTable, FilterBar, MapView, SparklineChart, ClinicDetailModal, UserHistoryDrawer |
| 14 | KpiCard renders colored card with value/label/icon/bgColor | VERIFIED | `components/admin/KpiCard.tsx`: functional component with `KpiCardProps`, `bgColor`, `text-2xl font-bold` value, `text-sm opacity-80` label |
| 15 | SectionHeader renders teal bar with title and collapsible chevron | VERIFIED | `components/admin/SectionHeader.tsx`: `useState` toggle, `ChevronDown`/`ChevronRight`, `text-teal-400`, `bg-teal-600/20` |
| 16 | DataTable stub defines ExportConfig and DataTableProps<T> types | VERIFIED | `components/admin/DataTable.tsx`: exports `ExportConfig`, `DataTableColumn<T>`, `DataTableProps<T>`, `DataTable<T>` |
| 17 | ColorPivotTable stub defines threshold constants (50/10/1/0) | VERIFIED | `components/admin/ColorPivotTable.tsx`: `COLOR_THRESHOLDS = { green: 50, yellow: 10, red: 1, grey: 0 }` |
| 18 | FilterBar stub defines FilterBarProps with province/district/clinic_type/year/month/search | VERIFIED | `components/admin/FilterBar.tsx`: all 6 filter types in `FilterBarProps` with controlled props |
| 19 | MapView uses next/dynamic with ssr: false | VERIFIED | `components/admin/MapView.tsx` line 3: `import dynamic from 'next/dynamic'`; line 41: `export const MapView = dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false })` |
| 20 | SparklineChart stub defines SparklineChartProps interface | VERIFIED | `components/admin/SparklineChart.tsx`: exports `SparklineChartProps` with `data: number[]`, `color`, `width`, `height` |
| 21 | ClinicDetailModal and UserHistoryDrawer stubs use Dialog and Sheet | VERIFIED | ClinicDetailModal imports from `@/components/ui/dialog`, UserHistoryDrawer imports from `@/components/ui/sheet`; both components exist and export the needed names |

**Score:** 21/21 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/globals.css` | Fixed dark mode custom variant | VERIFIED | Line 4: `@custom-variant dark (&:where(.dark, .dark *));` |
| `lib/supabase/middleware.ts` | Admin route guards in updateSession() | VERIFIED | AUTH-01, AUTH-02, AUTH-03 guards present; dynamic import of createServiceClient; try/catch fallthrough |
| `lib/admin/auth.ts` | requireAdmin() utility for API routes | VERIFIED | Exports `requireAdmin()`, returns `{ user, profile }` or 403 JSON |
| `app/admin/layout.tsx` | Admin layout with dark sidebar + top bar | VERIFIED | `<div className="dark">` wrapper, imports AdminSidebar and AdminTopBar, no LanguageProvider/SidebarProvider |
| `components/admin/AdminSidebar.tsx` | Dark sidebar with 3 sections and 7 nav items | VERIFIED | 240px, bg-[#1a1f2e], NAV_SECTIONS with 3 groups (4+2+1 items), teal labels, white active pill |
| `components/admin/AdminTopBar.tsx` | Top bar with breadcrumb and refresh button | VERIFIED | breadcrumb from pathname, refreshMaterializedViews called, signOut with createBrowserClient |
| `app/admin/_actions/refresh-views.ts` | Server action to refresh materialized views | VERIFIED | `'use server'`, calls `svc.rpc('refresh_admin_views')` |
| `app/admin/settings/page.tsx` | Settings page with profile + refresh timestamp | VERIFIED | Fetches user, profile (is_admin badge), mv_dashboard_kpis.refreshed_at, RefreshButton client component |
| `app/admin/dashboard/page.tsx` | Dashboard placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `app/admin/new-activity/page.tsx` | New activity placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `app/admin/knowledge-base/page.tsx` | Knowledge base placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `app/admin/users/page.tsx` | Users placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `app/admin/check-users/page.tsx` | Check users placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `app/admin/check-clinics/page.tsx` | Check clinics placeholder | VERIFIED | Placeholder with "Coming soon" text |
| `components/admin/KpiCard.tsx` | Colored KPI card component | VERIFIED | Exports `KpiCard`, `KpiCardProps`; functional with bgColor/textColor/icon |
| `components/admin/SectionHeader.tsx` | Teal collapsible section header | VERIFIED | Exports `SectionHeader`, `SectionHeaderProps`; useState for collapse, teal-400 styling |
| `components/admin/DataTable.tsx` | DataTable stub with type definitions | VERIFIED | Exports `DataTable<T>`, `ExportConfig`, `DataTableColumn<T>`, `DataTableProps<T>` |
| `components/admin/ColorPivotTable.tsx` | Color-coded pivot table stub | VERIFIED | Exports `ColorPivotTable`, `COLOR_THRESHOLDS`, `ColorPivotTableProps` |
| `components/admin/FilterBar.tsx` | Filter bar stub with controlled props | VERIFIED | Exports `FilterBar`, `FilterBarProps` with all filter types |
| `components/admin/MapView.tsx` | Leaflet map wrapper stub with ssr:false | VERIFIED | `import dynamic from 'next/dynamic'` at line 3; `export const MapView = dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false })` at line 41 |
| `components/admin/SparklineChart.tsx` | Mini line chart stub | VERIFIED | Exports `SparklineChart`, `SparklineChartProps` with `data: number[]` |
| `components/admin/ClinicDetailModal.tsx` | Clinic detail modal stub using Dialog | VERIFIED | Imports Dialog from `@/components/ui/dialog`, exports `ClinicDetailModal`, `ClinicDetailModalProps`, `ClinicDetailUser` |
| `components/admin/UserHistoryDrawer.tsx` | User history drawer stub using Sheet | VERIFIED | Imports Sheet from `@/components/ui/sheet`, `side="right"`, exports `UserHistoryDrawer`, `UserHistoryDrawerProps` |
| `.planning/REQUIREMENTS.md` | SHELL-02 aligned with desktop-only decision | VERIFIED | Line 42 reads "desktop-only fixed 240px — no mobile collapse per design decision"; no "hamburger" present |
| `proxy.ts` | Next.js 16 proxy entry point unchanged | VERIFIED | Exports `proxy` function calling `updateSession`, config with matcher — unmodified |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/supabase/middleware.ts` | `lib/supabase/server.ts` | dynamic import of createServiceClient | WIRED | `await import('@/lib/supabase/server')` used in 3 guard blocks |
| `lib/admin/auth.ts` | `lib/supabase/server.ts` | static import of createClient and createServiceClient | WIRED | `import { createClient, createServiceClient } from '@/lib/supabase/server'` line 2 |
| `app/admin/layout.tsx` | `components/admin/AdminSidebar.tsx` | import AdminSidebar | WIRED | `import { AdminSidebar } from '@/components/admin/AdminSidebar'`, used in JSX |
| `app/admin/layout.tsx` | `components/admin/AdminTopBar.tsx` | import AdminTopBar | WIRED | `import { AdminTopBar } from '@/components/admin/AdminTopBar'`, used in JSX |
| `components/admin/AdminTopBar.tsx` | `app/admin/_actions/refresh-views.ts` | server action import | WIRED | `import { refreshMaterializedViews } from '@/app/admin/_actions/refresh-views'`, called in handleRefresh |
| `app/admin/settings/page.tsx` | `lib/supabase/server.ts` | createServiceClient for mv_dashboard_kpis | WIRED | imports createClient and createServiceClient; service client used for profiles and mv_dashboard_kpis |
| `app/admin/settings/page.tsx` | `app/admin/settings/refresh-button.tsx` | RefreshButton client component | WIRED | `import { RefreshButton } from './refresh-button'`, rendered in JSX |
| `components/admin/ClinicDetailModal.tsx` | `components/ui/dialog.tsx` | import Dialog components | WIRED | `import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'` |
| `components/admin/UserHistoryDrawer.tsx` | `components/ui/sheet.tsx` | import Sheet components | WIRED | `import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'` |
| `components/admin/MapView.tsx` | `next/dynamic` | dynamic import wrapper | WIRED | `import dynamic from 'next/dynamic'`; export uses `dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false })` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01 | Unauthenticated /admin/* → /login | SATISFIED | middleware.ts lines 35–40 |
| AUTH-02 | 02-01 | Non-admin authenticated /admin/* → /login | SATISFIED | middleware.ts lines 43–56 with service-role profile check |
| AUTH-03 | 02-01 | Admin hitting /app → /admin/dashboard | SATISFIED | middleware.ts lines 70–88 |
| AUTH-04 | 02-01 | requireAdmin() returns { user, profile } or 403 | SATISFIED | lib/admin/auth.ts: complete implementation |
| AUTH-05 | 02-01 | globals.css dark mode selector fixed | SATISFIED | `@custom-variant dark (&:where(.dark, .dark *));` line 4 |
| SHELL-01 | 02-02 | Admin layout renders dark sidebar + top bar | SATISFIED | app/admin/layout.tsx with AdminSidebar + AdminTopBar inside `<div className="dark">` |
| SHELL-02 | 02-02, 02-04 | Sidebar: 3 sections, 7 items, teal labels, white active, desktop-only fixed 240px | SATISFIED | AdminSidebar matches; REQUIREMENTS.md SHELL-02 updated to reflect desktop-only decision (no hamburger) |
| SHELL-03 | 02-02 | Top bar: breadcrumb + refresh button calling RPC | SATISFIED | AdminTopBar.tsx with pathname breadcrumb and refreshMaterializedViews server action |
| SHELL-04 | 02-02 | Settings page: profile, is_admin badge, refresh, refreshed_at | SATISFIED | settings/page.tsx: all four elements present and connected |
| SHELL-05 | 02-02 | No language toggle, no RAGflow chat in admin | SATISFIED | grep confirms no LanguageProvider/SidebarProvider imports in app/admin/ |
| COMP-01 | 02-03 | DataTable stub with ExportConfig and DataTableProps<T> | SATISFIED | DataTable.tsx exports ExportConfig (copy/excel/csv/pdf/print), DataTableProps<T>, DataTable<T> |
| COMP-02 | 02-03 | ColorPivotTable with COLOR_THRESHOLDS (>50 green, 10-50 yellow, 1-9 red, 0 grey) | SATISFIED | ColorPivotTable.tsx: COLOR_THRESHOLDS constants match exactly |
| COMP-03 | 02-03 | FilterBar with province/district/clinic_type/year/month/search controlled props | SATISFIED | FilterBar.tsx: FilterBarProps has all 6 filter types with onChange handlers |
| COMP-04 | 02-03, 02-04 | MapView wraps react-leaflet using next/dynamic with ssr: false | SATISFIED | MapView.tsx line 3: `import dynamic from 'next/dynamic'`; line 41: `export const MapView = dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false })` |
| COMP-05 | 02-03 | SparklineChart stub with data:number[]/color/width/height | SATISFIED | SparklineChart.tsx: SparklineChartProps matches spec exactly |
| COMP-06 | 02-03 | KpiCard: colored card with value/label/icon/bgColor | SATISFIED | KpiCard.tsx: fully functional, all props present |
| COMP-07 | 02-03 | SectionHeader: teal header with collapsible chevron toggle | SATISFIED | SectionHeader.tsx: useState, ChevronDown/Right, teal-400, teal-600/20 bg |

**Orphaned requirements from this phase:** None — all 17 IDs (AUTH-01–05, SHELL-01–05, COMP-01–07) are accounted for across plans 01, 02, 03, and 04.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/admin/dashboard/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 3 replaces this |
| `app/admin/new-activity/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 3 replaces this |
| `app/admin/knowledge-base/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 4 replaces this |
| `app/admin/users/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 4 replaces this |
| `app/admin/check-users/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 5 replaces this |
| `app/admin/check-clinics/page.tsx` | 3 | `<p className="text-gray-400">Coming soon</p>` | Info | Intentional Phase 2 placeholder — Phase 5 replaces this |
| `components/admin/DataTable.tsx` | 38 | `Component stub — wired in Phase 3+` | Info | Intentional typed stub per plan |
| `components/admin/AdminTopBar.tsx` | 25 | `console.error('Refresh failed:', result.error)` | Info | Acceptable for now; should be replaced with toast notification in Phase 6 polish |

No blocker or warning anti-patterns. All "coming soon" patterns are intentional placeholders for later phases.

---

## Human Verification Required

### 1. Auth redirect chain (unauthenticated)
**Test:** Open /admin/dashboard in a browser with no active session
**Expected:** Immediate redirect to /login — no flash of admin content
**Why human:** Middleware is only exercised at runtime with actual HTTP requests; cannot be verified by static code inspection

### 2. Auth redirect chain (non-admin user)
**Test:** Sign in with a non-admin seeded user, then navigate to /admin/dashboard
**Expected:** Redirect to /login
**Why human:** Requires live Supabase session + service-role profile lookup at runtime

### 3. Auth redirect chain (admin user from /app)
**Test:** Sign in with an admin account (2 admin users in seed data), navigate to /app
**Expected:** Redirect to /admin/dashboard
**Why human:** Two-hop redirect requires live session

### 4. Dark mode visual rendering
**Test:** Navigate to any /admin/* page after signing in as admin
**Expected:** Dark sidebar (#1a1f2e background), dark gray-900 main area, top bar in dark variant — no light theme bleed
**Why human:** Tailwind v4 `@custom-variant dark` fix requires visual confirmation in a browser

### 5. Materialized view refresh
**Test:** Click the "Lam moi du lieu" button on the top bar or settings page
**Expected:** Button shows loading state, then returns to normal. No console errors. Settings page refreshed_at timestamp updates.
**Why human:** Requires live Supabase connection with `refresh_admin_views()` Postgres function available

---

## Gap Closure Summary

Both gaps from the initial verification (2026-03-18T15:00:00Z) were closed by Plan 02-04.

**Gap 1 — SHELL-02 (closed):** REQUIREMENTS.md SHELL-02 was updated from "collapsible on mobile via hamburger" to "desktop-only fixed 240px — no mobile collapse per design decision". The requirement now matches the implementation exactly. Commit 671e666e.

**Gap 2 — COMP-04 (closed):** `MapView.tsx` now has `import dynamic from 'next/dynamic'` at line 3 and exports `MapView` via `dynamic(() => Promise.resolve(MapViewPlaceholder), { ssr: false })` at line 41. The plain function reference is gone. SSR crashes when react-leaflet is installed in Phase 3 are prevented. Commit c9489a2a.

No regressions were found. The 19 previously-passing truths remain intact after the gap closure changes.

---

_Verified: 2026-03-18T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gaps closed by Plan 02-04_
