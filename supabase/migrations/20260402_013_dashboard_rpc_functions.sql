-- ==========================================================================
-- Migration: Add dashboard RPC functions for server-side aggregation
-- Date: 2026-04-02
-- Purpose: Replace JS in-memory aggregation (limited to 1000 rows) with
--          proper SQL GROUP BY queries executed on the database.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Yearly sales aggregates (door table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_door_yearly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS TABLE(yr int4, ban_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    year AS yr,
    SUM(off_amt + off_tax_amt - COALESCE(off_dsc, 0))::float8 AS ban_hang
  FROM door
  WHERE (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh)
  GROUP BY year
  ORDER BY year;
$$;

-- ---------------------------------------------------------------------------
-- 2. Monthly sales aggregates (door table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_door_monthly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS TABLE(yr int4, mo int4, ban_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXTRACT(YEAR FROM off_date)::int4  AS yr,
    EXTRACT(MONTH FROM off_date)::int4 AS mo,
    SUM(off_amt + off_tax_amt - COALESCE(off_dsc, 0))::float8 AS ban_hang
  FROM door
  WHERE off_date IS NOT NULL
    AND (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh)
  GROUP BY yr, mo
  ORDER BY yr, mo;
$$;

-- ---------------------------------------------------------------------------
-- 3. Yearly purchase aggregates (dpur table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_dpur_yearly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT ''
)
RETURNS TABLE(yr int4, nhap_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    year AS yr,
    SUM(
      CASE WHEN trntyp = 'I' THEN  (pr_amt + pr_tax_amt)
           WHEN trntyp = 'D' THEN -(pr_amt + pr_tax_amt)
           ELSE 0
      END
    )::float8 AS nhap_hang
  FROM dpur
  WHERE (p_npp = '' OR site_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
  GROUP BY year
  ORDER BY year;
$$;

-- ---------------------------------------------------------------------------
-- 4. Monthly purchase aggregates (dpur table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_dpur_monthly(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT ''
)
RETURNS TABLE(yr int4, mo int4, nhap_hang float8)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXTRACT(YEAR FROM pur_date)::int4  AS yr,
    EXTRACT(MONTH FROM pur_date)::int4 AS mo,
    SUM(
      CASE WHEN trntyp = 'I' THEN  (pr_amt + pr_tax_amt)
           WHEN trntyp = 'D' THEN -(pr_amt + pr_tax_amt)
           ELSE 0
      END
    )::float8 AS nhap_hang
  FROM dpur
  WHERE pur_date IS NOT NULL
    AND (p_npp = '' OR site_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
  GROUP BY yr, mo
  ORDER BY yr, mo;
$$;

-- ---------------------------------------------------------------------------
-- 5. Filter options (distinct NPP, category, brand values)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_npp_list()
RETURNS TABLE(ship_from_code text, ship_from_name text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT DISTINCT ship_from_code, ship_from_name
  FROM door
  WHERE ship_from_code IS NOT NULL AND ship_from_code <> ''
  ORDER BY ship_from_name;
$$;

CREATE OR REPLACE FUNCTION dashboard_categories()
RETURNS TABLE(category text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT DISTINCT category
  FROM door
  WHERE category IS NOT NULL AND category <> ''
  ORDER BY category;
$$;

CREATE OR REPLACE FUNCTION dashboard_brands()
RETURNS TABLE(brand text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT DISTINCT brand
  FROM door
  WHERE brand IS NOT NULL AND brand <> ''
  ORDER BY brand;
$$;

-- ---------------------------------------------------------------------------
-- 6. Customers with lat/long (for map pins — distinct per customer_key)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_customers_with_location(
  p_npp  text DEFAULT '',
  p_kenh text DEFAULT ''
)
RETURNS TABLE(
  customer_key  text,
  customer_name text,
  type_name     text,
  lat           float8,
  long          float8
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT DISTINCT ON (customer_key)
    customer_key,
    customer_name,
    type_name,
    lat,
    long
  FROM door
  WHERE lat IS NOT NULL AND long IS NOT NULL
    AND (p_npp = '' OR ship_from_code = p_npp)
    AND (p_kenh = '' OR v_chanel = p_kenh)
  ORDER BY customer_key;
$$;

-- ---------------------------------------------------------------------------
-- 7. Total distinct customer count (all-time)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dashboard_total_customer_count(
  p_npp         text DEFAULT '',
  p_nganh       text DEFAULT '',
  p_thuong_hieu text DEFAULT '',
  p_kenh        text DEFAULT ''
)
RETURNS int8
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COUNT(DISTINCT customer_key)
  FROM door
  WHERE (p_npp = '' OR ship_from_code = p_npp)
    AND (p_nganh = '' OR category = p_nganh)
    AND (p_thuong_hieu = '' OR brand = p_thuong_hieu)
    AND (p_kenh = '' OR v_chanel = p_kenh);
$$;
