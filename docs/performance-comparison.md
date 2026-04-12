# Performance Overhaul — Before/After Comparison

**Date**: 2026-04-12
**Branch**: `perf/dashboard-overhaul`
**Status**: Implementation complete — E2E metrics to be captured after deployment

---

## Summary of Changes

| Batch | Change | Expected Impact |
|-------|--------|----------------|
| Batch 0 | Playwright test infrastructure | Enables future E2E benchmarking |
| Batch 1 | Root middleware.ts — edge-level auth guard | -0ms (correctness fix, no perf cost) |
| Batch 1 | requireAdmin() JWT optimization | -150–400ms per API request |
| Batch 2 | unstable_cache on all 7 service functions | Repeat loads: 2–10s → <200ms |
| Batch 2 | Cache invalidation on MV refresh | Stale data prevention |
| Batch 3 | jsonWithCache() on all 6 API routes | 304 Not Modified on repeat filter changes |
| Batch 4 | Dashboard fast/slow data split | KPIs render in <1500ms (not waiting for staff table) |
| Batch 4 | Progressive slow data via useEffect | Staff table loads progressively, doesn't block KPIs |
| Batch 5 | Delete dead code | Build cleanliness |
| Batch 6 | SparklineChart SVG (replaces Recharts) | Staff table render: eliminates 20+ Recharts trees |
| Batch 6 | Leaflet icon memoization | Map re-render: O(n_pins) → O(n_types) icon creation |

---

## Auth Performance

### Before
- requireAdmin(): 2 sequential network calls
  - getUser() → Supabase JWT verification: ~100ms
  - profiles DB query → is_admin check: ~100–200ms
  - Total: ~200–400ms overhead per API request

### After
- requireAdmin(): 1 network call
  - getUser() → Supabase JWT verification + reads app_metadata.is_admin from JWT: ~100ms
  - Total: ~100ms overhead per API request
- Savings: ~100–300ms per API call across all 11 admin endpoints

---

## Dashboard Cold Load

### Before
- Single getDashboardData() fetch: up to 40 seconds
- All 14 queries (including 4×50k row fetches) must complete before ANY content renders
- Zero caching — every page visit pays full cost
- No middleware — unauthenticated requests reach React components

### After
- Fast data (RPC-only): renders in ~500–1500ms (KPIs, bar charts, area chart visible)
- Slow data (progressive): staff table and top-10 appear 2–10s after KPIs
- Cached repeat loads: <200ms for any page
- Edge middleware: unauthenticated users rejected before React executes

---

## Caching Architecture

### Before
- Zero server-side caching
- Zero HTTP caching
- Every filter change = full database cost

### After
- unstable_cache with 1h TTL on all 7 page-level service functions
- unstable_cache with 24h TTL on NPP options + geo lookup (reference data)
- HTTP ETag + Cache-Control: private, max-age=3600 on all 6 API responses
- Cache invalidation on materialized view refresh via revalidateTag()

---

## Frontend Render Performance

### Before
- SparklineChart: full Recharts LineChart per staff row (20–80 staff rows = 20–80 Recharts trees)
- Leaflet map: L.divIcon() called per pin per render = O(n_pins) icon creation

### After
- SparklineChart: pure SVG polyline — zero Recharts overhead
- Leaflet map: L.divIcon() called once per customer type = O(n_types) ≤ 13 icon creation per render

---

## Security Improvements

| Protection | Before | After |
|-----------|--------|-------|
| /admin/* page routes | No middleware — publicly accessible | Edge middleware rejects before React |
| /api/admin/* routes | requireAdmin() guard only | Edge middleware + requireAdmin() double guard |
| JWT verification | getUser() ✓ | getUser() ✓ (preserved) |
| app_metadata integrity | DB cross-check | JWT claim only (getUser() still verifies signature) |

---

## Test Coverage Added

- `lib/admin/__tests__/auth.test.ts` — 4 unit tests for requireAdmin() JWT optimization
- `components/admin/__tests__/sparkline.test.ts` — 5 unit tests for computePolylinePoints()
- `tests/performance/global-setup.ts` — Playwright auth setup
- `tests/performance/baseline.spec.ts` — 6 baseline metric capture tests
- `tests/performance/perf.spec.ts` — 13 performance regression threshold tests

**Total unit tests**: 21 (was 12)
**Total Playwright tests**: 19 (was 0)

---

## To Capture Actual Metrics

Run after deployment with admin credentials:
```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... npm run test:e2e
cat docs/performance-baseline.json
```

---

## Database Recommendations (Not Implemented)

See `docs/database-recommendations.md` for DBA-action items that would further improve cold-cache performance by moving JS-side aggregation into database-side RPCs.
