# Requirements: Bamboo Vet Admin Dashboard

**Defined:** 2026-03-18
**Core Value:** Admins can see exactly who is using the platform, what they're asking, and where they're located — so they can manage knowledge base quality, monitor clinic engagement, and identify usage patterns across the Vietnamese veterinary market.

## v1 Requirements

All requirements are new (Product B). Product A (chatbot) is validated and untouched.

---

### Database (Phase 1)

- [x] **DB-01**: Admin can rely on `profiles` table existing for every user (auto-populated by SECURITY DEFINER trigger on `auth.users` insert) with geographic fields: province, district, ward, region, latitude, longitude, clinic_type, facility_code, staff_code
- [x] **DB-02**: Admin can trust that `profiles.is_admin` defaults to `false` for all new users, with promotion done via SQL only
- [x] **DB-03**: `chat_analytics` table stores per-conversation drug_group, animal_type, query_type metadata (service role only, no client access)
- [x] **DB-04**: `kb_documents` table stores knowledge base document registry (doc_code, doc_name, chunk_count, doc_type, category, drug_group, source, relevance_score, status)
- [x] **DB-05**: `mv_monthly_queries` materialized view (user × year × month, query + session counts) with UNIQUE INDEX on (user_id, year, month) for REFRESH CONCURRENTLY
- [x] **DB-06**: `mv_daily_queries` materialized view (user × year × month × day) with UNIQUE INDEX on (user_id, year, month, day) for REFRESH CONCURRENTLY
- [x] **DB-07**: `mv_category_stats` materialized view (year × month × province × clinic_type × drug_group × animal_type × query_type) with UNIQUE INDEX on all 7 columns for REFRESH CONCURRENTLY
- [x] **DB-08**: `mv_dashboard_kpis` materialized view (single-row aggregate: total_sessions, total_queries, total_users, total_documents, total_staff, refreshed_at) — no unique index, plain REFRESH only
- [ ] **DB-09**: Idempotent seed script generates 82 profiles (80 non-admin + 2 admin) with realistic geographic and clinic-type distributions (Hà Nội 15, HCMC 18, Đà Nẵng 8, etc.)
- [ ] **DB-10**: Idempotent seed script generates ~4,000 conversations + ~20,000 messages + ~4,000 chat_analytics rows across Jan 2024–Mar 2026 with correct volume curve (80/month in 2024 → 320/month in 2025 H2)
- [ ] **DB-11**: Idempotent seed script generates 120 kb_documents with 8 drug categories, 3 doc types (PDF 60% / DOCX 30% / TXT 10%), relevance scores 0.60–0.99
- [x] **DB-12**: `scripts/refresh-views.ts` refreshes all 4 views (3 CONCURRENTLY, 1 plain) using service role client

---

### Auth & Role-Based Routing (Phase 2)

- [ ] **AUTH-01**: Unauthenticated user accessing any `/admin/*` route is redirected to `/login`
- [ ] **AUTH-02**: Authenticated user with `is_admin = false` accessing any `/admin/*` route is redirected to `/login`
- [ ] **AUTH-03**: Authenticated user with `is_admin = true` accessing `/app` is redirected to `/admin/dashboard` (two-hop login flow: `/login` → `/app` → `/admin/dashboard`)
- [ ] **AUTH-04**: `requireAdmin()` utility (`lib/admin/auth.ts`) returns `{ user, profile }` for valid admin or `NextResponse(403)` for unauthorized — used in every `/api/admin/*` route
- [ ] **AUTH-05**: `globals.css` dark mode variant selector fixed (`(&:is(.dark *))` → `(&:where(.dark, .dark *))`) so admin dark theme renders correctly in Tailwind v4

---

### Admin Shell (Phase 2)

- [ ] **SHELL-01**: Admin layout (`app/admin/layout.tsx`) renders dark sidebar (`#1a1f2e` background) + top bar on all `/admin/*` pages
- [ ] **SHELL-02**: Sidebar has 3 sections (CORE, CHECKED, OTHER) with 7 nav items, teal/cyan section labels, white active item highlight, collapsible on mobile via hamburger
- [ ] **SHELL-03**: Top bar shows breadcrumb path + "Làm mới dữ liệu" button that triggers server action to refresh all 4 materialized views
- [ ] **SHELL-04**: Settings page (`/admin/settings`) displays admin profile (name, email, is_admin badge), refresh button, and last-refresh timestamp from `mv_dashboard_kpis.refreshed_at`
- [ ] **SHELL-05**: Admin pages have no language toggle (Vietnamese only) and no RAGflow chat

