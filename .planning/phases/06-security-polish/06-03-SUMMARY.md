---
phase: 06-security-polish
plan: 03
subsystem: i18n
tags: [vietnamese, i18n, dictionary, diacritics, admin-ui]

# Dependency graph
requires:
  - phase: 02-admin-shell
    provides: Admin shell layout with hardcoded Vietnamese strings
provides:
  - Centralized Vietnamese i18n dictionary (lib/i18n/vietnamese.ts)
  - All shared admin components refactored to use VI.* references
  - Correct Vietnamese diacritics in sidebar and topbar labels
affects: [06-04-page-client-i18n]

# Tech tracking
tech-stack:
  added: []
  patterns: [centralized-i18n-dictionary, VI-namespace-pattern]

key-files:
  created:
    - lib/i18n/vietnamese.ts
  modified:
    - components/admin/AdminSidebar.tsx
    - components/admin/AdminTopBar.tsx
    - components/admin/DataTable.tsx
    - components/admin/ColorPivotTable.tsx
    - components/admin/FilterBar.tsx

key-decisions:
  - "Removed `as const` from NAV_SECTIONS and added explicit NavSection/NavItem types to allow dynamic VI.* values"
  - "Added allProvinces/allDistricts/allClinicTypes/filterHint keys to VI.filter for FilterBar default options"

patterns-established:
  - "VI namespace pattern: import { VI } from '@/lib/i18n/vietnamese' for all admin Vietnamese strings"
  - "Page-specific sections in dictionary (VI.nhapHang, VI.tonKho, etc.) for page-client refactoring in Plan 04"

requirements-completed: [POL-06]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 06 Plan 03: Vietnamese i18n Dictionary Summary

**Centralized Vietnamese UI string dictionary with 189 lines covering all admin pages, plus refactored 5 shared components to use VI.* references with correct diacritics**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T14:16:12Z
- **Completed:** 2026-03-28T14:24:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created comprehensive Vietnamese i18n dictionary (lib/i18n/vietnamese.ts) with 14 sections covering nav, topbar, buttons, table, filter, dashboard, nhapHang, tonKho, khachHang, checkUsers, checkClinics, checkCustomers, checkDistributor, and common
- Refactored all 5 shared admin components (AdminSidebar, AdminTopBar, DataTable, ColorPivotTable, FilterBar) to import and use VI.* references
- Fixed missing Vietnamese diacritics throughout: "Nhap hang" became "Nhập hàng", "Ton kho" became "Tồn kho", "Dang xuat" became "Đăng xuất", etc.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Vietnamese i18n dictionary** - `86cf8d7c` (feat)
2. **Task 2: Refactor shared admin components to use VI dictionary** - `a5459661` (feat)

## Files Created/Modified
- `lib/i18n/vietnamese.ts` - Centralized VI dictionary with 189 lines, exported as const with VIKeys type
- `components/admin/AdminSidebar.tsx` - Nav labels from VI.nav.*, removed `as const`, added NavSection/NavItem types
- `components/admin/AdminTopBar.tsx` - Button labels from VI.topbar.*
- `components/admin/DataTable.tsx` - Search placeholder, noData, pagination buttons, export buttons from VI.*
- `components/admin/ColorPivotTable.tsx` - Display/rows/prev/next/noData/showing from VI.table.*, export buttons from VI.buttons.*
- `components/admin/FilterBar.tsx` - Province/district/clinicType placeholders and filter hint from VI.filter.*

## Decisions Made
- Removed `as const` assertion from NAV_SECTIONS since dynamic VI.* values cannot be used in const assertions; added explicit NavSection/NavItem interface types instead
- Added extra dictionary keys (allProvinces, allDistricts, allClinicTypes, filterHint) not in original plan to cover FilterBar default option labels

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added FilterBar default option labels to dictionary**
- **Found during:** Task 2 (FilterBar refactoring)
- **Issue:** FilterBar had hardcoded Vietnamese default option texts ("Tat ca tinh/thanh", "Tat ca quan/huyen", "Tat ca loai co so", "Bo loc ap dung cho bieu do") not covered by original plan dictionary
- **Fix:** Added VI.filter.allProvinces, VI.filter.allDistricts, VI.filter.allClinicTypes, VI.filter.filterHint to dictionary
- **Files modified:** lib/i18n/vietnamese.ts, components/admin/FilterBar.tsx
- **Verification:** No hardcoded Vietnamese remains in FilterBar
- **Committed in:** a5459661 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor dictionary expansion to cover FilterBar labels. No scope creep.

## Issues Encountered
- Initial file write used Unicode escape sequences instead of literal UTF-8 characters, causing diacritic verification to fail. Rewrote with literal Vietnamese characters.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VI dictionary ready for page-client refactoring in Plan 04
- All shared components already consume VI.* -- page-specific clients just need to import and use page-specific sections (VI.nhapHang, VI.tonKho, etc.)

---
*Phase: 06-security-polish*
*Completed: 2026-03-28*
