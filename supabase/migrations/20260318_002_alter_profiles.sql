-- Migration 002: Add admin dashboard columns to profiles
-- Dependency: clinics table must exist (for FK)

CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin    boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS clinic_id   uuid REFERENCES clinics(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat         numeric(9,6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng         numeric(9,6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type   text;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'own_profile_select' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE POLICY "own_profile_select" ON profiles FOR SELECT USING (id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'own_profile_update' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE POLICY "own_profile_update" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_profiles' AND tablename = 'profiles') THEN
    EXECUTE 'CREATE POLICY "service_role_all_profiles" ON profiles FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;
