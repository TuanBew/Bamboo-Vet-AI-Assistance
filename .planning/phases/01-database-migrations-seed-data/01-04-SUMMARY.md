---
phase: "01"
plan: "04"
subsystem: database-seed-data
tags: [seed, inventory, customers, purchases, migrations]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [sales-data, inventory-data, customer-data]
  affects: [ton-kho, khach-hang, check-customers, check-distributor]
tech_stack:
  added: []
  patterns: [batch-insert, deterministic-hash, seasonal-patterns]
key_files:
  created:
    - scripts/seed-sales.ts
  modified: []
decisions:
  - "Used Management API for migration application since supabase db push had migration history conflicts"
  - "Seeded 90 products (original 62 + 28 expanded categories) exceeding 65 target"
  - "Daily inventory snapshots (73,710 rows) instead of weekly for richer time-series data"
  - "Customers assigned to 10 suppliers via round-robin for even distribution"
metrics:
  duration_seconds: 470
  completed: "2026-03-29T10:26:28Z"
  tasks_completed: 5
  files_created: 1
---

# Phase 01 Plan 04: Comprehensive Sales Seed Data (2024-2026) Summary

90 products, 450 geo-located customers with supplier linkage, 73K daily inventory snapshots, and 2.2K seasonal customer purchases seeded via standalone script using Supabase service role client.

## What Was Done

### Task 1: Apply Pending Migrations
- Applied migrations 008 (inventory_snapshots, customers, customer_purchases), 009 (display_programs, distributor_staff, customer/supplier alterations), and 010 (custom access token hook) via Supabase Management API
- Added `supplier_id` column to customers table with FK to suppliers
- Repaired migration history conflict (orphan remote migration 20260319134403 marked as reverted)

### Task 2: Upsert Products and Suppliers
- Upserted all 10 suppliers with region/zone metadata
- Upserted all 90 products from data/seeds/products.ts (62 original + 28 expanded: antibiotics, vitamins, vaccines, hormones, antiparasitics)

### Task 3: Generate 450 Customers
- 450 customers with Vietnamese business names and weighted geographic distribution
- Type distribution: TH 126 (28%), GSO 153 (34%), PHA 63 (14%), SPS 54 (12%), BTS 40 (9%), OTHER/PLT/WMO 14 (3%)
- 295 customers (65%) with latitude/longitude coordinates per province
- All 450 assigned to one of 10 suppliers via supplier_id
- Address, street, ward fields populated for all customers
- created_at spread from Jan 2024 to Mar 2026

### Task 4: Generate Inventory Snapshots
- 73,710 daily inventory snapshot rows (90 products x 818 days)
- Date range: Jan 1, 2024 to Mar 29, 2026
- Seasonal patterns: Q1 UP (replenishment), Q2 stable, Q3 DOWN (disease season), Q4 mixed with Dec replenishment
- Quantity floor: 5 units, ceiling: 1000 units
- Unit price has quarterly variation (+-5%)

### Task 5: Generate Customer Purchases
- 2,198 purchase transactions across 27 months
- Seasonal multipliers: Jan 1.4x (Tet), Feb 0.8x, Jul-Aug 1.3x (disease), Dec 1.5x
- 428 customers with total purchases > 300,000 VND (exceeds 30 minimum)
- Product weighting: 60% of purchases from top 30 products
- Customer weighting: 40% of purchases from top 20% customers (high-value)

### Verification
- Materialized views refreshed successfully (1,118ms)
- Inventory data varies by date (Jun 2024: 45,676 units, Jan 2025: 8,098, Mar 2026: 15,438)
- Monthly purchase volume follows seasonal pattern (Jan: 98, Feb: 56, Jul: 91, Dec not yet shown)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration history conflict with supabase db push**
- **Found during:** Task 1
- **Issue:** Remote had orphan migration 20260319134403 not in local directory; also all local migrations were untracked in remote history
- **Fix:** Repaired orphan migration, used Management API to execute SQL directly instead of supabase db push
- **Commit:** N/A (runtime fix)

**2. [Rule 2 - Missing functionality] Products count was 62, but PRODUCTS array has 90**
- **Found during:** Task 2
- **Issue:** The plan referenced 65 products from PDF, but data/seeds/products.ts contains 90 products (original 62 + 28 expanded categories added in Phase 06)
- **Fix:** Upserted all 90 products instead of just 65, providing richer data variety
- **Impact:** Inventory snapshots and purchases span all 90 products

## Success Criteria Check

- [x] All products exist in database (90, exceeds 65 target)
- [x] inventory_snapshots has 73,710 rows (exceeds 50,000 target)
- [x] customers table has 450 rows (exceeds 400 target)
- [x] customer_purchases has 2,198 rows (exceeds 1,000 target)
- [x] 428 high-value customers > 300K VND (exceeds 30 target)
- [x] 295 customers geo-located with lat/lon
- [x] All 450 customers linked to suppliers
- [x] Materialized views refreshed
- [x] Inventory totals differ across dates (seasonal variation confirmed)
- [ ] Playwright screenshots not captured (no Playwright config; verified via SQL queries)

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1-5 | Seed all sales data | e076db1d |
