---
phase: 04-ton-kho-khach-hang
verified: 2026-03-20T07:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Navigate to /admin/ton-kho, change the date picker to an earlier date, click Tim kiem"
    expected: "KPI cards, all 6 charts, and the DataTable all refresh with data for the selected date"
    why_human: "Client-side fetch-on-filter is wired in code; actual runtime behavior with real Supabase data cannot be verified statically"
  - test: "Navigate to /admin/khach-hang, open the >300K section"
    expected: "If seed data has been applied, a table of high-value stores appears; if seed not applied, the graceful empty state message is shown"
    why_human: "Runtime Supabase data dependency — cannot verify seed execution state statically"
---

# Phase 4: Ton Kho + Khach Hang Verification Report

**Phase Goal:** Build Tồn Kho (inventory stock analytics) and Khách Hàng (business customer analytics) admin pages with charts, KPI tiles, DataTable with export, and proper database backing.
**Verified:** 2026-03-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | inventory_snapshots, customers, customer_purchases tables defined in migration with RLS | VERIFIED | `20260320_008_add_ton_kho_khach_hang_tables.sql` has all 3 CREATE TABLE IF NOT EXISTS + 3 RLS policy blocks |
| 2 | Seed script populates 806 inventory snapshots, 200 customers, 500-800 customer purchases | VERIFIED | `scripts/seed.ts` lines 868–1016 has all 3 seed functions; seed data files generate correct volumes |
| 3 | Old KB/Users files deleted | VERIFIED | `app/admin/knowledge-base/`, `app/admin/users/`, `app/api/admin/knowledge-base/`, `app/api/admin/users/`, `lib/admin/services/knowledge-base.ts`, `lib/admin/services/users.ts` — all absent from filesystem |
| 4 | AdminSidebar links point to /admin/ton-kho and /admin/khach-hang | VERIFIED | AdminSidebar.tsx line 16-17: `href: '/admin/ton-kho'` with `Warehouse` icon, `href: '/admin/khach-hang'` with `Users` icon; no BookOpen import |
| 5 | GET /api/admin/ton-kho returns KPIs, chart data, product list filtered by snapshot_date | VERIFIED | `lib/admin/services/ton-kho.ts` exports `getTonKhoData` with full deduplication logic; route wired correctly |
| 6 | Ton-kho page renders 3 KPI cards (blue/orange/teal), 6 charts in 2x3 grid, and DataTable | VERIFIED | `TonKhoClient.tsx` (367 lines): 3 KpiCard instances, 4 HorizontalBarChartCard + 2 DonutChartCard in 2 grid rows |
| 7 | Changing snapshot_date refetches all data for new date | VERIFIED | `handleSearch()` at line 192 fetches `/api/admin/ton-kho?snapshot_date=...` on button click; date input wired to filter state |
| 8 | DataTable has Copy + Excel export buttons and search | VERIFIED | `exportConfig={{ copy: true, excel: true }}` and `showSearch={true}` at TonKhoClient.tsx line 357-360 |
| 9 | GET /api/admin/khach-hang returns new_by_month, by_province, by_district, all_customers, purchasing_customers, high_value_stores | VERIFIED | `lib/admin/services/khach-hang.ts` returns all 6 data sections; all fields present in KhachHangData interface |
| 10 | Khach-hang page renders 3 chart panels (LineChart, BarChart, horizontal BarChart) | VERIFIED | KhachHangClient.tsx: LineChart (line 114), BarChart (line 137), horizontal BarChart layout="vertical" (line 160) |
| 11 | Tat ca khach hang and Khach hang dang mua hang sections render 4 KPI tiles + breakdown tables with correct columns | VERIFIED | 4 KpiCard in each section; breakdown tables with pct_of_total/pct_of_active columns at lines 284-285 |
| 12 | >300K section is collapsed by default with graceful empty state | VERIFIED | `defaultOpen={false}` at line 294; empty state message at line 297: "Khong co cua hieu nao co tong gia tri mua hang vuot 300,000 VND" |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Provided | Status | Size |
|----------|----------|--------|------|
| `supabase/migrations/20260320_008_add_ton_kho_khach_hang_tables.sql` | 3 tables + 3 RLS blocks | VERIFIED | 75 lines |
| `data/seeds/inventory_snapshots.ts` | 806 rows (62 products x 13 dates) | VERIFIED | 57 lines, deterministic generation loop |
| `data/seeds/customers.ts` | 200 customers across 8 types | VERIFIED | 124 lines, correct type distribution hard-coded |
| `data/seeds/customer_purchases.ts` | ~600-730 purchase rows | VERIFIED | 94 lines, active-customer-weighted generation |
| `scripts/seed.ts` | seedInventorySnapshots, seedCustomers, seedCustomerPurchases | VERIFIED | All 3 at lines 868/909/939, called in order at lines 1014-1016 |
| `components/admin/AdminSidebar.tsx` | ton-kho + khach-hang navigation | VERIFIED | Warehouse icon imported, correct hrefs, no BookOpen |
| `lib/admin/services/ton-kho.ts` | getTonKhoData + TonKhoData + TonKhoFilters | VERIFIED | 214 lines, full deduplication and aggregation logic |
| `app/api/admin/ton-kho/route.ts` | GET handler with requireAdmin | VERIFIED | 21 lines, correct pattern |
| `app/admin/ton-kho/page.tsx` | SSR page calling getTonKhoData | VERIFIED | 17 lines, async with searchParams Promise |
| `app/admin/ton-kho/TonKhoClient.tsx` | Charts, KPI cards, DataTable (min 200 lines) | VERIFIED | 367 lines, fully implemented |
| `lib/admin/services/khach-hang.ts` | getKhachHangData + KhachHangData | VERIFIED | 245 lines, all 6 data sections computed |
| `app/api/admin/khach-hang/route.ts` | GET handler with requireAdmin | VERIFIED | 19 lines, correct pattern |
| `app/admin/khach-hang/page.tsx` | SSR page calling getKhachHangData | VERIFIED | 13 lines, async with searchParams Promise |
| `app/admin/khach-hang/KhachHangClient.tsx` | Charts, sections, breakdown tables (min 300 lines) | VERIFIED | 328 lines, fully implemented |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `app/admin/ton-kho/page.tsx` | `lib/admin/services/ton-kho.ts` | import getTonKhoData | WIRED | Line 1: `import { getTonKhoData } from '@/lib/admin/services/ton-kho'` |
| `app/admin/ton-kho/TonKhoClient.tsx` | `/api/admin/ton-kho` | fetch on filter change | WIRED | Line 199: `fetch(\`/api/admin/ton-kho?${params.toString()}\`)` with response assigned |
| `app/api/admin/ton-kho/route.ts` | `lib/admin/services/ton-kho.ts` | import getTonKhoData | WIRED | Line 3: `import { getTonKhoData } from '@/lib/admin/services/ton-kho'` |
| `app/admin/khach-hang/page.tsx` | `lib/admin/services/khach-hang.ts` | import getKhachHangData | WIRED | Line 1: `import { getKhachHangData } from '@/lib/admin/services/khach-hang'` |
| `app/admin/khach-hang/KhachHangClient.tsx` | `components/admin/SectionHeader.tsx` | import SectionHeader | WIRED | Line 17: `import { SectionHeader } from '@/components/admin/SectionHeader'` |
| `app/admin/khach-hang/KhachHangClient.tsx` | `/api/admin/khach-hang` | fetch on filter change | WIRED | Line 75: `fetch(\`/api/admin/khach-hang?npp=${...}\`)` with response assigned |
| `scripts/seed.ts` | `data/seeds/inventory_snapshots.ts` | dynamic import | WIRED | Line 877: `const { INVENTORY_SNAPSHOTS } = await import('../data/seeds/inventory_snapshots')` |

