-- ==========================================================================
-- Migration: Add indexes + materialized views for dashboard performance
-- Date: 2026-04-03
-- Problem: dashboard_door_yearly/monthly RPC functions timed out under
--          parallel load (316K rows, full sequential scan, 15 concurrent queries)
-- Solution: Pre-aggregate into materialized views, redirect RPCs to them
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Basic indexes on door table columns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_door_ship_from_code ON door(ship_from_code);
CREATE INDEX IF NOT EXISTS idx_door_v_chanel        ON door(v_chanel);
CREATE INDEX IF NOT EXISTS idx_door_off_date        ON door(off_date);
CREATE INDEX IF NOT EXISTS idx_door_category        ON door(category);
CREATE INDEX IF NOT EXISTS idx_door_brand           ON door(brand);
CREATE INDEX IF NOT EXISTS idx_door_off_date_filters ON door(off_date, ship_from_code, category, brand, v_chanel);

-- Functional indexes for EXTRACT operations
CREATE INDEX IF NOT EXISTS idx_door_extract_year  ON door((EXTRACT(YEAR  FROM off_date)::int4));
CREATE INDEX IF NOT EXISTS idx_door_extract_month ON door((EXTRACT(YEAR  FROM off_date)::int4), (EXTRACT(MONTH FROM off_date)::int4));

-- Partial indexes for distinct lookups
CREATE INDEX IF NOT EXISTS idx_door_npp_notnull  ON door(ship_from_code, ship_from_name) WHERE ship_from_code IS NOT NULL AND ship_from_code != '';
CREATE INDEX IF NOT EXISTS idx_door_vchan_notnull ON door(v_chanel) WHERE v_chanel IS NOT NULL AND v_chanel != '';

-- ---------------------------------------------------------------------------
-- 2. Pre-aggregated materialized views (reduce 316K → ~6K rows)
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_door_agg AS
SELECT
  EXTRACT(YEAR  FROM off_date)::int4 AS yr,
  EXTRACT(MONTH FROM off_date)::int4 AS mo,
  COALESCE(ship_from_code, '') AS ship_from_code,
  COALESCE(category,        '') AS category,
  COALESCE(brand,           '') AS brand,
  COALESCE(v_chanel,        '') AS v_chanel,
  SUM(off_amt + off_tax_amt - COALESCE(off_dsc, 0))::float8 AS ban_hang
FROM door
WHERE off_date IS NOT NULL
GROUP BY yr, mo, ship_from_code, category, brand, v_chanel;

CREATE INDEX IF NOT EXISTS idx_mv_door_agg_yr    ON mv_door_agg(yr);
CREATE INDEX IF NOT EXISTS idx_mv_door_agg_yr_mo ON mv_door_agg(yr, mo);
CREATE INDEX IF NOT EXISTS idx_mv_door_agg_npp   ON mv_door_agg(ship_from_code);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dpur_agg AS
SELECT
  EXTRACT(YEAR  FROM pur_date)::int4 AS yr,
  EXTRACT(MONTH FROM pur_date)::int4 AS mo,
  COALESCE(site_code, '') AS site_code,
  COALESCE(category,  '') AS category,
  COALESCE(brand,     '') AS brand,
  SUM(
    CASE WHEN trntyp = 'I' THEN  (pr_amt + pr_tax_amt)
         WHEN trntyp = 'D' THEN -(pr_amt + pr_tax_amt)
         ELSE 0
    END
  )::float8 AS nhap_hang
FROM dpur
WHERE pur_date IS NOT NULL
GROUP BY yr, mo, site_code, category, brand;

CREATE INDEX IF NOT EXISTS idx_mv_dpur_agg_yr    ON mv_dpur_agg(yr);
CREATE INDEX IF NOT EXISTS idx_mv_dpur_agg_yr_mo ON mv_dpur_agg(yr, mo);

-- Distinct customers view for fast COUNT queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_door_customers AS
SELECT DISTINCT
  customer_key,
  COALESCE(ship_from_code, '') AS ship_from_code,
  COALESCE(category,        '') AS category,
  COALESCE(brand,           '') AS brand,
  COALESCE(v_chanel,        '') AS v_chanel
FROM door
WHERE customer_key IS NOT NULL AND customer_key != '';

CREATE INDEX IF NOT EXISTS idx_mv_door_customers_key ON mv_door_customers(customer_key);
CREATE INDEX IF NOT EXISTS idx_mv_door_customers_npp ON mv_door_customers(ship_from_code);

-- ---------------------------------------------------------------------------
-- 3. Rewrite RPC functions to query materialized views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION dashboard_door_yearly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS TABLE(yr int4, ban_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT yr, SUM(ban_hang)::float8 AS ban_hang
  FROM mv_door_agg
  WHERE (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh)
  GROUP BY yr ORDER BY yr;
$$;

CREATE OR REPLACE FUNCTION dashboard_door_monthly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS TABLE(yr int4, mo int4, ban_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT yr, mo, SUM(ban_hang)::float8 AS ban_hang
  FROM mv_door_agg
  WHERE (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh)
  GROUP BY yr, mo ORDER BY yr, mo;
$$;

CREATE OR REPLACE FUNCTION dashboard_dpur_yearly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT ''
)
RETURNS TABLE(yr int4, nhap_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT yr, SUM(nhap_hang)::float8 AS nhap_hang
  FROM mv_dpur_agg
  WHERE (p_npp = '' OR site_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
  GROUP BY yr ORDER BY yr;
$$;

CREATE OR REPLACE FUNCTION dashboard_dpur_monthly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT ''
)
RETURNS TABLE(yr int4, mo int4, nhap_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT yr, mo, SUM(nhap_hang)::float8 AS nhap_hang
  FROM mv_dpur_agg
  WHERE (p_npp = '' OR site_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
  GROUP BY yr, mo ORDER BY yr, mo;
$$;

CREATE OR REPLACE FUNCTION dashboard_total_customer_count(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS int8
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COUNT(DISTINCT customer_key)::int8
  FROM mv_door_customers
  WHERE (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh);
$$;

-- ---------------------------------------------------------------------------
-- 4. Update refresh_admin_views to include new materialized views
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_admin_views()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Refresh new aggregate matviews first
  REFRESH MATERIALIZED VIEW mv_door_agg;
  REFRESH MATERIALIZED VIEW mv_dpur_agg;
  REFRESH MATERIALIZED VIEW mv_door_customers;

  -- Refresh existing matviews (graceful fail if missing)
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_queries; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_queries;   EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;  EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$$;
