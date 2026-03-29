---
phase: 8
slug: dashboard-sales-rebuild
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Next.js project with no jest/vitest config |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx next build` |
| **Estimated runtime** | ~30 seconds (tsc), ~90 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx next build`
- **Before `/gsd:verify-work`:** Full build must pass + manual smoke test of all 5 dashboard sections
- **Max feedback latency:** ~30 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | DASH2-01 | manual-smoke | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | DASH2-01 | manual-smoke | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | DASH2-01 | manual-smoke | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 2 | DASH2-02 | manual-smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 8-02-02 | 02 | 2 | DASH2-02 | manual-smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 8-03-01 | 03 | 3 | DASH2-03 | manual-smoke | Browser test | N/A | ⬜ pending |
| 8-03-02 | 03 | 3 | DASH2-05 | manual-smoke | Browser test | N/A | ⬜ pending |
| 8-03-03 | 03 | 3 | DASH2-06 | manual-smoke | Browser test | N/A | ⬜ pending |
| 8-04-01 | 04 | 4 | DASH2-07 | manual-smoke | Browser test | N/A | ⬜ pending |
| 8-04-02 | 04 | 4 | DASH2-07 | manual-smoke | Browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework exists — all validation is TypeScript + build + manual. This is acceptable given project history (all prior phases verified manually).

*Existing infrastructure (tsc + next build) covers phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filter bar renders 5 selects; Search triggers API call | DASH2-03 | No E2E framework | Navigate to /admin/dashboard, verify 5 dropdowns, click Search |
| Tổng Quan charts render; forecast series has is_forecast points | DASH2-05 | Visual chart rendering | Verify grouped bar + area chart with dotted forecast line |
| Chỉ Số Tập Trung renders 6 donuts + 4 KPIs + daily chart | DASH2-06 | Visual chart rendering | Count pie charts, verify KPI cards show nhập/bán/khách/SKU data |
| Nhân Viên table shows staff names | DASH2-07 | Requires seeded staff data | Verify table rows have Vietnamese staff names |
| Khách Hàng map shows pins | DASH2-07 | Visual map rendering | Verify React-Leaflet map has customer location pins |
| Top 10 bars render with non-zero values | DASH2-07 | Visual chart rendering | Verify top 10 customers + products have bar lengths > 0 |
| /admin/check-users returns 404 | DASH2-01 | File deletion | Navigate to /admin/check-users, verify 404 page |
| /admin/check-clinics returns 404 | DASH2-01 | File deletion | Navigate to /admin/check-clinics, verify 404 page |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