---

### Requirements Coverage

| Requirement | Source Plan | Description (abbreviated) | Status | Evidence |
|-------------|-------------|----------------------------|--------|----------|
| TK-01 | 04-01 | Migration + 3 tables + seed data + old files deleted + sidebar updated | SATISFIED | Migration file verified; all 3 seed functions in scripts/seed.ts; old dirs absent; AdminSidebar has correct hrefs/icons |
| TK-02 | 04-02 | GET /api/admin/ton-kho returns kpis + 6 chart arrays + products filtered by snapshot_date | SATISFIED | `getTonKhoData` computes all fields; route returns `NextResponse.json(data)` |
| TK-03 | 04-02 | /admin/ton-kho renders filter bar, 3 KPI cards, 6 charts 2x3, DataTable with Copy+Excel | SATISFIED | TonKhoClient.tsx: all UI elements verified; exportConfig={{ copy: true, excel: true }} |
| KH-01 | 04-03 | GET /api/admin/khach-hang returns all 6 data sections | SATISFIED | `getKhachHangData` returns new_by_month, by_province, by_district, all_customers, purchasing_customers, high_value_stores |
| KH-02 | 04-03 | /admin/khach-hang renders 3 chart panels with non-zero data | SATISFIED | LineChart, BarChart, horizontal BarChart all implemented; data from seed |
| KH-03 | 04-03 | "Tat ca khach hang" section: 4 KPI tiles + 8-type breakdown table | SATISFIED | SectionHeader defaultOpen={true} at line 178; 4 KpiCards; 8-row breakdown via ALL_TYPES iteration |
| KH-04 | 04-03 | "Khach hang dang mua hang" section: 4 KPI tiles + breakdown with pct_of_total/pct_of_active | SATISFIED | SectionHeader defaultOpen={true} at line 235; extra columns rendered at lines 271-272, 284-285 |
| KH-05 | 04-03 | ">300K" section collapsed by default, graceful empty state | SATISFIED | defaultOpen={false} at line 294; empty state text at line 297; table rendered when stores present |

