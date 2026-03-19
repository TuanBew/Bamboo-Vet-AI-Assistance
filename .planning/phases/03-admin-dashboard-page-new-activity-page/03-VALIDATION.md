---
phase: 3
slug: admin-dashboard-page-new-activity-page
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Next.js/TypeScript) |
| **Config file** | vitest.config.ts (Wave 0 installs if missing) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-00 | 01 | 0 | DASH-01 | scaffold | `test -f lib/admin/__tests__/forecast.test.ts` | ✅ W0 | ⬜ pending |
| 3-01-01 | 01 | 1 | DASH-01 | deps | `node -e "require('./package.json')"` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | DASH-01 | unit | `npx vitest run lib/admin/__tests__/forecast.test.ts` | ✅ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | DASH-02 | type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 2 | DASH-03 | type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 2 | DASH-04 | manual | see manual section | — | ⬜ pending |
| 3-02-03 | 02 | 2 | DASH-05 | manual | see manual section | — | ⬜ pending |
| 3-02-04 | 02 | 2 | DASH-06 | manual | see manual section | — | ⬜ pending |
| 3-03-01 | 03 | 2 | ACT-01 | type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 3-03-02 | 03 | 2 | ACT-02 | manual | see manual section | — | ⬜ pending |
| 3-03-03 | 03 | 2 | ACT-03 | manual | see manual section | — | ⬜ pending |
| 3-03-04 | 03 | 2 | ACT-04 | manual | see manual section | — | ⬜ pending |
| 3-03-05 | 03 | 2 | ACT-05 | manual | see manual section | — | ⬜ pending |
| 3-03-06 | 03 | 2 | ACT-06 | manual | see manual section | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `lib/admin/__tests__/forecast.test.ts` — unit tests for linear regression in `forecast.ts` (created by Plan 03-01 Task 0)
- [ ] `vitest.config.ts` — if not present, install vitest and configure (handled in Plan 03-01 Task 0)

*Wave 0 also verifies TypeScript types across API routes and page components.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Leaflet map renders with color-coded pins | DASH-05 | Browser-only (SSR: false); no jsdom support for Leaflet | Open /admin/dashboard, verify colored pins appear on map, click pin shows popup |
| AreaChart forecast dotted line visible | DASH-02 | Visual rendering; can't assert SVG strokeDasharray in unit tests | Open /admin/dashboard, verify last 3 data points on area chart are dotted |
| KPI cards show non-zero platform totals | DASH-01 | Requires live Supabase data | Open /admin/dashboard, verify all 5 KPI cards show > 0 values |
| Dashboard filter bar applies to charts not KPIs | DASH-03 | Visual/behavioral — filter state changes chart data, KPIs unchanged | Select a province filter, verify charts change, verify KPI totals unchanged |
| Daily volume LineChart renders in Chi so tap trung | DASH-04 | Visual rendering | Open /admin/dashboard, verify LineChart in section 2 shows daily query data |
| 6 donut PieCharts render (3 query + 3 session context) | DASH-04 | Visual rendering | Open /admin/dashboard, verify 6 donuts in 2 rows with distinct row labels |
| New Activity 6 KPI cards with distinct background colors | ACT-01 | Visual verification | Open /admin/new-activity, verify 6 colored cards (blue/orange/cyan/pink/green/purple) |
| Recent sessions table shows correct data | ACT-03 | Requires live data | Open /admin/new-activity, verify table rows with session codes, durations |
| Top 10 questions horizontal BarChart renders | ACT-04 | Visual | Open /admin/new-activity, verify horizontal bar chart with question prefixes |
| Category donut PieCharts render with data | ACT-05 | Visual | Open /admin/new-activity, verify 3 donut charts (drug_group, animal_type, query_type) |
| No SSR hydration errors in browser console | DASH-01, ACT-01 | Browser DevTools check | Open both pages, verify no hydration mismatch errors in console |
| `next build` completes with no TypeScript errors | DASH-06, ACT-06 | Build-time check | Run `npm run build`, verify exit 0 with no TS errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
