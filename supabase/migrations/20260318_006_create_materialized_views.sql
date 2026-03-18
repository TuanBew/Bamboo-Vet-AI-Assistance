-- Migration 006: Create 4 materialized views + refresh helper function
-- Dependency: query_events, conversations, messages, profiles, clinics, kb_documents

-- mv_monthly_queries: drives monthly time-series, sparklines, user pivot tables
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_queries AS
SELECT
  qe.user_id,
  EXTRACT(YEAR  FROM c.created_at)::int AS year,
  EXTRACT(MONTH FROM c.created_at)::int AS month,
  COUNT(DISTINCT c.id)                   AS session_count,
  COUNT(m.id)                            AS query_count
FROM conversations c
JOIN messages m       ON m.conversation_id = c.id AND m.role = 'user'
JOIN query_events qe  ON qe.conversation_id = c.id
GROUP BY qe.user_id, year, month;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_queries_unique
  ON mv_monthly_queries (user_id, year, month);

-- mv_daily_queries: drives clinic detail modal day-by-day breakdown
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_queries AS
SELECT
  qe.user_id,
  EXTRACT(YEAR  FROM c.created_at)::int AS year,
  EXTRACT(MONTH FROM c.created_at)::int AS month,
  EXTRACT(DAY   FROM c.created_at)::int AS day,
  COUNT(DISTINCT c.id)                   AS session_count,
  COUNT(m.id)                            AS query_count
FROM conversations c
JOIN messages m       ON m.conversation_id = c.id AND m.role = 'user'
JOIN query_events qe  ON qe.conversation_id = c.id
GROUP BY qe.user_id, year, month, day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_queries_unique
  ON mv_daily_queries (user_id, year, month, day);

-- mv_category_stats: drives donut/pie charts with province and clinic_type filters
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_category_stats AS
SELECT
  EXTRACT(YEAR  FROM c.created_at)::int AS year,
  EXTRACT(MONTH FROM c.created_at)::int AS month,
  p.province,
  cl.type                                AS clinic_type,
  qe.drug_category,
  qe.animal_type,
  qe.query_type,
  COUNT(*)                               AS count
FROM conversations c
JOIN query_events qe ON qe.conversation_id = c.id
JOIN profiles p      ON p.id = qe.user_id
LEFT JOIN clinics cl ON cl.id = qe.clinic_id
GROUP BY year, month, p.province, cl.type,
         qe.drug_category, qe.animal_type, qe.query_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_category_stats_unique
  ON mv_category_stats (year, month, province, clinic_type, drug_category, animal_type, query_type);

-- mv_dashboard_kpis: single-row aggregate for KPI cards
-- NOTE: Cannot use REFRESH CONCURRENTLY (no unique key on single-row aggregate)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_kpis AS
SELECT
  COUNT(DISTINCT c.id)                                       AS total_sessions,
  COUNT(m.id) FILTER (WHERE m.role = 'user')                AS total_queries,
  COUNT(DISTINCT c.user_id)                                  AS total_users,
  (SELECT COUNT(*) FROM kb_documents WHERE status = 'active') AS total_documents,
  (SELECT COUNT(*) FROM profiles WHERE is_admin = false)     AS total_staff,
  now()                                                      AS refreshed_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id;
-- NO unique index on mv_dashboard_kpis — use plain REFRESH only

-- Helper function for scripts/refresh-views.ts (callable via supabase.rpc())
CREATE OR REPLACE FUNCTION refresh_admin_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_queries;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_queries;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;
  REFRESH MATERIALIZED VIEW mv_dashboard_kpis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
