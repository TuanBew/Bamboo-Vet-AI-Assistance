---
phase: 4
slug: ton-kho-khach-hang
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation + build check (no automated test setup in project) |
| **Config file** | none |
| **Quick run command** | `npx next build` |
| **Full suite command** | `npx next build && npx next start` (manual page check) |
| **Estimated runtime** | ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Run full build + manual page navigation
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TK-01 | manual | `npx tsx scripts/seed.ts` (after migration) | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | TK-01 | build | `npx next build` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | TK-02, TK-03 | manual | `curl localhost:3000/api/admin/ton-kho?snapshot_date=2026-03-20` | N/A | ⬜ pending |
| 04-02-02 | 02 | 2 | TK-03 | manual | Navigate to `/admin/ton-kho` | N/A | ⬜ pending |
| 04-03-01 | 03 | 3 | KH-01, KH-02 | manual | `curl localhost:3000/api/admin/khach-hang` | N/A | ⬜ pending |
| 04-03-02 | 03 | 3 | KH-03, KH-04, KH-05 | manual | Navigate to `/admin/khach-hang` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (no test files to create — project uses build + manual validation pattern consistent with Phases 1–3).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration creates 3 tables | TK-01 | No test infra | Apply migration, verify in Supabase table editor |
| Seed inserts correct row counts | TK-01 | No test infra | Run `npx tsx scripts/seed.ts`, check inventory_snapshots (~806), customers (~200), customer_purchases (~500-800) |
| Old KB/Users files deleted | TK-01 | No test infra | Check that app/admin/knowledge-base, app/admin/users, etc. no longer exist |
| Ton-kho page KPI cards correct | TK-03 | Visual | Navigate to `/admin/ton-kho`, verify 3 KPI cards show non-zero values |
| Ton-kho 6 charts render | TK-03 | Visual | Verify 2×3 chart grid renders with visible bars/donuts |
| Date picker changes data | TK-03 | Visual | Change date, verify KPIs + charts update |
| Khach-hang 3 charts render | KH-02 | Visual | Navigate to `/admin/khach-hang`, verify LineChart + 2 BarCharts render |
| Breakdown tables correct | KH-03, KH-04 | Visual | Verify all 8 customer types listed with counts and percentages |
| >300K section collapsed | KH-05 | Visual | Verify section starts collapsed, expands on click |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
