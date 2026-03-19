---
phase: 04-knowledge-base-page-users-analytics-page
plan: 01
subsystem: api, ui
tags: [tanstack-react-table, xlsx, supabase, datatable, pagination, excel-export]

requires:
  - phase: 02-admin-shell-shared-components
    provides: DataTable stub, admin shell, requireAdmin auth guard
  - phase: 01-database-migrations-seed-data
    provides: kb_documents table with seed data

provides:
  - Full DataTable component with @tanstack/react-table (pagination, sorting, search, export)
  - Knowledge Base service function (getKnowledgeBaseData) with KPIs, charts, paginated docs
  - Knowledge Base API route (GET /api/admin/knowledge-base) with requireAdmin guard

affects: [04-02 KB page UI, 04-03 Users page]

tech-stack:
  added: [xlsx 0.18.5]
  patterns: [server-side pagination via DataTable props, dynamic xlsx import for Excel export, JS-based groupBy aggregation for small datasets]

key-files:
  created:
    - lib/admin/services/knowledge-base.ts
    - app/api/admin/knowledge-base/route.ts
  modified:
    - components/admin/DataTable.tsx
    - package.json

key-decisions:
  - "DataTable supports both server-side and client-side pagination via optional totalCount/onPageChange props"
  - "KB service fetches all docs once for KPI/chart aggregation (acceptable for ~120 docs)"
  - "xlsx dynamically imported in export handler to avoid SSR bundle issues"

patterns-established:
  - "DataTable server pagination: pass totalCount, currentPage, onPageChange for server-controlled paging"
  - "Export toolbar: Copy uses navigator.clipboard, Excel uses dynamic xlsx import, CSV generates Blob download"
  - "KB service groupBy helper: in-memory aggregation for small datasets with sort-by-count-descending"

requirements-completed: [KB-01, KB-03]

duration: 4min
completed: 2026-03-19
---

# Phase 4 Plan 1: DataTable + KB Service/Route Summary

**Full @tanstack/react-table DataTable with pagination/sorting/export, KB service querying kb_documents for 3 KPIs + 6 chart datasets + paginated docs, and protected API route**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T16:30:30Z
- **Completed:** 2026-03-19T16:34:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Replaced DataTable stub with full @tanstack/react-table implementation supporting server-side and client-side pagination, column sorting, search, and export toolbar (Copy, Excel, CSV, PDF placeholder, Print)
- Created KB service function that computes 3 KPIs (total_documents, total_chunks, unique_ratio), 6 chart datasets (chunks/docs by drug_group, category, doc_type, source), and paginated documents with search filtering
- Created KB API route with requireAdmin() guard accepting page, page_size, search, doc_type, category query params

## Task Commits

1. **Task 1: Install xlsx + implement DataTable** - `4005ec43` (feat)
2. **Task 2: Create KB service function** - `d0bff4e4` (feat)
3. **Task 3: Create KB API route** - `e9b80b4b` (feat)

## Files Created/Modified
- `components/admin/DataTable.tsx` - Full DataTable with @tanstack/react-table, pagination, sorting, export
- `lib/admin/services/knowledge-base.ts` - KB service function with KPI aggregation, chart grouping, paginated queries
- `app/api/admin/knowledge-base/route.ts` - Protected GET endpoint for KB data
- `package.json` - Added xlsx 0.18.5 dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- DataTable supports both server-side pagination (via totalCount/onPageChange) and client-side pagination (via getPaginationRowModel) -- server mode used by KB page, client mode available for simpler use cases
- KB service fetches all ~120 docs once for KPI and chart aggregation rather than running multiple SQL GROUP BY queries -- acceptable for this dataset size
- xlsx is dynamically imported (`await import('xlsx')`) only when Excel export button is clicked, keeping it out of the initial client bundle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added custom render support to DataTableColumn**
- **Found during:** Task 1 (DataTable implementation)
- **Issue:** Original DataTableColumn interface had no way to render custom cell content (needed for status badges, formatted dates in KB table)
- **Fix:** Added optional `render` callback to DataTableColumn interface
- **Files modified:** components/admin/DataTable.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 4005ec43

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Render callback is essential for the KB page to display formatted columns. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `app/admin/users/page.tsx` referencing non-existent `UsersClient` module -- this is expected and will be resolved in Plan 02/03 of this phase. Does not affect Plan 01 deliverables.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DataTable component ready for KB page UI (Plan 02)
- KB API route ready for client-side data fetching
- Service function can be called from both SSR page.tsx and API route
- xlsx installed for Excel export functionality

---
*Phase: 04-knowledge-base-page-users-analytics-page*
*Completed: 2026-03-19*

## Self-Check: PASSED

All 3 created/modified files verified on disk. All 3 task commit hashes found in git log.
