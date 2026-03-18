-- Migration 003: Create query_events table (replaces chat_analytics from spec)
-- Dependency: auth.users, conversations, clinics

CREATE TABLE IF NOT EXISTS query_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  clinic_id        uuid REFERENCES clinics(id),
  drug_category    text,
  animal_type      text,
  query_type       text,
  response_time_ms integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT query_events_conversation_id_unique UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_query_events_user_id ON query_events(user_id);
CREATE INDEX IF NOT EXISTS idx_query_events_clinic_id ON query_events(clinic_id);
CREATE INDEX IF NOT EXISTS idx_query_events_created_at ON query_events(created_at);

ALTER TABLE query_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_insert_own_query_events" ON query_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "service_role_all_query_events" ON query_events
  FOR ALL
  USING (auth.role() = 'service_role');
