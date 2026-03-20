---
phase: 05-check-users-page-check-clinics-page
plan: 04
subsystem: ui, api
tags: [leaflet, supabase, DataTable, ColorPivotTable, Sheet, conversations, messages]

requires:
  - phase: 01-database-migrations-seed-data
    provides: profiles, clinics, conversations, messages, mv_monthly_queries tables
  - phase: 02-admin-shell-auth
    provides: requireAdmin, createServiceClient, admin layout shell
  - phase: 04-knowledge-base-users-analytics
    provides: DataTable, ColorPivotTable, MapView, SectionHeader components
provides:
  - check-users service layer (getCheckUsersData) with map_pins, paginated users, monthly_pivot
  - GET /api/admin/check-users API route
  - GET /api/admin/users/[userId]/conversations API route
  - GET /api/admin/users/[userId]/conversations/[conversationId]/messages API route
  - Full CheckUsersClient page (map + DataTable + pivot)
  - Fully wired UserHistoryDrawer with conversation list + chat thread view
affects: [06-check-clinics-page]

tech-stack:
  added: []
  patterns: [JS-side profile+clinic join for small datasets, service role client for bypassing conversation RLS]

key-files:
  created:
    - lib/admin/services/check-users.ts
    - app/api/admin/check-users/route.ts
    - app/api/admin/users/[userId]/conversations/route.ts
    - app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts
    - app/admin/check-users/CheckUsersClient.tsx
  modified:
    - app/admin/check-users/page.tsx
    - components/admin/UserHistoryDrawer.tsx

key-decisions:
  - "JS-side join for profiles+clinics since Supabase JS cannot join profiles (auth.users reference) with clinics directly"
  - "Fetch all non-admin profiles (~80 rows) and filter/paginate in JS — acceptable for small dataset"
  - "Service role client for conversations/messages APIs to bypass RLS (conversations have owner-only RLS)"
  - "UserHistoryDrawer uses single-panel view switching (list vs thread) instead of side-by-side split"

patterns-established:
  - "Service role bypass for admin viewing user-owned RLS-protected data"
  - "Back-arrow navigation within Sheet drawer for drill-down views"

requirements-completed: [CHKU-01, CHKU-02, CHKU-03, CHKU-04, CHKU-05, CHKU-06, CHKU-07]

duration: 5min
completed: 2026-03-20
---

# Phase 05 Plan 04: Check Users Page Summary

**Full /admin/check-users page with Leaflet map (color-coded user_type pins), DataTable (11 cols + Xem lich su), ColorPivotTable (monthly queries), and UserHistoryDrawer with conversation list + chat thread view**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T14:49:24Z
- **Completed:** 2026-03-20T14:54:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Service layer fetching map_pins, paginated users (joined with clinics in JS), and monthly_pivot from mv_monthly_queries
- Three API routes with requireAdmin guard; conversations and messages routes use service role client to bypass RLS
- Full client page replacing "Coming soon" stub: filter bar (province, user_type, search), Leaflet map, DataTable with all 5 exports, monthly ColorPivotTable
- UserHistoryDrawer fully implemented: conversation list with message counts, chat-style message thread with back navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Service layer + 3 API routes** - `63f0a6c0` (feat)
2. **Task 2: CheckUsersClient + SSR page + UserHistoryDrawer** - `2abebea1` (feat)

## Files Created/Modified
- `lib/admin/services/check-users.ts` - Service layer with getCheckUsersData, types, USER_TYPE_COLORS
- `app/api/admin/check-users/route.ts` - GET handler with requireAdmin + filter params
- `app/api/admin/users/[userId]/conversations/route.ts` - GET handler for user conversation list with message counts
- `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts` - GET handler for conversation messages
- `app/admin/check-users/page.tsx` - SSR page with getCheckUsersData call (replaced "Coming soon" stub)
- `app/admin/check-users/CheckUsersClient.tsx` - Full client component: map, DataTable, ColorPivotTable, drawer integration
- `components/admin/UserHistoryDrawer.tsx` - Full implementation replacing stub: conversation list + chat thread view

## Decisions Made
- JS-side join for profiles+clinics since Supabase JS cannot join profiles (auth.users FK) with clinics directly
- Fetch all ~80 non-admin profiles and filter/paginate in JS — acceptable for small dataset
- Service role client for conversations/messages to bypass owner-only RLS
- Single-panel view switching in UserHistoryDrawer (list vs thread with back arrow) instead of side-by-side

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Check-users page complete with all 7 CHKU requirements addressed
- UserHistoryDrawer pattern (service role + conversation drill-down) reusable for any user history viewing
- Pre-existing TS error in check-clinics/page.tsx (references not-yet-created CheckClinicsClient) — will be resolved by plan 05-05

---
*Phase: 05-check-users-page-check-clinics-page*
*Completed: 2026-03-20*
