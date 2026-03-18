---
phase: 2
slug: admin-shell-role-based-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Phase 2 is UI/middleware, manual + browser smoke tests |
| **Config file** | none |
| **Quick run command** | `npx next build 2>&1 | tail -5` |
| **Full suite command** | `npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build 2>&1 | tail -5`
- **After every plan wave:** Run `npx next build`
- **Before `/gsd:verify-work`:** Full build must be green + browser smoke tests passed
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | AUTH-01 | smoke | `npx next build` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-02 | smoke | `npx next build` | ✅ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | AUTH-03 | manual | browser redirect test | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | AUTH-04 | manual | browser redirect test | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 2 | AUTH-05 | manual | curl /api/admin/dashboard as non-admin → 403 | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | SHELL-01 | smoke | `npx next build` | ✅ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | SHELL-02 | manual | browser: dark sidebar renders, nav items visible | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | COMP-01–07 | smoke | `npx next build` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing `next build` covers TypeScript type-check and module resolution — sufficient for Phase 2 component stubs
- No additional test infrastructure required

*Existing infrastructure covers all automated phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/admin/dashboard` redirects unauthenticated to `/login` | AUTH-01 | Browser redirect | Visit /admin/dashboard logged out, confirm redirect to /login |
| Non-admin visiting `/admin/*` redirects to `/app` | AUTH-02 | Browser redirect | Log in as non-admin, visit /admin/dashboard, confirm redirect |
| Admin visiting `/app` redirects to `/admin/dashboard` | AUTH-03 | Browser redirect | Log in as admin, visit /app, confirm forward to /admin/dashboard |
| Dark sidebar renders at #1a1f2e with teal section labels | SHELL-02 | Visual | Visit /admin/dashboard as admin, check sidebar background and label colors |
| No hydration errors in browser console | SHELL-04 | Browser DevTools | Open console on any admin page, confirm no hydration warnings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