---

### Shared Admin Components (Phase 2)

- [ ] **COMP-01**: `DataTable` component wraps @tanstack/react-table v8 with configurable `exportConfig` prop controlling Copy / Excel / CSV / PDF / Print button visibility per page
- [ ] **COMP-02**: `ColorPivotTable` renders monthly or daily numeric data with color-coded cells: `>50` → green, `10–50` → yellow, `1–9` → red, `0` → grey
- [ ] **COMP-03**: `FilterBar` provides controlled filter row with province selector, district selector, clinic_type selector, year/month date picker, and search input
- [ ] **COMP-04**: `MapView` wraps react-leaflet using `next/dynamic` with `ssr: false` — Leaflet map component that accepts pins array with coordinates and popup content, handles marker icon fix
- [ ] **COMP-05**: `SparklineChart` renders a minimal Recharts LineChart (no axes, no legend) for embedding in table rows as 12-month trend indicators
- [ ] **COMP-06**: `KpiCard` renders colored card with large number, label, optional icon, optional background color prop
- [ ] **COMP-07**: `SectionHeader` renders teal header bar with title and collapsible chevron toggle

---

### Admin Dashboard Page (Phase 3)

- [ ] **DASH-01**: `GET /api/admin/dashboard` returns KPIs (platform-wide, unfiltered), monthly_series (with 3-month forecast, `is_forecast` flag), category_stats (filtered), top_users with sparklines, clinic_map pins, top_clinics
- [ ] **DASH-02**: `lib/admin/forecast.ts` implements server-side linear regression on last 6 months of data, extrapolates 3 forecast months, appended to monthly_series with `is_forecast: true`
- [ ] **DASH-03**: `/admin/dashboard` "Tổng quan" section: grouped BarChart (queries + sessions by year 2024/2025/2026) + AreaChart with dotted line for forecast months (`strokeDasharray="4 4"`)
- [ ] **DASH-04**: `/admin/dashboard` "Chỉ số tập trung" section: LineChart (daily volume for selected month), 5 KPI cards, 6 PieChart donuts (drug group + animal type + query type, for queries and sessions)
- [ ] **DASH-05**: `/admin/dashboard` "Người dùng" section: table with full_name, clinic_name, total queries, 12-month sparkline, sessions, average, days_active + 2 inline horizontal BarCharts per row
- [ ] **DASH-06**: `/admin/dashboard` "Phòng khám" section: Leaflet map with color-coded pins by query volume (click → tooltip) + top 10 horizontal BarChart

---

### New Activity Page (Phase 3)

- [ ] **ACT-01**: `GET /api/admin/new-activity` returns 6 KPIs (new sessions, queries, users, avg queries/session, new documents, avg session duration), daily_query_volume, daily_sessions, recent_sessions, top_questions (60-char prefix grouping, top 10), category_stats
- [ ] **ACT-02**: `/admin/new-activity` renders 6 KPI cards with distinct colored backgrounds (blue, orange, cyan, pink, green, purple)
- [ ] **ACT-03**: `/admin/new-activity` renders AreaChart (daily query volume) + BarChart (new sessions per day)
- [ ] **ACT-04**: `/admin/new-activity` renders recent sessions table (Mã phiên | Ngày | Người dùng | Số truy vấn | Thời gian phút)
- [ ] **ACT-05**: `/admin/new-activity` renders top 10 popular questions horizontal BarChart (60-char prefix vs count)
- [ ] **ACT-06**: `/admin/new-activity` renders 3 category donut PieCharts (animal type, drug group, query type)

---

### Knowledge Base Page (Phase 4)

- [ ] **KB-01**: `GET /api/admin/knowledge-base` returns 3 KPIs, 6 chart datasets (chunks by drug group, chunks by category, doc type breakdown, source breakdown, docs by group, docs by category), paginated documents with search/filter
- [ ] **KB-02**: `/admin/knowledge-base` renders 3 KPI cards (total documents, total chunks, unique ratio) + 4 charts section 1 (2 horizontal BarCharts + 2 PieCharts) + 2 charts section 2 (2 horizontal BarCharts)
- [ ] **KB-03**: `/admin/knowledge-base` renders paginated DataTable with columns Mã | Tên tài liệu | Chunk count | Ngày tạo | Loại | Trạng thái | Relevance score; Copy + Excel export; search bar

