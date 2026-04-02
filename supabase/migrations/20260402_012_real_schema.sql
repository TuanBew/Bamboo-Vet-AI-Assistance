-- ==========================================================================
-- Migration: Replace fake domain tables with real MySQL-mirrored flat tables
-- Date: 2026-04-02
-- Drops: customer_purchases, distributor_staff, distributors, check_customers,
--        inventory_snapshots, customers, products, purchase_items, purchases,
--        display_programs, purchase_order_items, purchase_orders, suppliers
-- Creates: door, dpur, inloc, product, arsalesp
-- Keeps: clinics, profiles, query_events, kb_documents (chatbot tables)
-- ==========================================================================

-- ==========================================================================
-- SECTION 1: DROP FAKE DOMAIN TABLES (dependency order: children first)
-- ==========================================================================

DROP TABLE IF EXISTS customer_purchases CASCADE;
DROP TABLE IF EXISTS distributor_staff CASCADE;
DROP TABLE IF EXISTS display_programs CASCADE;
DROP TABLE IF EXISTS inventory_snapshots CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- ==========================================================================
-- SECTION 2: CREATE REAL FLAT TABLES (mirroring production MySQL structure)
-- ==========================================================================

-- door: sales transactions (flat/denormalized, one row per line item)
CREATE TABLE IF NOT EXISTS door (
  id                BIGSERIAL PRIMARY KEY,
  v_chanel          VARCHAR(50),
  system_type       VARCHAR(200),
  region            VARCHAR(100),
  area              VARCHAR(100),
  site_code         VARCHAR(50),
  site_name         VARCHAR(200),
  ss_code           VARCHAR(15),
  ss_name           VARCHAR(50),
  saleperson_key    VARCHAR(20),
  saleperson_name   VARCHAR(50),
  customer_key      VARCHAR(151),
  sku_code          VARCHAR(50),
  sku_name          VARCHAR(250),
  cust_class_key    VARCHAR(100),
  off_date          DATE,
  off_qty           DOUBLE PRECISION,
  off_amt           DOUBLE PRECISION,
  off_dsc           DOUBLE PRECISION,
  off_tax_amt       DOUBLE PRECISION,
  price             DOUBLE PRECISION,
  program_id        VARCHAR(50),
  category          VARCHAR(100),
  brand             VARCHAR(150),
  product           VARCHAR(150),
  type_name         VARCHAR(100),
  customer_name     VARCHAR(250),
  address           VARCHAR(250),
  town_name         VARCHAR(100),
  province_name     VARCHAR(100),
  dist_province     VARCHAR(100),
  lat               DOUBLE PRECISION,
  long              DOUBLE PRECISION,
  ship_from_code    VARCHAR(100),
  ship_from_name    VARCHAR(100),
  cust_class_name   VARCHAR(100),
  group_customer    VARCHAR(100),
  shop_online       BOOLEAN,
  none_incentive    VARCHAR(100),
  import_time       VARCHAR(100),
  year              INT
);

-- dpur: purchases/receiving (flat/denormalized)
CREATE TABLE IF NOT EXISTS dpur (
  id            BIGSERIAL PRIMARY KEY,
  system_type   VARCHAR(50),
  region        VARCHAR(250),
  area          VARCHAR(150),
  site_code     VARCHAR(50),
  site_name     VARCHAR(250),
  dist_province VARCHAR(100),
  docno         VARCHAR(50),
  whse_code     VARCHAR(20),
  vendor_key    VARCHAR(10),
  sku_code      VARCHAR(20),
  sku_name      VARCHAR(250),
  pur_date      DATE,
  ship_date     DATE,
  seri          VARCHAR(50),
  invno         VARCHAR(50),
  trntyp        VARCHAR(1),
  v_chanel      VARCHAR(100),
  pr_qty        DOUBLE PRECISION,
  pr_amt        DOUBLE PRECISION,
  pr_tax_amt    DOUBLE PRECISION,
  program_id    VARCHAR(50),
  category      VARCHAR(100),
  brand         VARCHAR(100),
  product       VARCHAR(100),
  import_time   VARCHAR(100),
  year          INT
);

