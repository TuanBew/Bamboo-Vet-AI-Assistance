---
phase: 02-admin-shell-role-based-routing
plan: 01
subsystem: auth
tags: [supabase, middleware, rls, dark-mode, tailwind-v4, admin-guard]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data
    provides: profiles table with is_admin column
provides:
  - Dark mode CSS fix for Tailwind v4 custom variant
  - Admin route guards in updateSession() middleware
  - requireAdmin() utility for API route protection
affects: [02-admin-shell-role-based-routing, 03-admin-dashboard-kpis, 04-user-management-table, 05-clinic-analytics-map, 06-pdf-export-final-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-import-in-middleware, service-role-for-admin-check, try-catch-fallthrough-on-db-error]

key-files:
  created:
    - lib/admin/auth.ts
  modified:
    - app/globals.css
    - lib/supabase/middleware.ts

key-decisions:
  - "Used dynamic import for createServiceClient in middleware to avoid cookies() evaluation in proxy scope"
  - "Added try/catch around profile DB lookups in middleware to prevent infinite redirect loops on network errors"
  - "requireAdmin returns 403 JSON (not redirect) since it protects API routes, not page routes"

patterns-established:
  - "Admin API route guard pattern: const auth = await requireAdmin(); if (auth instanceof NextResponse) return auth;"
  - "Dynamic import pattern in middleware: const { createServiceClient } = await import('@/lib/supabase/server')"
  - "Service role client for admin checks: bypasses RLS to read profiles.is_admin"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 2 Plan 1: Auth Guards, Dark Mode Fix, and requireAdmin Utility Summary

**Tailwind v4 dark mode selector fix, admin route guards in updateSession() middleware, and requireAdmin() API utility using service-role profile lookup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T13:49:39Z
- **Completed:** 2026-03-18T13:53:31Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Fixed Tailwind v4 dark mode custom variant from `(&:is(.dark *))` to `(&:where(.dark, .dark *))` so dark styles apply to both the `.dark` element and descendants
- Extended updateSession() middleware with admin route guards: unauthenticated and non-admin users blocked from /admin/*, admin users redirected from /app to /admin/dashboard
- Created requireAdmin() utility that returns `{ user, profile }` for valid admins or 403 JSON for unauthorized callers

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix globals.css dark mode selector** - `21ae680b` (fix)
2. **Task 2: Extend updateSession() with admin route guards** - `84436fda` (feat)
3. **Task 3: Create requireAdmin() utility** - `5c5935a7` (feat)

## Files Created/Modified
- `app/globals.css` - Fixed dark mode custom variant selector for Tailwind v4
- `lib/supabase/middleware.ts` - Added admin route guards (AUTH-01, AUTH-02, AUTH-03) with dynamic import of createServiceClient
- `lib/admin/auth.ts` - New requireAdmin() utility for API route protection (AUTH-04)

## Decisions Made
- Used dynamic import (`await import('@/lib/supabase/server')`) in middleware to avoid top-level cookies() evaluation in proxy module scope
- Added try/catch around all profile DB lookups in middleware with fallthrough behavior to prevent infinite redirect loops on network errors
- requireAdmin() returns 403 JSON response (not redirect) since it protects API routes where JSON errors are appropriate
- Confirmed proxy.ts is the correct Next.js 16 convention (NOT middleware.ts) -- build output shows "Proxy (Middleware)" confirming recognition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added try/catch error handling around profile DB lookups in middleware**
- **Found during:** Task 2 (admin route guards)
- **Issue:** Plan noted "let the request through rather than redirecting" on DB failures, but did not specify try/catch blocks
- **Fix:** Wrapped all three createServiceClient profile lookups in try/catch with appropriate fallthrough behavior
- **Files modified:** lib/supabase/middleware.ts
- **Verification:** Build passes, error paths prevent infinite redirect loops
- **Committed in:** 84436fda (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for preventing infinite redirect loops on database connectivity issues. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth guard foundation complete: all /admin/* routes protected, /api/admin/* routes have requireAdmin() utility
- Dark mode CSS fix enables admin dark theme work in Plan 02-02 (admin shell layout)
- proxy.ts confirmed working with Next.js 16 -- no naming conflicts

## Self-Check: PASSED

All 3 created/modified files verified on disk. All 3 task commits verified in git log.

---
*Phase: 02-admin-shell-role-based-routing*
*Completed: 2026-03-18*
