# Phase 6: Security & Polish - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Final security hardening, bilingual polish, and end-to-end verification pass before milestone completion.

This phase covers:
1. **Package Installation** — Install all new npm dependencies at correct versions (recharts, react-leaflet, leaflet, @tanstack/react-table, xlsx, jspdf@^4.2.0, jspdf-autotable, tsx)
2. **Security Verification** — Confirm service role client (`createServiceClient()`) is absent from client bundle and CSP is configured for Leaflet tile server
3. **Print & Export Polish** — Add @media print CSS to hide sidebar, implement Vietnamese diacritics in PDF exports via pre-embedded fonts
4. **Seed Data Completeness** — Expand and patch seed data to ensure realistic, non-linear distribution across full 27-month period (Jan 2024 – Mar 2026)
5. **i18n Dictionary** — Extract all hardcoded Vietnamese UI strings into centralized `lib/i18n/vietnamese.ts` for consistency and maintainability

No new UI pages or major features. Phase 5 pages (check-users, check-clinics, check-customers, check-distributor) must be fully functional before Phase 6 starts.

</domain>

<decisions>
## Implementation Decisions

### Package Installation & Security (POL-01, POL-03)

- **jsPDF version pinning:** Must use `jspdf@^4.2.0` (not ^3.x) — CVE-2025-68428 mitigation
- **All required packages installed:**
  - `recharts` (charts)
  - `react-leaflet` + `leaflet` + `@types/leaflet` (maps)
  - `@tanstack/react-table` (tables)
  - `xlsx` (Excel/CSV export)
  - `jspdf` + `jspdf-autotable` (PDF export)
  - `tsx` (devDependency for scripts)
- **npm audit compliance:** No high/critical CVEs on admin dependencies after installation
- **Service role client boundary:** `createServiceClient()` and `SUPABASE_SERVICE_ROLE_KEY` environment variable are ONLY used in server-side code (API routes, server actions, middleware). Verified via build analysis: does NOT appear in any `.next/static/chunks/*.js` client bundle
- **Bundle verification method:** Claude's discretion during build — use a combination of manual inspection and ANALYZE flag if needed

### Print CSS & Media Queries (POL-02)

- **Print stylesheet location:** Add `@media print` rules to `globals.css` (or page-specific print classes)
- **Sidebar hide on print:** Dark sidebar (`#1a1f2e`) hidden via `display: none` during print
- **Table print view:** DataTable and ColorPivotTable render full-width without sidebar when `window.print()` is called
- **Test:** Verify `window.print()` from any admin data table page (e.g., Check Users DataTable, Check Distributor ColorPivotTable) produces a printed view showing only the table/pivot with no sidebar

### Vietnamese Diacritics in PDF Export (POL-05)

- **Font strategy:** Pre-embed Roboto or Noto Sans Vietnamese in the client bundle (~200KB increase)
- **Why pre-embed:** Ensures Vietnamese diacritics (ă, â, ê, ô, ơ, ư, đ, etc.) render correctly in all jsPDF exports without lazy-loading delays
- **Applies to:** Check Users DataTable PDF export (CHKU-05 requirement); also Check Customers and Check Clinics if they export PDFs
- **Test case:** Export Check Users table as PDF and verify "Nguyễn Thị Hòa" and "Hà Nội" render with correct diacritics

### Content Security Policy (POL-04)

- **CSP update:** `next.config.js` must include:
  - `img-src: https://*.tile.openstreetmap.org` (Leaflet tile images)
  - `connect-src: https://*.tile.openstreetmap.org` (XHR requests to tile server)
- **Test:** Load `/admin/dashboard`, `/admin/check-users`, or any page with Leaflet map; verify:
  - Map tiles load without CSP warnings in browser console
  - Leaflet markers and popups display correctly
  - No "Refused to load image" or "Refused to connect" errors

### Vietnamese UI Strings & i18n (POL-???)

- **i18n dictionary creation:** Extract all Vietnamese labels from components into a centralized `lib/i18n/vietnamese.ts` file
- **Dictionary structure:** Export a single object with logical keys, e.g.:
  ```typescript
  export const VI = {
    nav: {
      dashboard: "Bảng điều khiển",
      nhapHang: "Nhập hàng",
      checkUsers: "Check Người dùng",
      // ...
    },
    buttons: {
      refresh: "Làm mới dữ liệu",
      export: "Xuất",
      // ...
    },
    // ...
  };
  ```
- **Usage:** Replace inline Vietnamese strings with `VI.nav.dashboard`, `VI.buttons.refresh`, etc. in components
- **Rationale:** Centralized dictionary improves consistency, reduces typos, and makes future i18n expansion (if needed) easier
- **Scope:** All admin components and pages (AdminSidebar, KpiCard labels, SectionHeaders, table headers, chart legends, modal titles, etc.)

### Rate Limiting for Admin Routes