-- inloc: inventory on-hand snapshots (flat/denormalized)
CREATE TABLE IF NOT EXISTS inloc (
  id               BIGSERIAL PRIMARY KEY,
  region           VARCHAR(250),
  system_type      VARCHAR(50),
  area             VARCHAR(150),
  province_name    VARCHAR(50),
  site_code        VARCHAR(50),
  site_name        VARCHAR(250),
  dist_province    VARCHAR(100),
  ship_from_code   VARCHAR(50),
  ship_from_name   VARCHAR(250),
  whse_code        VARCHAR(15),
  whse_name        VARCHAR(50),
  inv_date         DATE,
  onhand_qty       DOUBLE PRECISION,
  category         VARCHAR(150),
  brand            VARCHAR(200),
  product          VARCHAR(150),
  sku_code         VARCHAR(50),
  sku_name         VARCHAR(255),
  import_time      TIMESTAMPTZ,
  year             INT
);

-- product: product master data
CREATE TABLE IF NOT EXISTS product (
  site_code          VARCHAR(150) NOT NULL,
  sku_code           VARCHAR(50)  NOT NULL,
  sku_name           VARCHAR(255) NOT NULL,
  price              DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_cost          DOUBLE PRECISION NOT NULL DEFAULT 0,
  purchconvfctr      FLOAT        NOT NULL DEFAULT 0,
  category           VARCHAR(150) NOT NULL DEFAULT '',
  brand              VARCHAR(150) NOT NULL DEFAULT '',
  product            VARCHAR(150) NOT NULL DEFAULT '',
  is_lot_date_manager SMALLINT   NOT NULL DEFAULT 0,
  tax_key            VARCHAR(10)  NOT NULL DEFAULT '',
  convert_desc       VARCHAR(50)  NOT NULL DEFAULT '',
  case_desc          VARCHAR(50)  NOT NULL DEFAULT '',
  PRIMARY KEY (site_code, sku_code)
);

-- arsalesp: salesperson master data
CREATE TABLE IF NOT EXISTS arsalesp (
  salesp_key    VARCHAR(15) PRIMARY KEY,
  salesp_name   VARCHAR(200),
  ss_code       VARCHAR(15),
  trade_segment VARCHAR(5),
  active        BOOLEAN DEFAULT TRUE,
  province_code VARCHAR(50),
  site_code     VARCHAR(50),
  source_db     VARCHAR(20)
);

-- ==========================================================================
-- SECTION 3: INDEXES
-- ==========================================================================

-- door indexes
CREATE INDEX IF NOT EXISTS idx_door_off_date    ON door(off_date);
CREATE INDEX IF NOT EXISTS idx_door_year        ON door(year);
CREATE INDEX IF NOT EXISTS idx_door_saleperson  ON door(saleperson_key);
CREATE INDEX IF NOT EXISTS idx_door_customer    ON door(customer_key);
CREATE INDEX IF NOT EXISTS idx_door_sku         ON door(sku_code);
CREATE INDEX IF NOT EXISTS idx_door_ship_from   ON door(ship_from_code);
CREATE INDEX IF NOT EXISTS idx_door_category    ON door(category);
CREATE INDEX IF NOT EXISTS idx_door_brand       ON door(brand);
CREATE INDEX IF NOT EXISTS idx_door_program     ON door(program_id);
CREATE INDEX IF NOT EXISTS idx_door_date_year   ON door(off_date, year);

-- dpur indexes
CREATE INDEX IF NOT EXISTS idx_dpur_pur_date    ON dpur(pur_date);
CREATE INDEX IF NOT EXISTS idx_dpur_year        ON dpur(year);
CREATE INDEX IF NOT EXISTS idx_dpur_trntyp      ON dpur(trntyp);
CREATE INDEX IF NOT EXISTS idx_dpur_sku         ON dpur(sku_code);

-- inloc indexes
CREATE INDEX IF NOT EXISTS idx_inloc_inv_date   ON inloc(inv_date);
CREATE INDEX IF NOT EXISTS idx_inloc_year       ON inloc(year);
CREATE INDEX IF NOT EXISTS idx_inloc_sku        ON inloc(sku_code);

-- product indexes
CREATE INDEX IF NOT EXISTS idx_product_category ON product(category);
CREATE INDEX IF NOT EXISTS idx_product_brand    ON product(brand);