---

### Users Analytics Page (Phase 4)

- [ ] **USERS-01**: `GET /api/admin/users` returns monthly_new_users, users_by_province, users_by_district, all_users_kpis (total_active, verified_email via Supabase admin API, geo_located, facility_type_count), facility_breakdown, users_with_queries_kpis, users_with_queries_breakdown, heavy_users
- [ ] **USERS-02**: `/admin/users` renders 3 charts: LineChart (new users per month), BarChart (users by province), horizontal BarChart (users by district)
- [ ] **USERS-03**: `/admin/users` "Tất cả khách hàng" section: 4 KPI tiles + breakdown table (Mã | Loại cơ sở | Icon | Số lượng | %)
- [ ] **USERS-04**: `/admin/users` "Khách hàng đang truy vấn" section: same 4 KPI tiles + breakdown table with % tổng KH + % KH còn hoạt động columns
- [ ] **USERS-05**: `/admin/users` "Người dùng nhiều truy vấn" collapsible section: table with Tên | Cơ sở | Truy vấn tháng này (>10/month threshold)

---

### Check Users Page (Phase 5)

- [ ] **CHKU-01**: `GET /api/admin/check-users` returns map_pins (lat/lng per user with clinic_type for color coding) + paginated users with all profile fields + monthly pivot table (user × "2024-01"→"2026-03" query counts)
- [ ] **CHKU-02**: `GET /api/admin/users/[userId]/conversations` returns conversation list (id, title, created_at, message_count) using service role client (bypasses RLS)
- [ ] **CHKU-03**: `GET /api/admin/users/[userId]/conversations/[conversationId]/messages` returns message array (id, role, content, created_at) using service role client
- [ ] **CHKU-04**: `/admin/check-users` renders full-width Leaflet map with pins color-coded by clinic_type, popup shows full_name + clinic_type
- [ ] **CHKU-05**: `/admin/check-users` renders paginated DataTable (10 default rows) with columns Mã KH | Tên KH | Email | Địa chỉ | Quận/Huyện | Tỉnh | Loại cơ sở | Ảnh cơ sở | Ngày tạo | Định vị | Xem lịch sử; all 5 export formats (Copy + Excel + CSV + PDF + Print)
- [ ] **CHKU-06**: "Xem lịch sử" action opens shadcn Sheet (right drawer), lists conversations, selecting one loads messages in read-only chat-style view
- [ ] **CHKU-07**: `/admin/check-users` renders monthly pivot table (rows=users, columns=2024-01→2026-03, values=query_count) with Excel export and search

---

### Check Clinics Page (Phase 5)

- [ ] **CHKC-01**: `GET /api/admin/check-clinics` returns paginated clinics list (facility_code, region, zone, province, clinic_name, monthly_data dict key "1"–"12")
- [ ] **CHKC-02**: `GET /api/admin/check-clinics/[facilityCode]/detail` returns all staff users under that facility_code with day-by-day query + session counts for selected year/month
- [ ] **CHKC-03**: `/admin/check-clinics` renders ColorPivotTable with columns Miền | Vùng | Tỉnh | Mã | Tên | Tháng 1–12; filter bar (year, metric, clinic_type, province, drug_group, search); Copy + Excel export; column visibility toggle
- [ ] **CHKC-04**: Clicking any clinic row opens shadcn Dialog (dark `bg-gray-900`) showing clinic detail with daily breakdown grid (rows=staff users, columns=days 1–31, cells show query count + session count with same color thresholds)

---

### Security & Polish (Phase 6)

<!-- Note: "AI Analysis Panel" from the original phase name is deferred to v2. Phase 6 covers package installation, print CSS, security hardening, and CSP polish only. -->


