## Tech Stack
- Framework: Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui
- Auth: Supabase via @supabase/ssr — SSR-first, JWT is_admin from app_metadata claim
- Admin API: all routes use requireAdmin() + createServiceClient() (service role)
- Streaming: /api/chat uses ReadableStream relay to RAGflow
- Rate limiting: Upstash Redis (@upstash/ratelimit) for guest users
- Maps: react-leaflet with next/dynamic ssr:false
- Tables: @tanstack/react-table v8
- Charts: Recharts
- Export: xlsx + jsPDF + jspdf-autotable
- i18n: lib/i18n/vietnamese.ts (VI namespace) — all Vietnamese strings centralised

## Test Commands
- Unit/API tests: `npm test` (Vitest)
- E2E tests: `npm run test:e2e` (Playwright)
- All tests: `npm run test:all`
- Single file: `npx vitest run src/path/to/file.test.ts`
- Watch mode: `npm run test:watch`

## Testing Rules (NON-NEGOTIABLE)
- After finishing ANY feature, fix, or task — run `npm run test:all` immediately. Do NOT ask me to test.
- If tests fail: read the exact error, fix the implementation (never the test), re-run.
- Loop test → fix → test until ALL pass. Max 5 fix attempts then stop and show me the output.
- Never use .skip() or .only() to bypass failures.
- Never update snapshots to match broken behaviour — snapshots are the source of truth.
- Always run `npm run test:all` before suggesting any git commit.
- For E2E: always run against the local dev server (`npm run dev`) on port 3000.

## What Must Be Tested for Every Delivered Feature

