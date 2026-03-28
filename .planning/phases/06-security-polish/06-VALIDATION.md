---
phase: 6
slug: security-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists, node environment, @/ alias) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npm audit --audit-level=high`
- **Before `/gsd:verify-work`:** Full suite must be green + manual print/CSP verification
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | POL-01 | smoke | `npm list recharts react-leaflet leaflet @types/leaflet @tanstack/react-table xlsx jspdf jspdf-autotable tsx && npm audit --audit-level=high` | N/A (CLI) | pending |
| 06-01-01 | 01 | 1 | POL-04 | config | `grep -c "tile.openstreetmap.org" next.config.js` (must be >= 2 for img-src + connect-src) | N/A (config check) | pending |
| 06-01-02 | 01 | 1 | POL-02 | manual | Visual: `window.print()` preview inspection on admin pages | N/A (CSS visual) | pending |
| 06-02-01 | 02 | 1 | POL-03 | smoke | `npx next build && grep -rl "createServiceClient\|SUPABASE_SERVICE_ROLE_KEY" .next/static/chunks/ 2>/dev/null \| wc -l` (must be 0) | N/A (build check) | pending |
| 06-03-01 | 03 | 1 | POL-05 | unit | `npx vitest run tests/pdf-vietnamese.test.ts` | No — Wave 0 | pending |
| 06-04-01 | 04 | 1 | POL-06 | unit | `grep -r "VI\." components/admin/ app/admin/ --include="*.tsx" \| wc -l` (must be > 0) | N/A (grep check) | pending |
| 06-05-01 | 05 | 1 | Seed expansion | smoke | `test -f data/seeds/profiles.ts && grep -q "generateProfiles" data/seeds/profiles.ts` | N/A (file check) | pending |
| 06-06-01 | 06 | 2 | Seed expansion | smoke | `grep -q "generateProfiles" scripts/seed.ts && grep -q "batchInsert" scripts/seed.ts` | N/A (file check) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/pdf-vietnamese.test.ts` — verify jsPDF + Roboto font renders Vietnamese characters (POL-05)
- [ ] `tests/bundle-security.test.ts` — verify createServiceClient not in client chunks (POL-03)
- [ ] `tests/csp-config.test.ts` — verify next.config.js CSP includes tile.openstreetmap.org in both img-src and connect-src (POL-04)
- [ ] `tests/packages.test.ts` — verify all 9 required packages at expected versions (POL-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Print CSS hides sidebar | POL-02 | Visual rendering requires browser print preview | 1. Navigate to `/admin/check-users`. 2. Press Ctrl+P or call `window.print()`. 3. Verify sidebar and topbar are hidden. 4. Verify table renders full-width with white background. |
| CSP allows Leaflet tiles | POL-04 | Requires browser console inspection | 1. Navigate to `/admin/dashboard` or `/admin/check-users`. 2. Open browser DevTools Console. 3. Verify no "Refused to load image" or "Refused to connect" CSP errors. 4. Verify map tiles load correctly. |
| Vietnamese diacritics in PDF | POL-05 | Requires visual PDF inspection | 1. Navigate to `/admin/check-users`. 2. Click PDF export button. 3. Open generated PDF. 4. Verify Vietnamese names (e.g., "Nguyen Thi Hoa", "Ha Noi") render with correct diacritics. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
