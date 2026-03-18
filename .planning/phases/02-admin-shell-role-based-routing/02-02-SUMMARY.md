---
phase: 02-admin-shell-role-based-routing
plan: 02
subsystem: ui
tags: [nextjs, tailwind, dark-theme, admin-layout, sidebar, server-actions, supabase-rpc]

# Dependency graph
requires:
  - phase: 02-admin-shell-role-based-routing/01
    provides: "Auth guards (requireAdmin), dark mode CSS fix, proxy middleware"
  - phase: 01-database-migrations-seed-data
    provides: "Materialized views (mv_dashboard_kpis), refresh_admin_views RPC, profiles table"
provides:
  - "Admin layout shell with dark sidebar and top bar"
  - "AdminSidebar component with 3 sections and 7 nav items"
  - "AdminTopBar with breadcrumb and refresh button"
  - "Server action for refreshMaterializedViews"
  - "7 admin page routes (6 placeholders + settings page)"
  - "Settings page with admin profile, is_admin badge, refresh timestamp"
affects: [03-kpi-cards-recent-queries, 04-charts-province-map, 05-detail-modals-drill-downs, 06-pdf-export-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Admin dark layout with className='dark' wrapper", "Server action for RPC calls", "Client component RefreshButton extracted for server component pages"]

key-files:
  created:
    - app/admin/layout.tsx
    - components/admin/AdminSidebar.tsx
    - components/admin/AdminTopBar.tsx
    - app/admin/_actions/refresh-views.ts
    - app/admin/dashboard/page.tsx
    - app/admin/new-activity/page.tsx
    - app/admin/knowledge-base/page.tsx
    - app/admin/users/page.tsx
    - app/admin/check-users/page.tsx
    - app/admin/check-clinics/page.tsx
    - app/admin/settings/page.tsx
    - app/admin/settings/refresh-button.tsx
  modified: []

key-decisions:
  - "Extracted RefreshButton as separate client component for settings page (server component)"
  - "Sign out uses createBrowserClient in AdminTopBar for client-side auth"

patterns-established:
  - "Admin pages render inside dark layout wrapper (className='dark') -- no LanguageProvider, no SidebarProvider"
  - "Server actions in app/admin/_actions/ for admin-specific RPC calls"
  - "Client components for interactive buttons in server component pages"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 2 Plan 02: Admin Shell Summary

**Dark admin layout with 240px sidebar (3 sections, 7 nav items), top bar with breadcrumb and refresh, 7 page routes, and settings page with profile and refresh timestamp**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T14:17:06Z
- **Completed:** 2026-03-18T14:21:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Admin layout shell with dark sidebar (#1a1f2e) and top bar on all /admin/* pages
- AdminSidebar with CORE/CHECKED/OTHER sections, teal labels, white active pill
- AdminTopBar with breadcrumb, refresh button (calls refresh_admin_views RPC), and sign out
- Settings page with admin profile info, is_admin badge, and refreshed_at timestamp from mv_dashboard_kpis
- All 7 admin page routes compile and appear in Next.js build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AdminSidebar, AdminTopBar, refresh server action, and admin layout** - `bfda0dbe` (feat)
2. **Task 2: Create all 7 admin page shells including settings page** - `4468ef99` (feat)

## Files Created/Modified
- `app/admin/layout.tsx` - Admin layout with dark wrapper, sidebar + top bar
- `components/admin/AdminSidebar.tsx` - 240px dark sidebar with 3 sections, 7 nav items
- `components/admin/AdminTopBar.tsx` - Top bar with breadcrumb, refresh button, sign out
- `app/admin/_actions/refresh-views.ts` - Server action calling refresh_admin_views RPC
- `app/admin/dashboard/page.tsx` - Dashboard placeholder
- `app/admin/new-activity/page.tsx` - New activity placeholder
- `app/admin/knowledge-base/page.tsx` - Knowledge base placeholder
- `app/admin/users/page.tsx` - Users placeholder
- `app/admin/check-users/page.tsx` - Check users placeholder
- `app/admin/check-clinics/page.tsx` - Check clinics placeholder
- `app/admin/settings/page.tsx` - Settings page with profile, badge, refresh timestamp
- `app/admin/settings/refresh-button.tsx` - Client component for refresh button on settings page

## Decisions Made
- Extracted RefreshButton as a separate client component for the settings page since the page itself is a server component
- Used createBrowserClient in AdminTopBar for client-side sign out (avoids server action complexity for auth)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin shell is complete and ready for KPI cards, charts, and data display in Phase 3+
- All 6 placeholder pages are ready to be replaced with real implementations
- Server action pattern established for refresh functionality

## Self-Check: PASSED

- All 12 created files verified present on disk
- Commits bfda0dbe and 4468ef99 verified in git log
- `npx next build` passes with all 7 admin routes in output

---
*Phase: 02-admin-shell-role-based-routing*
*Completed: 2026-03-18*