### Auth & Routing
- [ ] Unauthenticated → /admin/* → redirects to /login (AUTH-01)
- [ ] Non-admin authenticated → /admin/* → redirects to /login (AUTH-02)
- [ ] Admin authenticated → /app → redirects to /admin/dashboard (AUTH-03)
- [ ] requireAdmin() returns 403 JSON for non-admin API calls (AUTH-04)
- [ ] All /api/admin/* routes return 401/403 without valid admin session

### Admin Shell (every page)
- [ ] Dark sidebar renders (#1a1f2e background) on all /admin/* pages
- [ ] All 6 sidebar nav items render and navigate correctly
- [ ] "Làm mới dữ liệu" (top bar refresh button) triggers materialized view refresh
- [ ] Breadcrumb path updates correctly per page
- [ ] Settings page shows admin name, email, is_admin badge, last refresh timestamp
- [ ] No hydration errors in browser console on any admin page

### Shared Components
- [ ] KpiCard: renders number, label, icon, background color prop
- [ ] SectionHeader: renders title, chevron toggles collapse/expand on click
- [ ] FilterBar: province selector, district selector, clinic_type selector, year/month picker, search input — all controlled, all update query params
- [ ] DataTable: Copy button, Excel button, CSV button, PDF button, Print button — each triggers correct export
- [ ] DataTable: pagination works (10 default rows, next/prev, page size change)
- [ ] DataTable: column visibility toggle hides/shows columns
- [ ] DataTable: search/filter input narrows rows
- [ ] ColorPivotTable: cells >50 → green, 10-50 → yellow, 1-9 → red, 0 → grey
- [ ] ColorPivotTable: Excel export downloads file with correct data
- [ ] MapView: renders without SSR crash, marker icons load (no broken image icon)
- [ ] MapView: clicking a pin shows popup with correct content
- [ ] SparklineChart: renders inside table rows without errors

### Dashboard Page (/admin/dashboard)
- [ ] KPI cards show non-zero numbers from mv_dashboard_kpis
- [ ] Grouped BarChart renders with data for 2024 / 2025 / 2026
- [ ] AreaChart renders with solid line for real data + dotted line for 3 forecast months
- [ ] Forecast months have is_forecast: true and use strokeDasharray="4 4"
- [ ] Chi so tap trung: LineChart (daily volume), 5 KPI cards, 6 PieChart donuts all render
- [ ] Nguoi dung table: rows with full_name, clinic_name, sparkline, queries, sessions, avg, days_active
- [ ] Phong kham section: Leaflet map renders with colour-coded pins, clicking pin shows popup
- [ ] Top 10 horizontal BarChart renders with non-zero bars
- [ ] FilterBar changes update charts (province, clinic_type, year/month)

### Nhap Hang Page (/admin/nhap-hang)
- [ ] 6 KPI cards render with non-zero values
- [ ] AreaChart (daily revenue) renders
- [ ] BarChart (daily quantity) renders
- [ ] Orders DataTable renders with all rows, pagination works
- [ ] Order detail drawer opens on row click, shows order line items
- [ ] Top 10 products chart renders
- [ ] Donut charts render
- [ ] RadarChart renders
- [ ] Search button triggers refetch (not onChange auto-refetch)
- [ ] All export formats work: Copy, Excel, CSV, PDF, Print

### Ton Kho Page (/admin/ton-kho)
- [ ] 3 KPI cards render (Tổng giá trị tồn blue / Tổng số lượng orange / Số SKU teal)
- [ ] NPP dropdown filters data correctly
- [ ] Date picker changes snapshot date, data updates
- [ ] Nhóm dropdown filters product group
- [ ] Search input filters product table
- [ ] 6 charts render in 2×3 grid (3 horizontal bar + 2 donut for value/qty groups)
- [ ] DataTable "Danh sách sản phẩm tồn kho": Copy + Excel export work

### Khach Hang Page (/admin/khach-hang)
- [ ] LineChart (new customers per month) renders with data
- [ ] BarChart (customers by province) renders
- [ ] Horizontal BarChart (customers by district) renders
- [ ] "Tất cả khách hàng" section: 4 KPI tiles + breakdown table with 8 types (TH/GSO/PHA/SPS/BTS/OTHER/PLT/WMO)
- [ ] "Khách hàng đang mua hàng" section: 4 KPI tiles + breakdown table with pct_of_total and pct_of_active columns
- [ ] SectionHeader chevron toggles collapse for "Số lượng cửa hiệu thực phẩm >300K" section
- [ ] ">300K" section shows graceful empty state when no qualifying stores
- [ ] NPP dropdown filter updates all charts

### Check Users Page (/admin/check-users)
- [ ] Full-width Leaflet map renders with colour-coded pins by clinic_type
- [ ] Map pin popup shows full_name + clinic_type
- [ ] DataTable: 10 default rows, pagination works
- [ ] DataTable columns: Mã KH / Tên KH / Email / Địa chỉ / Quận/Huyện / Tỉnh / Loại cơ sở / Ảnh cơ sở / Ngày tạo / Định vị / Xem lịch sử
- [ ] All 5 export formats: Copy + Excel + CSV + PDF + Print
- [ ] "Xem lịch sử" button opens shadcn Sheet (right drawer)
- [ ] Sheet lists conversations for that user
- [ ] Clicking a conversation loads messages in read-only chat-style view
- [ ] Back arrow in drawer returns to conversation list
- [ ] Monthly pivot table renders (rows=users, columns=2024-01→2026-03)
- [ ] Pivot table Excel export works
- [ ] Pivot table search input narrows rows

### Check Clinics Page (/admin/check-clinics)
- [ ] ColorPivotTable renders columns: Miền / Vùng / Tỉnh / Mã / Tên / Tháng 1–12
- [ ] Filter bar: year, metric, clinic_type, province, drug_group, search — all work
- [ ] Copy + Excel export work
- [ ] Column visibility toggle works
- [ ] Clicking a clinic row opens shadcn Dialog (dark bg-gray-900)
- [ ] Clinic detail dialog shows daily breakdown grid (staff rows × days 1–31)
- [ ] Color thresholds apply in detail grid cells

### Security (Phase 6)
- [ ] `npm audit` — no high/critical CVEs in admin dependencies
- [ ] `next build` — createServiceClient and SUPABASE_SERVICE_ROLE_KEY absent from client bundle
- [ ] window.print() on any DataTable page — sidebar hidden, table visible only
- [ ] CSP includes tile.openstreetmap.org in img-src and connect-src — no CSP errors in console
- [ ] PDF export contains legible Vietnamese diacritics (e.g. "Nguyễn Thị Hoa", "Hà Nội")

### Performance (Phase 7)
- [ ] Middleware uses getSession() not getUser() — zero network calls (check via no DB queries logged)
- [ ] is_admin read from JWT app_metadata, not profiles table
- [ ] Admin pages use Suspense streaming — skeleton renders before data arrives
- [ ] No CLOSE_WAIT connection leaks after 30 mins of use
- [ ] ReadableStream in /api/chat closes properly on client disconnect

### Dashboard Sales Rebuild (Phase 8)
- [ ] /admin/dashboard shows ZERO chatbot KPIs (no total_queries, total_sessions)
- [ ] KPIs show nhap hang, ban hang, khach hang, SKU, nhan vien data
- [ ] Filter bar: NPP, month, nganh hang, thuong hieu, kenh dropdowns all populated
- [ ] Tong quan: grouped bar (nhap+ban by year) + area chart (monthly + forecast dotted)
- [ ] Nhan vien table: staff performance with TOTAL, sparkline, orders, avg, customers, ngay>1tr
- [ ] Top 10 Khach hang + Top 10 San pham render with non-zero bars
- [ ] /admin/check-users returns 404 (file deleted)
- [ ] /admin/check-clinics returns 404 (file deleted)

## API Mocking Strategy
- Supabase: mock @supabase/ssr createServerClient with vi.mock
- Upstash: mock @upstash/ratelimit Ratelimit class
- RAGflow: mock fetch() for /api/chat ReadableStream relay
- Service role client: always mock createServiceClient() — never call real DB in unit tests
- Leaflet: mock react-leaflet with vi.mock (no real map in unit tests, use Playwright for E2E)

## Compact Instructions
When compacting, always preserve:
- The full test commands section
- All Testing Rules
- The complete "What Must Be Tested" checklist
- The API Mocking Strategy
