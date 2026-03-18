# Phase 1: Database Migrations & Seed Data - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning
**Updated:** 2026-03-18 (schema decisions overridden by /gsd:plan-phase args)

<domain>
## Phase Boundary

Deploy the full Postgres schema for the admin dashboard via numbered migration files, then populate with 27-month realistic analytics seed data. No UI. No API routes. No auth guards. Just schema + data.

**Deliverables:**
1. Migration files in `supabase/migrations/`
2. Seed data files in `data/seeds/` as Markdown tables
3. `scripts/seed.ts` — idempotent seed runner (parse .md files → upsert in dependency order)

</domain>

<decisions>
## Implementation Decisions

### Schema — Tables & Migrations (LOCKED by plan-phase args)

**Migration execution order** (strict FK dependency chain):

1. **`20260318_001_create_clinics.sql`** — new `clinics` table:
   ```sql
   CREATE TABLE clinics (
     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name        text NOT NULL,
     code        text NOT NULL UNIQUE,
     type        text,   -- 'phong_kham' | 'nha_thuoc' | 'thu_y' | 'my_pham' | 'khac'
     province    text,
     district    text,
     address     text,
     lat         numeric(9,6),
     lng         numeric(9,6),
     created_at  timestamptz NOT NULL DEFAULT now()
   );
   ```
   RLS: `clinics` readable by admins only (service role SELECT all; authenticated SELECT only own clinic).

2. **`20260318_002_alter_profiles.sql`** — ALTER existing `profiles` (if exists) or create it:
   ```sql
   -- If profiles doesn't exist, CREATE TABLE. If it does, ALTER TABLE:
   ALTER TABLE profiles
     ADD COLUMN IF NOT EXISTS is_admin    boolean NOT NULL DEFAULT false,
     ADD COLUMN IF NOT EXISTS clinic_id   uuid REFERENCES clinics(id),
     ADD COLUMN IF NOT EXISTS province    text,
     ADD COLUMN IF NOT EXISTS district    text,
     ADD COLUMN IF NOT EXISTS lat         numeric(9,6),
     ADD COLUMN IF NOT EXISTS lng         numeric(9,6),
     ADD COLUMN IF NOT EXISTS user_type   text;
   ```
   **IMPORTANT**: `profiles` may already exist (from Supabase Auth setup). Migration must use `IF NOT EXISTS` / `IF EXISTS` guards throughout. Check `supabase/schema.sql` first.

3. **`20260318_003_create_query_events.sql`** — new `query_events` table:
   ```sql
   CREATE TABLE query_events (
     id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     clinic_id        uuid REFERENCES clinics(id),
     drug_category    text,   -- 'kháng sinh' | 'vitamin' | 'hormone' | 'vắc-xin' | 'kháng ký sinh trùng' | 'khác'
     animal_type      text,   -- 'trâu bò' | 'lợn' | 'gà' | 'chó mèo' | 'thủy sản' | 'khác'
     query_type       text,   -- 'chẩn đoán' | 'điều trị' | 'phòng bệnh' | 'liều lượng' | 'khác'
     response_time_ms integer,
     created_at       timestamptz NOT NULL DEFAULT now()
   );
   ```
   RLS:
   - Authenticated users can INSERT their own rows (`user_id = auth.uid()`)
   - Reads: service role only (admins use service role client — anon/authenticated cannot SELECT)
   - Add UNIQUE constraint on `conversation_id` for idempotent upserts: `UNIQUE (conversation_id)`

4. **`20260318_004_create_kb_documents.sql`** — `kb_documents` table:
   ```sql
   CREATE TABLE kb_documents (
     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     doc_code        text NOT NULL UNIQUE,
     doc_name        text NOT NULL,
     chunk_count     integer NOT NULL DEFAULT 0,
     doc_type        text,   -- 'PDF' | 'DOCX' | 'TXT'
     category        text,
     drug_group      text,
     source          text,
     relevance_score numeric(4,3),
     status          text NOT NULL DEFAULT 'active',
     created_at      timestamptz NOT NULL DEFAULT now()
   );
   ```
   RLS: service role only.

5. **`20260318_005_add_profile_trigger.sql`** — SECURITY DEFINER trigger on `auth.users` to auto-create `profiles` row on signup:
   ```sql
   CREATE OR REPLACE FUNCTION handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO profiles (id, email)
     VALUES (NEW.id, NEW.email)
     ON CONFLICT (id) DO NOTHING;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```
   Must come LAST (after profiles table/column exists).

**Note on materialized views**: The ROADMAP.md requirements (DB-07 through DB-09) include materialized views (`mv_monthly_queries`, `mv_daily_queries`, `mv_category_stats`, `mv_dashboard_kpis`). These are needed for Phase 3+ dashboard pages. Include them in a 6th migration file:

6. **`20260318_006_create_materialized_views.sql`** — all 4 materialized views using `query_events` as the source (instead of `chat_analytics`):
   - `mv_monthly_queries`: group by user_id, year, month → session_count, query_count
   - `mv_daily_queries`: group by user_id, year, month, day
   - `mv_category_stats`: group by year, month, province, clinic type, drug_category, animal_type, query_type
   - `mv_dashboard_kpis`: single-row aggregate (total_sessions, total_queries, total_users, total_documents, total_staff, refreshed_at)
   - Add UNIQUE indexes on first 3 views (for REFRESH CONCURRENTLY). NO unique index on mv_dashboard_kpis.

### Seed Data Format (LOCKED by plan-phase args)

