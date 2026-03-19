---
phase: 4
slug: knowledge-base-page-users-analytics-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc --noEmit) |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit 2>&1 | tail -20` |
| **Full suite command** | `npx tsc --noEmit && npx next build 2>&1 | tail -30` |
| **Estimated runtime** | ~30 seconds (tsc) / ~120 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit 2>&1 | tail -20`
- **After every plan wave:** Run `npx tsc --noEmit && npx next build 2>&1 | tail -30`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | KB-01 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | KB-01 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | KB-01 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | KB-02 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | KB-02 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | KB-03 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | USERS-01 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | USERS-02 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install xlsx` — xlsx package required for Excel export (not yet installed)
- [ ] Verify `@tanstack/react-table` is installed: `npm ls @tanstack/react-table`

*Existing TypeScript infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KPI card values match DB | KB-01 | Requires seeded DB | Check totals in Supabase match rendered KPI cards |
| Excel export downloads valid .xlsx | KB-02 | File download | Click Export Excel, open file, verify columns and data |
| Chart renders with data | KB-01, USERS-01 | Visual | Load page, confirm all charts show non-zero data |
| Heavy users collapsible works | USERS-05 | Interaction | Click section header, verify expand/collapse |
| Facility breakdown percentages correct | USERS-03, USERS-04 | Math verification | Spot-check % values vs raw counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
