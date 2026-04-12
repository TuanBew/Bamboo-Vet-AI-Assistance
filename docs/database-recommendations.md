# Database Performance Recommendations

> **Status**: Advisory only — requires DBA review and approval before execution.
> **Database constraint**: Production database is READ-ONLY from the application layer. These recommendations must be executed directly by a DBA.

## Context

These recommendations would further improve dashboard performance beyond the application-level optimizations already implemented. They are listed in priority order by expected impact.

## Recommendations

### 1. New RPC: `get_dashboard_kpis(npp, month, year)`

**Expected impact**: Eliminate the `monthDoorFetch` raw row scan entirely (~50k rows → 1 row)

**What**: A stored procedure returning pre-aggregated KPI values (nhap_hang, ban_hang, customers_active, customers_total, sku_sold, sku_total, nhan_vien) for a given NPP/month/year combination.

### 2. New RPC: `get_dashboard_staff_breakdown(npp, month, year)`

**Expected impact**: Eliminate JS-side O(n×m) staff aggregation (currently ~100k rows × staff count)

**What**: Returns per-staff aggregated metrics including total_sales, order_count, avg_per_order, customer_count, days_over_1m, and daily_sparkline array.

### 3. New RPC: `get_dashboard_top10(npp, month, year)`

**Expected impact**: Eliminate JS-side sorting across all customers/products

**What**: Returns top 10 customers and top 10 products by revenue, pre-sorted by the database.

### 4. New RPC: `get_dashboard_pie_charts(npp, month, year)`

**Expected impact**: Eliminate JS-side aggregation for 6 pie/donut chart datasets

**What**: Returns pre-aggregated by_nganh, by_nhom, by_thuong_hieu breakdowns for both nhap_hang and ban_hang.

### 5. Index on `door(saleperson_key, tran_date)`

**Expected impact**: Accelerates all staff-breakdown RPCs (composite index for the primary join pattern)

**SQL**:
```sql
CREATE INDEX CONCURRENTLY idx_door_saleperson_date ON door(saleperson_key, tran_date);
```

### 6. Index on `door(dprogram_id, tran_date)`

**Expected impact**: Accelerates revenue exclusion filter (promotions/free goods filter)

**SQL**:
```sql
CREATE INDEX CONCURRENTLY idx_door_dprogram_date ON door(dprogram_id, tran_date);
```

### 7. Materialized view: `mv_npp_options`

**Expected impact**: Eliminates the `dpur` full-table scan for NPP dropdown (currently ~1000+ rows, runs every 24 hours even with caching)

**SQL**:
```sql
CREATE MATERIALIZED VIEW mv_npp_options AS
SELECT DISTINCT ON (site_code) site_code, site_name
FROM dpur
ORDER BY site_code, site_name;
```

**Refresh**: Via the existing `refresh_admin_views` RPC.

### 8. Geo denormalization in `dpur`

**Expected impact**: Eliminates the `matchGeo()` fuzzy string matching algorithm

**What**: Add `region`, `area`, `dist_province` columns to the `door` table (denormalized from `dpur`) so distributor geo can be looked up by `ship_from_code` without fuzzy matching.

## Priority Order for Implementation

| Priority | Recommendation | Estimated Impact | Complexity |
|----------|---------------|-----------------|-----------|
| 1 | Indexes on `door` table | High | Low (no app changes) |
| 2 | `get_dashboard_kpis` RPC | Very High | Medium |
| 3 | `get_dashboard_staff_breakdown` RPC | High | Medium |
| 4 | Materialized view `mv_npp_options` | Medium | Low |
| 5 | `get_dashboard_top10` RPC | Medium | Low |
| 6 | `get_dashboard_pie_charts` RPC | Medium | Low |
| 7 | Geo denormalization | Medium | High (data migration) |

## Notes

- All RPCs should be created in the `public` schema and granted to the service role used by the application.
- Indexes should be created with `CONCURRENTLY` to avoid table locks on a live database.
- The application already has `unstable_cache` wrappers with 1-hour TTL on all data-fetching functions. Adding these RPCs would allow the cached functions to do DB-side aggregation instead of JS-side, making the cold-cache first load also fast.

---
*Document prepared: 2026-04-12 | Performance Overhaul Phase 7*