- **Format**: Markdown tables (`.md` files) in `data/seeds/`
- **Files**:
  - `data/seeds/clinics.md` — clinic rows
  - `data/seeds/profiles.md` — user profile rows (non-admin + 2 admin)
  - `data/seeds/conversations.md` — conversation stubs
  - `data/seeds/query_events.md` — per-conversation analytics
  - `data/seeds/kb_documents.md` — knowledge base documents
- **Content**: Agent has FULL creative discretion — all Vietnamese names, clinic names, drug names, etc. No placeholders. Every row written completely.
- **Hard rules from user**:
  - Date range: January 2024 → current date (March 2026), full coverage, no gaps
  - Realistic Vietnamese context throughout
  - Volume: enough for every chart, KPI, map pin, and color-coded cell in samples/ to render with ZERO empty states
  - Clinic activity variance: all 3 color states in check-clinics pivot (>50 green, 10–50 yellow, <10 red)
  - Minimum 10 clinics and 10 KB documents (for Top 10 charts)
- **Auth user creation**: `supabase.auth.admin.createUser({ email, email_confirm: true })` per user. Trigger auto-creates profiles row. Follow-up UPDATE adds clinic_id, province, etc.

### Seed Script (LOCKED by plan-phase args)

- **File**: `scripts/seed.ts`
- **Runner**: `npx ts-node scripts/seed.ts`
- **Behavior**:
  1. Parse all `.md` seed files using a markdown table parser (extract column headers + data rows)
  2. Insert in dependency order: `clinics` → auth users/profiles → `conversations` → `query_events` → `kb_documents`
  3. Fully idempotent: `ON CONFLICT DO NOTHING` for all tables; wrap auth user creation in try/catch
  4. Print completion summary: count of each entity inserted/skipped
- **Primary guard**: Count `clinics` rows first — if > 0, offer skip or force flag

### Idempotent Upsert Strategy

- `clinics`: conflict on `code` (UNIQUE)
- `profiles`: conflict on `id` (primary key)
- `conversations`: conflict on `id`
- `query_events`: conflict on `conversation_id` (UNIQUE constraint)
- `kb_documents`: conflict on `doc_code` (UNIQUE)
- Auth users: try/catch on `createUser()`, log "already exists" and continue

### Claude's Discretion

- All actual data values (Vietnamese names, clinic names, conversation content, document names)
- Exact timestamps within each month
- Per-clinic query volume variation achieving the 3-color distribution
- KB document chunk counts (10–200 range)
- Markdown table parser implementation in seed.ts
- `refresh-views.ts` script design (runs after seed completes; CONCURRENTLY for 3 views, plain for mv_dashboard_kpis)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### User-Specified Schema (PRIMARY SOURCE OF TRUTH for migrations)
- The plan-phase args specify: `clinics`, `query_events`, ALTER `profiles` — these OVERRIDE the spec's `chat_analytics` table and profiles-embedded clinic data

### Design Spec (reference for views, RLS patterns, seed volumes)
- `docs/2026-03-18-admin-dashboard-design.md` §3 — Original table DDL (use as reference for RLS patterns and view definitions; adapt for `query_events` replacing `chat_analytics`)
- `docs/2026-03-18-admin-dashboard-design.md` §9 — Seed volumes and distributions (apply these to the new schema)

### Existing Schema (read before writing migrations — avoid conflicts)
- `supabase/schema.sql` — existing `conversations`, `messages`, RLS policies, existing trigger. Migrations must NOT break these.

### Visual Reference (zero empty states requirement)
- `samples/1_dashboard.jpg` — dashboard KPIs, charts, map
- `samples/2_nhap_hang.jpg` — new activity page
- `samples/3_ton_kho.jpg` — knowledge base page
- `samples/4_khach_hang.jpg` — users analytics
- `samples/5_customer.jpg` — check users page
- `samples/6_check_distributor.jpg` — check clinics pivot (3 color states required)
- `samples/6_check_distributor_2.jpg` — clinic detail modal

### Project Requirements
- `.planning/REQUIREMENTS.md` — DB-01 through DB-12

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/server.ts` — `createServiceClient()` (service role) for seed script DB writes; `supabase.auth.admin.*` for user management
- `supabase/schema.sql` — existing SECURITY DEFINER trigger pattern to replicate for `handle_new_user()`

### Established Patterns
- `supabase/migrations/` — does NOT exist yet. Must be created.
- `scripts/` — does NOT exist yet. Must be created.
- `data/seeds/` — does NOT exist yet. Must be created.
- TypeScript strict mode throughout. Seed script uses `ts-node` not `tsx` (per plan-phase args).
- Env: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`

### Integration Points
- `supabase/schema.sql` — read before writing any migration
- `auth.users` — FK target for `profiles.id` and `query_events.user_id`
- `conversations` — FK target for `query_events.conversation_id` (existing table)

</code_context>

<specifics>
## Specific Ideas

- Migration numbering: `20260318_001_`, `20260318_002_`, etc. — guarantees alphanumeric sort = dependency order
- `query_events.conversation_id` needs UNIQUE constraint for idempotent seed upserts
- `kb_documents.doc_code` needs UNIQUE constraint for idempotent seed upserts
- Materialized views must adapt joins to use `query_events` (not `chat_analytics`) + `clinics` (not profiles for geographic data)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-migrations-seed-data*
*Context gathered: 2026-03-18*
*Schema updated: user's /gsd:plan-phase args override spec — clinics + query_events tables, ALTER profiles*