- **Decision:** NO rate limiting on `/api/admin/*` routes
- **Rationale:** Admin is an internal tool with trusted operators; rate limiting overhead not justified for small user set
- **Existing rate limiting:** Product A (chatbot) has Upstash Redis rate limiting (out of scope for Phase 6)

### Seed Data Completeness & Realism (Phase 1 Amendment)

**Critical expansion required:** Seed data must cover the full 27-month period (Jan 2024 – Mar 2026) with realistic, non-linear fluctuations. Current seed data is too thin.

#### Profiles (Clinic Staff)
- **Current:** 80 non-admin + 2 admin
- **Expand to:** 120–150 users with realistic geographic spread across all 63 Vietnamese provinces
- **Requirement:** Every province in `mv_category_stats.province` filter must have at least 1 user; major provinces (Hà Nội, HCMC, Đà Nẵng) have 10+
- **Distribution:** Phòng khám (40%) | Nhà thuốc (30%) | Trại chăn nuôi (20%) | Mỹ phẩm (7%) | Khác (3%)

#### Conversations & Messages
- **Current:** ~4,000 conversations, ~20,000 messages (27 months)
- **Expand to:** ~10,000–12,000 conversations, ~50,000–60,000 messages
- **Distribution pattern (realistic, non-linear):**
  - 2024: Low baseline (60–100 queries/month, ramping through year)
  - 2025 Q1–Q2: Growth phase (150–250 queries/month)
  - 2025 Q3–Q4: Peak season (350–450 queries/month)
  - 2026 Q1: Seasonal dip (200–300 queries/month)
  - Daily variance: 20–30% fluctuation, no flat lines; weekday volume > weekend
- **Per-month fill requirement:** If a month has 100 queries, distribute them across days with realistic clustering (e.g., 3–5 queries per active day, some days 0, some 8–10)

#### Customers (Business Customers)
- **Current:** ~200 customers
- **Expand to:** 400–500 customers with realistic geographic clustering
- **Distribution by type:** TH (Tạp hóa) 28% | GSO (Bách hóa) 34% | PHA (Nhà thuốc) 14% | SPS (Mẹ & Bé) 12% | BTS (Mỹ phẩm) 9% | OTHER+PLT+WMO (3%)
- **Geographic:** Concentrate in major provinces (HCMC 25%, Hà Nội 15%, Đà Nẵng 8%) with long tail distribution across others
- **Geo-location:** 70% of customers have `latitude/longitude` (is_geo_located = true)

#### Customer Purchases
- **Current:** ~500–800 purchase rows
- **Expand to:** 1,500–2,000 purchase records spanning 27 months
- **Distribution:** Realistic seasonal patterns (higher in Q1–Q2, lower in summer, peak again in Q4)
- **Per-month fill:** Every month Jan 2024 – Mar 2026 must have purchases; no zero-purchase months

#### Suppliers/NPP
- **Current:** 5 suppliers (NPP001–NPP005)
- **Expand to:** 8–10 suppliers with realistic names and province distribution
- **Rationale:** Check Distributor page needs sufficient data to show interesting pivots; 5 is too sparse

#### Products
- **Current:** 62 products from Danh_muc_san_pham_FULL.xlsx
- **Expand to:** Keep all 62, add 20–30 more from realistic veterinary medicine categories (kháng sinh, vitamin, vắc-xin, hormone, kháng ký sinh trùng)
- **Rationale:** Ton Kho and Nhap Hang pages need visible product diversity in charts

#### Chat Analytics
- **Expand to:** ~12,000 rows (1:1 with expanded conversations)
- **Distribution:** Drug groups (kháng sinh 35% | vitamin 20% | vắc-xin 18% | hormone 12% | kháng ký sinh trùng 10% | khác 5%), Animal types (trâu bò 30% | lợn 25% | gà 20% | chó mèo 15% | thủy sản 7% | khác 3%), Query types (điều trị 35% | chẩn đoán 28% | liều lượng 20% | phòng bệnh 12% | khác 5%)

#### Purchase Orders (Nhap Hang)
- **Current:** 86 orders (Jan 2024 – Mar 2026)
- **Expand to:** 120–150 orders with realistic monthly variation
- **Pattern:** 2–4 orders per month in 2024; 3–6 per month in 2025; 4–8 in 2026
- **Data fill:** Every month must have at least 1 order; no zero-order months

### Claude's Discretion

- **UI rendering issues:** Will be identified and fixed during implementation (user will describe in context if needed)
- **Bundle verification approach:** Manual inspection + ANALYZE flag as needed
- **Exact seed data row counts:** May adjust based on testing and dashboard responsiveness; the principle is "realistic non-linear distribution across full 27 months"

</decisions>

<specifics>
## Specific Ideas

