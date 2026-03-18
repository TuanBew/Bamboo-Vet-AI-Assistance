-- Migration 004: Create kb_documents table
-- Dependency: none (standalone)

CREATE TABLE IF NOT EXISTS kb_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_code        text NOT NULL UNIQUE,
  doc_name        text NOT NULL,
  chunk_count     integer NOT NULL DEFAULT 0,
  doc_type        text,
  category        text,
  drug_group      text,
  source          text,
  relevance_score numeric(4,3),
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_kb_documents" ON kb_documents
  FOR ALL
  USING (auth.role() = 'service_role');
