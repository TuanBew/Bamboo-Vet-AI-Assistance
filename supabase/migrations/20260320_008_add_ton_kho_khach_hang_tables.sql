-- ==========================================================================
-- Migration: Add inventory, customer, and customer purchase tables
-- Date: 2026-03-20
-- Tables: inventory_snapshots, customers, customer_purchases
-- ==========================================================================

-- inventory_snapshots: weekly stock level per product per date
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  qty           integer NOT NULL DEFAULT 0,
  unit_price    numeric(12,0) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, snapshot_date)
);

-- customers: business customers that buy from the distributor
CREATE TABLE IF NOT EXISTS customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code  text NOT NULL UNIQUE,
  customer_name  text NOT NULL,
  customer_type  text NOT NULL, -- TH | GSO | PHA | SPS | BTS | OTHER | PLT | WMO
  province       text,
  district       text,
  is_active      boolean NOT NULL DEFAULT true,
  is_mapped      boolean NOT NULL DEFAULT false,
  is_geo_located boolean NOT NULL DEFAULT false,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- customer_purchases: purchase orders from customers
CREATE TABLE IF NOT EXISTS customer_purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  purchase_date date NOT NULL,
  qty           integer NOT NULL,
  unit_price    numeric(12,0) NOT NULL,
  total_value   numeric(15,0) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inv_snap_product_date ON inventory_snapshots (product_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cust_purchases_customer ON customer_purchases (customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_purchases_product ON customer_purchases (product_id);

-- ==========================================================================
-- RLS Policies — service role only (same pattern as migration 007)
-- ==========================================================================

ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_snapshots' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON inventory_snapshots FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON customers FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE customer_purchases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_purchases' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON customer_purchases FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