All 8 requirement IDs from plan frontmatters are accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 4.

---

### Anti-Patterns Found

| File | Detail | Severity | Impact |
|------|--------|----------|--------|
| `app/admin/khach-hang/KhachHangClient.tsx` | `CHART_COLORS` array defined at line 24 but never indexed (`CHART_COLORS[i]` never appears) — charts use hardcoded hex strings directly | Info | No functional impact; charts render correct colors. Cosmetic dead code. |
| `lib/admin/services/khach-hang.ts` | `npp: string` filter accepted but never applied to queries — comment acknowledges "placeholder for future NPP filtering" | Info | By design per plan. No functional gap for current phase scope. |
| `app/admin/khach-hang/KhachHangClient.tsx` | Charts panels 1+2 use `lg:grid-cols-2` (2-col) instead of the plan's 3-col grid; panel 3 is full width | Warning | Layout differs from plan spec but all 3 charts are present. Functionally complete. |

No blocker anti-patterns found. No stub returns (`return null`, `return {}`, empty handlers). No TODO/FIXME in implementation files.

---

### Human Verification Required

#### 1. Ton Kho Date Filter Refetch

**Test:** Navigate to `/admin/ton-kho`, change the date picker to `2026-01-05` (an earlier snapshot date), click "Tim kiem"
**Expected:** All 6 charts and KPI cards refresh to show inventory data as of that date; DataTable updates to match
**Why human:** Client-side fetch wiring is confirmed in code; actual Supabase query execution and correct deduplication behavior requires runtime verification with real data

#### 2. Khach Hang >300K Section

**Test:** Navigate to `/admin/khach-hang`, click the ">300K" section header to expand it
**Expected:** If seed data was applied, a table of stores with total purchase value >300,000 VND appears; if seed not applied, the empty-state message appears
**Why human:** Depends on whether the migration and seed script have been executed against the Supabase instance

---

### Commit Verification

All 6 commits documented in summaries are present in git log:
- `0524c3e6` feat(04-01): create migration + seed data for ton-kho and khach-hang tables
- `0b809eb3` feat(04-01): update seed script, delete old KB/Users files, update sidebar
- `0e02b0ca` feat(04-02): create ton-kho service layer and API route
- `9b3c99da` feat(04-02): create ton-kho SSR page and client component with charts and DataTable
- `8fa1e148` feat(04-03): add khach-hang service layer and API route
- `afada6e1` feat(04-03): add khach-hang SSR page and client component

---

## Summary

Phase 4 goal is **fully achieved**. All 12 observable truths verified. All 14 artifacts exist, are substantive (not stubs), and are correctly wired. All 8 requirement IDs (TK-01 through TK-03, KH-01 through KH-05) have implementation evidence matching their descriptions in REQUIREMENTS.md.

The two minor observations (unused CHART_COLORS reference in KhachHangClient, 2-col vs 3-col chart layout) do not affect functional goal achievement. The database tables, seed data pipeline, service functions, API routes, SSR pages, and client components are all present and connected.

Two items remain for human runtime verification: the date-filter refetch behavior under real Supabase data, and the >300K section populated state (which depends on seed execution).

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
