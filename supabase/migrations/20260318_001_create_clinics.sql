-- Migration 001: Create clinics table
-- Dependency: none

CREATE TABLE IF NOT EXISTS clinics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL UNIQUE,
  type        text,
  province    text,
  district    text,
  address     text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_clinics" ON clinics
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_select_own_clinic" ON clinics
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND id = (SELECT clinic_id FROM profiles WHERE id = auth.uid())
  );
