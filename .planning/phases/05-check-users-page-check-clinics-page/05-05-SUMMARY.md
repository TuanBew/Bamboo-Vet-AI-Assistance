---
phase: 05-check-users-page-check-clinics-page
plan: 05
subsystem: ui, api
tags: [next.js, supabase, colorpivottable, jspdf, clinics, materialized-views]

requires:
  - phase: 01-database-migrations-seed-data
    provides: clinics table, profiles table, mv_monthly_queries, mv_daily_queries
  - phase: 02-auth-admin-shell
    provides: requireAdmin auth guard, admin layout shell
  - phase: 05-check-users-page-check-clinics-page
    provides: ColorPivotTable, SectionHeader, ClinicDetailModal stub

provides:
  - check-clinics service layer with getCheckClinicsData and getClinicDetail
  - GET /api/admin/check-clinics paginated endpoint
  - GET /api/admin/check-clinics/[facilityCode]/detail daily staff breakdown endpoint
  - Full check-clinics SSR page with ColorPivotTable and filter bar
  - Fully implemented ClinicDetailModal with staff x day grid
  - Real PDF export in ColorPivotTable via jsPDF + autoTable

affects: [phase-06]

tech-stack:
  added: [jspdf, jspdf-autotable]
  patterns: [clinic-aggregation-from-materialized-views, region-zone-derivation-from-province]

key-files:
  created:
    - lib/admin/services/check-clinics.ts
    - app/api/admin/check-clinics/route.ts
    - app/api/admin/check-clinics/[facilityCode]/detail/route.ts
    - app/admin/check-clinics/CheckClinicsClient.tsx
  modified:
    - app/admin/check-clinics/page.tsx
    - components/admin/ClinicDetailModal.tsx
    - components/admin/ColorPivotTable.tsx

key-decisions:
  - "Clinic aggregation sums user metrics via clinic_id join rather than direct clinic-level queries"
  - "Region/zone derived from province via static mapping (20 clinics, acceptable)"
  - "jsPDF + jspdf-autotable for real PDF export replacing console.log stub"
  - "ClinicDetailModal uses Dialog from ui/dialog (consistent with existing stub pattern)"

patterns-established:
  - "Clinic service: aggregate mv_monthly_queries per-clinic via profiles.clinic_id mapping"
  - "PDF export: dynamic import of jspdf/jspdf-autotable in useCallback to avoid SSR issues"

requirements-completed: [CHKC-01, CHKC-02, CHKC-03, CHKC-04]

duration: 5min
completed: 2026-03-20
---

# Phase 5 Plan 05: Check Clinics Page Summary

**Full check-clinics page with ColorPivotTable (Mien/Vung/Tinh/Ma/Ten + Thang 1-12), ClinicDetailModal with staff x day grid, and jsPDF PDF export fix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T14:49:38Z
- **Completed:** 2026-03-20T14:54:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built complete check-clinics service layer aggregating mv_monthly_queries by clinic with region/zone derivation
- Created two admin-protected API routes for paginated clinics and daily staff detail
- Replaced "Coming soon" stub with full SSR page + client component with filter bar and ColorPivotTable
- Fully implemented ClinicDetailModal with staff x day grid showing color-coded query_count and session_count
- Fixed ColorPivotTable PDF export from console.log stub to real jsPDF + autoTable implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Service layer + 2 API routes + PDF export fix** - `1762e8fc` (feat)
2. **Task 2: CheckClinicsClient page + SSR page + ClinicDetailModal** - `2abebea1` (feat)

## Files Created/Modified
- `lib/admin/services/check-clinics.ts` - Service with getCheckClinicsData and getClinicDetail
- `app/api/admin/check-clinics/route.ts` - Paginated clinics API with filters
- `app/api/admin/check-clinics/[facilityCode]/detail/route.ts` - Daily staff breakdown API
- `app/admin/check-clinics/page.tsx` - SSR page with getCheckClinicsData
- `app/admin/check-clinics/CheckClinicsClient.tsx` - Client component with filter bar + pivot table
- `components/admin/ClinicDetailModal.tsx` - Full dark modal with staff x day color-coded grid
- `components/admin/ColorPivotTable.tsx` - Real PDF export via jsPDF + autoTable

## Decisions Made
- Clinic aggregation sums user metrics via clinic_id join rather than direct clinic-level queries (profiles -> clinic_id -> clinics)
- Region/zone derived from province via static mapping -- acceptable for 20 clinics
- jsPDF + jspdf-autotable installed as dependencies for real PDF generation
- ClinicDetailModal uses Dialog from @/components/ui/dialog (consistent with existing stub)
- Added `loading` prop to ClinicDetailModal beyond original interface for better UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed jspdf and jspdf-autotable dependencies**
- **Found during:** Task 1 (PDF export fix)
- **Issue:** jspdf and jspdf-autotable were not in package.json despite plan assuming they were
- **Fix:** Ran `npm install jspdf jspdf-autotable --save`
- **Files modified:** package.json, package-lock.json
- **Verification:** Dynamic import succeeds, TypeScript compilation passes
- **Committed in:** 1762e8fc (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added loading prop to ClinicDetailModal**
- **Found during:** Task 2 (ClinicDetailModal implementation)
- **Issue:** Original interface had no loading indicator; modal would show empty state during fetch
- **Fix:** Added optional `loading` prop to ClinicDetailModalProps, shows spinner while fetching
- **Files modified:** components/admin/ClinicDetailModal.tsx
- **Verification:** TypeScript compilation passes, loading state renders correctly
- **Committed in:** 2abebea1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes essential for functionality and UX. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All CHKC requirements (01-04) addressed
- ColorPivotTable PDF export works across all pages using the component
- Phase 5 check-clinics page complete alongside check-users page

## Self-Check: PASSED

- All 6 created/modified files verified on disk
- Commit 1762e8fc (Task 1) verified in git log
- Commit 2abebea1 (Task 2) verified in git log
- TypeScript compilation: 0 errors

---
*Phase: 05-check-users-page-check-clinics-page*
*Completed: 2026-03-20*
