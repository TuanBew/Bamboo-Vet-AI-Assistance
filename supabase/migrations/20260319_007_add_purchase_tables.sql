-- ==========================================================================
-- Migration: Add purchase order tables for nhap-hang page
-- Date: 2026-03-19
-- Tables: suppliers, products, purchase_orders, purchase_order_items
-- ==========================================================================

-- suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL UNIQUE,
  supplier_name text NOT NULL,
  province      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- products
CREATE TABLE IF NOT EXISTS products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code     text NOT NULL UNIQUE,
  product_name     text NOT NULL,
  product_group    text NOT NULL,
  classification   text NOT NULL,
  packaging        text,
  manufacturer     text,
  unit_price       numeric(12,0) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code    text NOT NULL UNIQUE,
  order_date    date NOT NULL,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  total_amount  numeric(15,0) NOT NULL,
  total_promo_qty integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- purchase_order_items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL,
  promo_qty   integer NOT NULL DEFAULT 0,
  unit_price  numeric(12,0) NOT NULL,
  subtotal    numeric(15,0) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poi_order_id ON purchase_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product_id ON purchase_order_items (product_id);

-- ==========================================================================
-- RLS Policies — service role only (same pattern as chat_analytics)
-- ==========================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON suppliers FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON products FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON purchase_orders FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON purchase_order_items FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
