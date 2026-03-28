---
phase: 06-security-polish
plan: 01
subsystem: infra
tags: [csp, print-css, leaflet, tsx, npm-audit]

requires:
  - phase: 05-distributor-analytics
    provides: admin pages needing print support and Leaflet maps
provides:
  - tsx devDependency for TypeScript script execution
  - CSP img-src and connect-src allowing Leaflet tile server
  - Print CSS hiding admin sidebar/topbar during window.print()
  - ID attributes on admin layout wrappers for CSS targeting
affects: [06-security-polish]

tech-stack:
  added: [tsx@^4.21.0]
  patterns: [print-media-query-hiding, csp-whitelist-per-service]

key-files:
  created: []
  modified: [package.json, next.config.js, app/globals.css, app/admin/layout.tsx]

key-decisions:
  - "xlsx audit vulnerabilities (4 high) accepted as no-fix-available; admin-only usage limits attack surface"
  - "CSP includes explicit tile.openstreetmap.org in both img-src and connect-src per CONTEXT.md locked decision"

patterns-established:
  - "Print CSS: use @media print in globals.css targeting #admin-sidebar, #admin-topbar, #admin-main IDs"
  - "CSP whitelist: add external service domains to both img-src and connect-src when service loads images via fetch"

requirements-completed: [POL-01, POL-02, POL-04]

duration: 2min
completed: 2026-03-28
---

# Phase 06 Plan 01: Security Hardening + Print CSS + CSP Summary

**tsx devDependency installed, all 9 packages verified, print CSS hiding admin chrome, and CSP updated for Leaflet tiles**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T14:15:57Z
- **Completed:** 2026-03-28T14:18:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All 9 required packages verified present (jspdf@4.2.1 for CVE mitigation, tsx@4.21.0 as devDep)
- CSP img-src and connect-src both explicitly include https://*.tile.openstreetmap.org
- Print CSS hides sidebar and topbar, overrides dark backgrounds to white, preserves color-coded pivot cells
- Admin layout has ID attributes (admin-sidebar, admin-topbar, admin-main) for CSS targeting

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tsx + verify all 9 packages + update CSP** - `c1190232` (chore)
2. **Task 2: Add print CSS rules + ID attributes on admin layout** - `fa32d5f8` (feat)

## Files Created/Modified
- `package.json` - Added tsx@^4.21.0 as devDependency
- `package-lock.json` - Updated lockfile with tsx dependency tree
- `next.config.js` - Added https://*.tile.openstreetmap.org to CSP img-src and connect-src
- `app/globals.css` - Added @media print block hiding admin chrome, overriding dark backgrounds
- `app/admin/layout.tsx` - Added id="admin-sidebar", id="admin-topbar", id="admin-main" wrapper attributes

## Decisions Made
- xlsx audit vulnerabilities (4 high, SheetJS prototype pollution + ReDoS) accepted as no-fix-available; package is used only in admin-authenticated Excel export, limiting attack surface
- CSP includes explicit tile.openstreetmap.org in both img-src and connect-src per CONTEXT.md locked decision, even though img-src already has broad https: allowance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- npm audit reports 4 high vulnerabilities in xlsx (SheetJS) with no fix available. These are known upstream issues with no patched version. The package is used only behind admin authentication for Excel export functionality.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Print CSS foundation ready for Phase 06 Plan 02+ (Vietnamese PDF exports)
- CSP updated, Leaflet maps will load tiles without console errors
- All package dependencies verified for remaining Phase 06 plans

---
*Phase: 06-security-polish*
*Completed: 2026-03-28*
