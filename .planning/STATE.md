---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-02-PLAN.md
last_updated: "2026-03-18T14:21:15Z"
last_activity: 2026-03-18 — Completed 02-02 admin shell layout and page routes
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Admins can see exactly who is using the platform, what they're asking, and where they're located — so they can manage knowledge base quality, monitor clinic engagement, and identify usage patterns across the Vietnamese veterinary market.
**Current focus:** Phase 2 — Admin Shell & Role-Based Routing

## Current Position

Phase: 2 of 6 (Admin Shell & Role-Based Routing)
Plan: 2 of 3 in current phase (completed)
Status: Executing
Last activity: 2026-03-18 — Completed 02-02 admin shell layout and page routes

Progress: [████████░░] 83%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 min
- Total execution time: 0.23 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-database-migrations-seed-data | 2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (2 min), 01-02 (8 min), 02-02 (4 min)
- Trend: stable

*Updated after each plan completion*
| Phase 01 P03 | 6 | 1 tasks | 1 files |
| Phase 02 P01 | 4 | 3 tasks | 3 files |
| Phase 02 P02 | 4 | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: proxy.ts vs middleware.ts naming is unresolved — MUST smoke-test (`curl /app` while logged out) before writing any auth guard code in Phase 2. Two research agents contradict each other; smoke test is the only source of truth.
- [Pre-build]: jsPDF must be pinned to `^4.2.0` minimum — versions ≤3.0.4 have CVE-2025-68428 (CVSS 9.2).
- [Pre-build]: Leaflet map components require `dynamic(() => import(), { ssr: false })` — `'use client'` alone is not sufficient and causes SSR crashes.
- [Pre-build]: `mv_dashboard_kpis` cannot use REFRESH CONCURRENTLY (no unique key on a single-row aggregate); the other 3 views need UNIQUE INDEXes in the same migration file.
- [Pre-build]: `globals.css` dark mode selector bug (`(&:is(.dark *))`) must be fixed to `(&:where(.dark, .dark *))` before any admin dark theme is testable (AUTH-05 in Phase 2).
- [Phase 01]: All migrations use IF NOT EXISTS guards for idempotent re-runs
- [Phase 01]: RLS policies checked via pg_policies before creation to avoid duplicates
- [Phase 01]: Added 2 extra clinics (Thai Nguyen, Khanh Hoa) to satisfy both province and type distribution constraints for seed profiles
- [Phase 01]: UUID prefix convention: c0a1 for clinics, p0a2 for profiles, cv for conversations, qe for query_events
- [Phase 01]: "Others" province mapped to Thua Thien Hue + Thai Nguyen + Khanh Hoa
- [Phase 01]: Seed script uses same dotenv+createClient pattern as refresh-views.ts
- [Phase 02]: Dynamic import for createServiceClient in middleware avoids cookies() in proxy scope
- [Phase 02]: proxy.ts confirmed as correct Next.js 16 convention (build shows Proxy Middleware)
- [Phase 02]: requireAdmin returns 403 JSON not redirect since it protects API routes
- [Phase 02]: Extracted RefreshButton as separate client component for settings page (server component)
- [Phase 02]: Admin sign out uses createBrowserClient in AdminTopBar for client-side auth

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 2 blocker (RESOLVED)**: proxy.ts confirmed as correct Next.js 16 convention -- build output shows "Proxy (Middleware)", no rename needed.
- **Phase 5 concern**: Clinic detail modal has dynamic day columns (28–31 per month) — highest-complexity single component in the spec; consider a brief spike to validate cell layout before full implementation.
- **Phase 6 concern**: Vietnamese PDF font embedding adds ~200KB to client bundle on check-users page — decide during Phase 6 whether to lazy-load or pre-embed.

## Session Continuity

Last session: 2026-03-18T14:21:15Z
Stopped at: Completed 02-02-PLAN.md
Resume file: .planning/phases/02-admin-shell-role-based-routing/02-03-PLAN.md
