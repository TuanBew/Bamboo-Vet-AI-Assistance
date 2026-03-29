-- ==========================================================================
-- Migration: Add staff_id to customer_purchases + supplier_id to customers
-- Date: 2026-03-29
-- Purpose: Enable Nhan Vien (staff performance) section and NPP filter on dashboard
-- ==========================================================================

-- 1. Add supplier_id FK to customers (was missing from migration 008)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_supplier ON customers (supplier_id);

-- 2. Add staff_id FK to customer_purchases
ALTER TABLE customer_purchases
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES distributor_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cp_staff ON customer_purchases (staff_id);