- Seed data expansion is critical for final verification: sparse data (e.g., 5 suppliers, 80 users) looks incomplete in dashboards and masks real issues
- Vietnamese diacritics in PDF is a visible quality indicator — pre-embedding the font is the safe, user-friendly choice
- i18n dictionary extraction is low-risk maintenance work that improves code quality before shipping
- Rate limiting skip is justified since this is an internal admin tool with known, trusted users
- Print CSS is a quick win that makes the tool more professional and usable in hardcopy/PDF reports

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design specification (required)
- `docs/2026-03-18-admin-dashboard-design.md` §3 (Database) — All table schemas and materialized views
- `docs/2026-03-18-admin-dashboard-design.md` §4.1 (Critical Pre-Requisite) — Middleware wiring (proxy.ts confirmation)
- `docs/2026-03-18-admin-dashboard-design.md` §5 (API Routes) — All endpoint contracts
- `docs/2026-03-18-admin-dashboard-design.md` §6 (Export Toolbar Spec) — jsPDF, xlsx, print CSS requirements
- `docs/2026-03-18-admin-dashboard-design.md` §9 (Seed Data Strategy) — Original seed data specification (to be expanded in Phase 6)

### Prior phase contexts (reference for patterns)
- `.planning/phases/02-admin-shell-role-based-routing/02-CONTEXT.md` — Auth middleware pattern, requireAdmin() utility, dark theme CSS fix
- `.planning/phases/05-check-users-page-check-clinics-page/05-CONTEXT.md` — PDF export expectations, service role client usage pattern

### Environment & configuration
- `next.config.js` — CSP headers location
- `globals.css` — Dark theme and print media query location
- `lib/supabase/server.ts` — `createServiceClient()` location and pattern
- `package.json` — All dependency versions (to be verified after Phase 6 installation)

### No new specifications (Phase 6 is final polish, not new features)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `globals.css` — Contains Tailwind dark mode configuration and theme variables
- `lib/supabase/server.ts` — Exports `createServiceClient()` used throughout admin API routes
- `lib/admin/auth.ts` — Exports `requireAdmin()` used in all `/api/admin/*` routes
- `next.config.js` — Current CSP configuration (requires Leaflet tile server addition)
- `app/admin/layout.tsx` — Main admin shell (sidebar, top bar)
- All admin components in `components/admin/` — Use Recharts, Leaflet, @tanstack/react-table

### Build Output Targets
- `.next/static/chunks/*.js` — Client bundle (where service role client must NOT appear)
- `package-lock.json` — Lock file (to verify exact versions installed)

### Seed Data Files (to be expanded)
- `data/seeds/profiles.ts` — User/clinic staff seed (expand from 80→120+)
- `data/seeds/conversations.ts` — Chat sessions (expand from ~4k)
- `data/seeds/messages.ts` — Chat messages (expand from ~20k)
- `data/seeds/chat_analytics.ts` — Query categorization (expand to match conversations)
- `data/seeds/products.ts` — Product catalog (expand from 62)
- `data/seeds/suppliers.ts` — NPP distributors (expand from 5)
- `data/seeds/purchase_orders.ts` — Purchase order headers (expand)
- `data/seeds/purchase_order_items.ts` — Order line items (expand)
- (Also: `data/seeds/customers.ts`, `data/seeds/customer_purchases.ts` from Phase 4)
- `scripts/seed.ts` — Main seed runner (may need updates for expanded volume)

### Verification Checklist (use during Phase 6)
- [ ] `package.json` has `jspdf@^4.2.0`, recharts, react-leaflet, @tanstack/react-table, xlsx, jspdf-autotable, tsx
- [ ] `npm audit` shows no high/critical CVEs on admin dependencies
- [ ] `createServiceClient()` not in `.next/static/chunks/*.js` after `next build`
- [ ] `next.config.js` CSP includes `https://*.tile.openstreetmap.org` in `img-src` and `connect-src`
- [ ] `/admin/*` pages load Leaflet maps without CSP errors in browser console
- [ ] `@media print` CSS hides sidebar; `window.print()` shows only table
- [ ] PDF export from Check Users contains Vietnamese diacritics (Nguyễn, Hà Nội, etc.)
- [ ] Seed data spans full 27 months (Jan 2024 – Mar 2026) with realistic non-linear distribution
- [ ] `lib/i18n/vietnamese.ts` contains all Vietnamese UI labels; components use `VI.*` references

</code_context>

<deferred>
## Deferred Ideas

- **AI analysis panel** (v2) — LLM-generated insights from analytics data (e.g., "Query volume is 15% above last month's average")
- **Audit logging** (v2) — Admin action log with timestamp, user, action type
- **Real-time data** (v2) — Replace materialized view batch refresh with Supabase Realtime subscriptions
- **Multi-tenant admin accounts** (v2) — Clinic-level admin users with scoped data access
- **Vietnamese font licensing** (v2) — Evaluate Roboto SIL or Noto Sans licensing if pre-embedding adds legal/compliance concerns
- **Rate limiting for admin** — Deferred; internal tool with trusted users, not needed for v1

</deferred>

---

*Phase: 06-security-polish*
*Context gathered: 2026-03-28*
