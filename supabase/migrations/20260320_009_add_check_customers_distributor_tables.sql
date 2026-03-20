-- ==========================================================================
-- Migration: Add display_programs, distributor_staff tables + alter customers/suppliers
-- Date: 2026-03-20
-- Tables: display_programs (new), distributor_staff (new)
-- Alters: customers (add address/street/ward/image_url), suppliers (add region/zone)
-- ==========================================================================

-- 1. ALTER customers: add missing columns for check-customers page
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ward text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS image_url text;

-- 2. ALTER suppliers: add region/zone for check-distributor page
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS zone text;

-- 3. CREATE display_programs table (for "Tinh hinh trung bay" section)
CREATE TABLE IF NOT EXISTS display_programs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id            uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  program_name           text NOT NULL,
  staff_name             text NOT NULL,
  time_period            text NOT NULL,
  registration_image_url text,
  execution_image_url    text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- 4. CREATE distributor_staff table (for daily detail modal)
CREATE TABLE IF NOT EXISTS distributor_staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  staff_code    text NOT NULL,
  staff_name    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, staff_code)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_display_programs_customer ON display_programs (customer_id);
CREATE INDEX IF NOT EXISTS idx_distributor_staff_supplier ON distributor_staff (supplier_id);

-- ==========================================================================
-- RLS Policies — service role only (same pattern as migration 007/008)
-- ==========================================================================

ALTER TABLE display_programs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'display_programs' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON display_programs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

ALTER TABLE distributor_staff ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'distributor_staff' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON distributor_staff FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