- [ ] **POL-01**: Install all new dependencies: `recharts`, `react-leaflet`, `leaflet`, `@types/leaflet`, `@tanstack/react-table`, `xlsx`, `jspdf@^4.2.0` (CVE-2025-68428 fix), `jspdf-autotable`, `tsx` (devDep)
- [ ] **POL-02**: `@media print` CSS class hides admin sidebar during `window.print()` so printed page shows only the table
- [ ] **POL-03**: Service role client (`createServiceClient()`) is only used in server-side code — no client bundle exposure verified via build analysis
- [ ] **POL-04**: Content Security Policy in `next.config.js` updated to allow Leaflet tile server (OpenStreetMap: `https://*.tile.openstreetmap.org`)
- [ ] **POL-05**: jsPDF export for Check Users page handles Vietnamese diacritics correctly (custom font embedding or fallback strategy documented)

---

## v2 Requirements

### Future Enhancements

- **AI analysis panel** — LLM-generated insights from analytics data (e.g., "Query volume is 15% above last month's average" with natural language summary). Deferred; depends on Anthropic API integration in admin context — not in v1 scope.
- **Audit logging** — Admin action log with timestamp, user, action type
- **Real-time data** — Replace materialized view batch refresh with Supabase Realtime subscriptions
- **Multi-tenant admin accounts** — Clinic-level admin users with scoped data access
- **Vietnamese font for PDF export** — Embed Roboto (or Noto Sans Vietnamese) in jsPDF for full diacritic support
- **Two-factor authentication** — TOTP for admin accounts
- **Notification system** — Alert admins when usage drops or spikes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stripe / payments / usage limits | No monetization in this milestone |
| Mobile app (React Native) | Web-first; admin is desktop-only internal tool |
| Multi-tenant clinic admin accounts | Single admin role, SQL-promoted only |
| File/image uploads in chat | Product A feature |
| Voice input | Not applicable to analytics dashboard |
| External data integrations | Seed data only; no live event capture |
| English language support in admin | Internal Vietnamese-only operators |
| Real-time data | Materialized views batch-refreshed on demand |
| Audit logging | Future milestone |
| Admin-UI role promotion | SQL-only by design (prevents accidental privilege escalation) |
| Modify Product A routes | /, /chat, /login, /signup, /app, /api/chat untouched |

## Traceability

*Updated: 2026-03-18 — roadmap created, all 61 requirements mapped.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| DB-05 | Phase 1 | Complete |
| DB-06 | Phase 1 | Complete |
| DB-07 | Phase 1 | Complete |
| DB-08 | Phase 1 | Complete |
| DB-09 | Phase 1 | Pending |
| DB-10 | Phase 1 | Pending |
| DB-11 | Phase 1 | Pending |
| DB-12 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| SHELL-01 | Phase 2 | Pending |
| SHELL-02 | Phase 2 | Pending |
| SHELL-03 | Phase 2 | Pending |
| SHELL-04 | Phase 2 | Pending |
| SHELL-05 | Phase 2 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| COMP-04 | Phase 2 | Pending |
| COMP-05 | Phase 2 | Pending |
| COMP-06 | Phase 2 | Pending |
| COMP-07 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| ACT-01 | Phase 3 | Pending |
| ACT-02 | Phase 3 | Pending |
| ACT-03 | Phase 3 | Pending |
| ACT-04 | Phase 3 | Pending |
| ACT-05 | Phase 3 | Pending |
| ACT-06 | Phase 3 | Pending |
| KB-01 | Phase 4 | Pending |
| KB-02 | Phase 4 | Pending |
| KB-03 | Phase 4 | Pending |
| USERS-01 | Phase 4 | Pending |
| USERS-02 | Phase 4 | Pending |
| USERS-03 | Phase 4 | Pending |
| USERS-04 | Phase 4 | Pending |
| USERS-05 | Phase 4 | Pending |
| CHKU-01 | Phase 5 | Pending |
| CHKU-02 | Phase 5 | Pending |
| CHKU-03 | Phase 5 | Pending |
| CHKU-04 | Phase 5 | Pending |
| CHKU-05 | Phase 5 | Pending |
| CHKU-06 | Phase 5 | Pending |
| CHKU-07 | Phase 5 | Pending |
| CHKC-01 | Phase 5 | Pending |
| CHKC-02 | Phase 5 | Pending |
| CHKC-03 | Phase 5 | Pending |
| CHKC-04 | Phase 5 | Pending |
| POL-01 | Phase 6 | Pending |
| POL-02 | Phase 6 | Pending |
| POL-03 | Phase 6 | Pending |
| POL-04 | Phase 6 | Pending |
| POL-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 — traceability expanded to per-requirement rows after roadmap creation*
