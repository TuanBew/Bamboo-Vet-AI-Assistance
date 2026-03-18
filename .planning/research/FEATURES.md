# Feature Research: Admin SaaS Analytics Dashboard

**Domain:** Internal analytics dashboard for veterinary AI chatbot platform
**Researched:** 2026-03-18
**Confidence:** HIGH (spec is finalized v3; feature scope is locked)

## Feature Landscape

This analysis maps the spec's 7 feature groups against industry norms for admin analytics dashboards. The spec is the source of truth -- this document categorizes what is table stakes vs differentiating, flags implementation risk, and identifies anti-features already wisely excluded.

---

### Table Stakes (Admins Expect These)

Features that any competent analytics dashboard ships with. Missing these = the dashboard feels broken or toy-like.

| # | Feature Group | Why Expected | Complexity | Risk Level | Notes |
|---|---------------|--------------|------------|------------|-------|
| 1 | **KPI cards with labels and values** | Every analytics dashboard opens with headline numbers. Admins need instant "how are we doing" at a glance. | LOW | LOW | Spec defines 5 platform-wide KPIs from `mv_dashboard_kpis`. Single-row SELECT, trivial to render. The unfiltered-KPI decision is correct -- mixing filtered KPIs with filtered charts causes cognitive dissonance. |
| 2 | **Time-series line/area charts** | Trend over time is the most fundamental analytics visualization. Without it, a dashboard is just a report. | MEDIUM | MEDIUM | Spec uses Recharts AreaChart with monthly granularity (27 months of data). Straightforward with Recharts. Risk is in axis formatting for Vietnamese month labels and responsive sizing. |
| 3 | **Category breakdown charts (donuts/pie)** | Admins expect to see distribution across categories (drug group, animal type, query type). Standard drill-down pattern. | LOW | LOW | 6 donut charts on dashboard, 3 on new-activity. PieChart in Recharts is well-documented. Keep legends readable -- Vietnamese category names can be long. |
| 4 | **Paginated data tables with search** | Raw data access is non-negotiable. Admins always want to see the actual rows, not just aggregations. | MEDIUM | LOW | @tanstack/react-table is the correct choice -- headless, composable, handles pagination/sorting/filtering. Spec correctly scopes search to client-side text filter on loaded data. |
| 5 | **Filter bar (province, clinic type, year/month)** | Slicing data by geography and category is expected for any regional analytics tool. | MEDIUM | MEDIUM | Spec defines filter bars per page with appropriate scope. Key design: filters affect charts but NOT KPI cards on dashboard page. This is a common source of user confusion if not labeled clearly. |
| 6 | **Data export (Excel at minimum)** | Admins always export to Excel. This is the most requested feature in any data dashboard. Not having it is a dealbreaker. | MEDIUM | MEDIUM | `xlsx` library handles both .xlsx and .csv generation client-side. Spec wisely limits export formats per page (not all 5 everywhere). Risk: large pivot table exports can freeze the browser if not chunked. |
| 7 | **Admin auth gate** | Internal tools must be access-controlled. An analytics dashboard without auth is a security incident waiting to happen. | LOW | LOW | `is_admin` in profiles + `requireAdmin()` utility. Standard pattern. Two-hop redirect is slightly unusual but works. |
| 8 | **Responsive layout with sidebar navigation** | Admins use dashboards on various screens. Sidebar nav is the standard pattern for multi-page analytics. | MEDIUM | LOW | Dark sidebar with collapsible mobile hamburger. shadcn/ui provides the primitives. 7-page navigation is well-scoped. |
| 9 | **Manual data refresh** | When data is batch-computed (materialized views), admins need a visible refresh trigger and "last updated" timestamp. | LOW | LOW | "Lam moi du lieu" button triggers server action. Shows `refreshed_at`. Simple and correct. |

---

### Differentiators (Makes This Dashboard Excellent)

Features that go beyond basics. Not expected, but they make the dashboard genuinely useful rather than just adequate.

| # | Feature Group | Value Proposition | Complexity | Risk Level | Notes |
|---|---------------|-------------------|------------|------------|-------|
| 1 | **KPI trend indicators (delta/sparkline)** | Showing "1,234 queries (+12% vs last month)" transforms a static number into actionable insight. The sparkline in the user table gives instant per-user trend without clicking. | MEDIUM | LOW | Spec includes `SparklineChart` component (12-month mini Recharts LineChart) in user table rows. For KPI cards, spec shows large number + label but does not explicitly define month-over-month delta arrows. **Recommendation:** Add a `trend` field (percentage change vs prior period) to KPI cards -- trivial to compute from `mv_monthly_queries`, massive UX uplift. |
| 2 | **Time-series forecasting (3-month projection)** | Forecasting transforms a dashboard from "what happened" to "what will happen." Linear regression on 6 months is simple but powerful for trend communication. | HIGH | HIGH | Server-side linear regression in `lib/admin/forecast.ts`. Rendered as dotted line via `strokeDasharray="4 4"`. **This is the highest-risk differentiator.** Pitfalls: (1) forecast on volatile data gives misleading projections, (2) visual distinction between real and forecast must be obvious or admins will quote forecast numbers as fact, (3) negative forecasts need clamping to zero. |
| 3 | **Geographic map visualization (Leaflet pins)** | Seeing clinic distribution on a Vietnam map gives instant geographic insight that no table can replicate. Admins can spot coverage gaps visually. | HIGH | HIGH | Two map instances: dashboard overview + full-width check-users map. react-leaflet with `dynamic(() => import(), { ssr: false })` for Next.js SSR compatibility. **Key risks:** (1) Leaflet CSS must be imported or map tiles break, (2) map container needs explicit height or it collapses to 0px, (3) with 80 users this is fine, but marker clustering should be planned for growth. Color-coding by clinic_type is a nice touch. |
| 4 | **Color-coded pivot tables** | Heat-map-style cell coloring (green/yellow/red/grey) makes patterns jump out of dense numeric tables. Admins can spot underperforming clinics instantly without reading every number. | HIGH | HIGH | Two pivot tables: monthly user pivot (check-users) and monthly clinic pivot (check-clinics) with color thresholds (>50 green, 10-50 yellow, 1-9 red, 0 grey). **Implementation risk:** TanStack Table is headless -- color logic is custom JSX in cell renderers, not a built-in feature. The clinic pivot has 12 month columns + 5 metadata columns = 17 columns. Horizontal scroll on smaller screens needs careful handling. |
| 5 | **User conversation history drawer** | Being able to inspect what a specific user asked (read-only chat view) is extremely valuable for understanding usage patterns and content quality. | MEDIUM | MEDIUM | shadcn Sheet (right-side drawer) with conversation list then message detail. Two API calls: list conversations, then load messages. **Risk:** Lazy-loading conversation content is correct, but the drawer needs loading states and empty states. Long conversations need ScrollArea. |
| 6 | **Clinic detail modal (daily breakdown grid)** | Drilling from a monthly clinic cell into a day-by-day, staff-by-staff grid gives the deepest level of insight. This is power-user territory. | HIGH | HIGH | Dark Dialog with daily grid (31 columns + staff rows). Same color-coding as pivot table. **This is the most complex UI component in the entire dashboard.** Dynamic column count (28-31 days per month), multiple staff per clinic, dual values per cell (queries + sessions). Must handle months with varying day counts. |
| 7 | **PDF export with auto-table formatting** | PDF export is expected for formal reports. `jspdf-autotable` handles table-to-PDF conversion well. | MEDIUM | MEDIUM | Only on check-users page. **Risk:** Vietnamese characters (diacritics) require embedded fonts in jsPDF. Default fonts do not support Vietnamese. Must register a Unicode-capable font (e.g., Roboto) or Vietnamese text renders as rectangles. This is the single most commonly missed pitfall in jsPDF Vietnamese projects. |
| 8 | **Print-optimized view** | `window.print()` with `@media print` CSS to hide sidebar. Simple but shows polish. | LOW | LOW | Only on check-users page. Need `@media print` rules to hide sidebar, top bar, filter bar. Tables need page-break-inside: avoid on rows. |
| 9 | **Horizontal stacked bar charts per user row** | Inline charts showing drug group and query type breakdown per user in the table itself -- no need to drill down. | MEDIUM | MEDIUM | Two mini BarCharts per row in the user table. Recharts handles this but rendering many chart instances in a table can impact scroll performance. Consider virtualizing rows if the table grows beyond ~50 rows. |

---

### Anti-Features (Deliberately NOT Building)

These are explicitly out of scope per spec. Each exclusion is well-reasoned.

| Anti-Feature | Why It Seems Appealing | Why Correctly Excluded | What to Do Instead |
|--------------|------------------------|------------------------|--------------------|
| **Real-time data / WebSocket updates** | Dashboards that update live feel modern and impressive. | Materialized views are batch-refreshed by design. Real-time adds massive infrastructure complexity (WebSocket server, event streaming from RAGflow) for an internal tool with 2 admins. The ROI is negative. | Manual refresh button with `refreshed_at` timestamp. Admins know data is fresh enough. |
| **Multi-tenant clinic admin accounts** | Clinics managing their own users seems natural for a SaaS. | This is an internal analytics tool, not a self-serve platform. Multi-tenancy adds RLS complexity, role hierarchies, and onboarding flows that are premature. | Single admin role, SQL-promoted only. Scope expansion happens in a future milestone if needed. |
| **Admin-UI role promotion** | A "Make Admin" button in the UI is convenient. | Security risk. Accidental admin promotion in an internal tool is worse than the inconvenience of running SQL. | `UPDATE profiles SET is_admin = true WHERE email = '...'` in Supabase SQL editor. |
| **Stripe / payments / monetization** | Tracking revenue alongside usage analytics is valuable for SaaS. | Premature. No monetization model exists yet. Adding payment infrastructure now creates maintenance burden with zero revenue. | Defer to a future milestone when business model is validated. |
| **Notification system** | Alerts when usage spikes or drops seem useful. | Over-engineering for 80 seeded users. Alert thresholds, delivery channels, and quiet hours are complex. The admin checks the dashboard manually. | The dashboard itself is the notification -- admins visit it to see what is happening. |
| **English language support in admin** | Bilingual support seems consistent with the chatbot (Product A). | All admin operators are Vietnamese. Adding i18n to admin doubles string management workload for zero users. | Vietnamese-only. Hard-coded strings, no i18n framework overhead. |
| **Audit logging** | Tracking who viewed/exported what is good security practice. | Internal tool with 2 admins. The logging infrastructure (event tables, retention policies, viewer UI) costs more than the risk it mitigates at this scale. | Defer to future milestone if admin count grows or compliance requires it. |
| **Mobile app / React Native** | Mobile access to analytics sounds useful. | Desktop-first analytics with 17-column pivot tables does not translate to mobile. Responsive web on tablet is the practical ceiling. | Responsive sidebar collapse + horizontal scroll on tables. No native app. |
| **External data integrations** | Connecting to RAGflow analytics or external data sources. | Seed data only. Live RAGflow event capture requires event pipeline architecture that is out of scope. | All data is seeded. Analytics reflect the seed dataset, not live production. |

---

## Feature Dependencies

```
Database Schema (profiles, chat_analytics, kb_documents)
    |
    +---> Materialized Views (mv_dashboard_kpis, mv_monthly_queries, etc.)
    |        |
    |        +---> KPI Cards (reads mv_dashboard_kpis)
    |        +---> Time-Series Charts (reads mv_monthly_queries)
    |        +---> Category Donuts (reads mv_category_stats)
    |        +---> Pivot Tables (reads mv_monthly_queries, mv_daily_queries)
    |        +---> Forecast (computes from mv_monthly_queries)
    |
    +---> Seed Data (populates all tables)
    |        |
    |        +---> Refresh Views Script (must run after seed)
    |
    +---> Admin Auth Gate (reads profiles.is_admin)
    |        |
    |        +---> Middleware fix (proxy.ts -> middleware.ts) [MUST be first]
    |        +---> requireAdmin() utility
    |        +---> All API routes depend on this
    |
    +---> Admin Layout Shell (sidebar + top bar)
             |
             +---> All 7 admin pages depend on this
             +---> Filter Bar component (reused across pages)
             +---> DataTable component (reused across pages)
             +---> Export Toolbar (depends on DataTable)

Map Visualization
    +---> Requires profiles with latitude/longitude (seed data)
    +---> Requires dynamic import (SSR: false) for Leaflet

Conversation History Drawer
    +---> Requires dedicated API routes (/users/[userId]/conversations)
    +---> Requires conversations + messages tables (existing)

Clinic Detail Modal
    +---> Requires mv_daily_queries materialized view
    +---> Requires facility_code grouping in profiles
    +---> Requires ColorPivotTable component (shared with clinic pivot)
```

### Dependency Notes

- **Middleware fix must be Phase 1:** Nothing works without `middleware.ts` correctly wired. No admin auth, no route protection.
- **Database + seed before any UI:** All pages read from materialized views. Views need tables. Tables need seed data.
- **Admin layout before pages:** All pages render inside the shared layout shell. Build shell first, then pages.
- **DataTable before exports:** Export toolbar is part of DataTable component. Build the table, then add export buttons.
- **FilterBar is cross-cutting:** Used on dashboard, check-users, check-clinics. Build as reusable component early.
- **Clinic detail modal depends on pivot table:** The modal opens from a pivot table row click. Build pivot table first.

---

## High-Risk Features (Commonly Done Wrong)

These features from the spec deserve extra implementation attention because they have well-known pitfalls.

### 1. Leaflet Maps in Next.js (SSR Incompatibility)
**What goes wrong:** Leaflet accesses `window` and `document` on import. Next.js SSR crashes with "window is not defined."
**Prevention:** The spec correctly prescribes `dynamic(() => import(...), { ssr: false })`. Additionally, Leaflet CSS must be imported in the component or layout -- missing CSS causes invisible/broken map tiles. The map container **must** have an explicit pixel or percentage height; `height: auto` results in a 0px-tall invisible map.
**Confidence:** HIGH -- this is the most commonly reported Leaflet + Next.js issue.

### 2. Vietnamese Diacritics in PDF Export (jsPDF)
**What goes wrong:** jsPDF default fonts (Helvetica, Courier, Times) do not include Vietnamese glyphs. Characters like "a, o, u, d" render as empty rectangles or question marks.
**Prevention:** Embed a Unicode-capable font (Roboto, Noto Sans, or a Vietnamese-specific font) via `doc.addFont()` before generating content. This adds ~200KB to client bundle but is non-negotiable for Vietnamese PDF output.
**Confidence:** HIGH -- documented issue in jsPDF GitHub with hundreds of reports.

### 3. Forecast Visual Distinction
**What goes wrong:** Users treat projected data as actual data. If the dotted line is not visually distinct enough, admins will report forecast numbers in meetings as real metrics.
**Prevention:** Use `strokeDasharray="4 4"` (spec-defined), different color/opacity for forecast segment, and a clear legend label ("Du bao" vs "Thuc te"). Consider adding a shaded background region behind the forecast area. Clamp negative forecast values to zero.
**Confidence:** MEDIUM -- based on analytics dashboard design patterns.

### 4. Pivot Table Horizontal Scroll
**What goes wrong:** 17-column clinic pivot table (5 metadata + 12 months) overflows on screens < 1440px. Without proper horizontal scroll, columns either compress to unreadable widths or break the layout.
**Prevention:** Wrap table in a container with `overflow-x: auto`. Pin the first few identifier columns (region, clinic name) so they stay visible during horizontal scroll. TanStack Table supports column pinning natively.
**Confidence:** HIGH -- standard wide-table UX problem.

### 5. Clinic Detail Modal with Dynamic Day Columns
**What goes wrong:** February has 28/29 days, other months have 30/31. Hardcoding 31 columns creates empty cells that confuse admins. Dual values per cell (queries on top, sessions below) can make cells too tall or text too small.
**Prevention:** Dynamically compute day count for the selected month/year. Use a compact cell layout (e.g., "12/3" format or stacked micro-text). Test with months that have 28 and 31 days.
**Confidence:** MEDIUM -- specific to this spec's design.

### 6. Cascading Province/District Filters
**What goes wrong:** When province changes, district dropdown must reset and repopulate. If state management is sloppy, stale district values persist after province change, causing empty or incorrect query results.
**Prevention:** Use controlled components with explicit state reset. When province changes: (1) clear district selection, (2) filter district options from static data, (3) re-fetch data with new province + cleared district. Store Vietnamese province/district data as a static JSON lookup -- no API calls needed for dropdown population.
**Confidence:** HIGH -- cascading dropdown is a well-known React state management challenge.

### 7. Large Excel Export Browser Freeze
**What goes wrong:** `xlsx` library generates files synchronously on the main thread. For the monthly pivot table (80 users x 27 months = 2,160 cells), this is fine. But if data grows, the browser freezes during generation.
**Prevention:** For current scale (80 users), synchronous generation is acceptable. If user count exceeds ~500, consider Web Worker offloading. For now, show a loading spinner during export and disable the button to prevent double-clicks.
**Confidence:** MEDIUM -- current scale is safe, flagging for future growth.

---

## MVP Definition

### Launch With (v1 -- all 6 phases per spec)

The spec defines a complete v1. All features below are in-scope for initial delivery.

- [ ] **Database + seed + materialized views** -- foundation; nothing works without data
- [ ] **Middleware fix + admin auth gate** -- security prerequisite
- [ ] **Admin layout shell (sidebar + top bar + refresh)** -- container for all pages
- [ ] **Dashboard page (KPIs + charts + user table + map)** -- primary admin landing page
- [ ] **New Activity page (monthly drill-down)** -- secondary analytics view
- [ ] **Knowledge Base page (document stats + table)** -- KB health monitoring
- [ ] **Users Analytics page (user stats + breakdowns)** -- user engagement view
- [ ] **Check Users page (map + table + pivot + drawer)** -- user data explorer
- [ ] **Check Clinics page (pivot + detail modal)** -- clinic data explorer
- [ ] **Settings page (profile + refresh)** -- minimal admin self-service
- [ ] **Export (Excel/CSV/PDF/Print/Copy)** -- data extraction per page spec

### Add After Validation (v1.x -- if admins request)

- [ ] **Month-over-month delta on KPI cards** -- add `trend` percentage to KpiCard component
- [ ] **Marker clustering on maps** -- when user count exceeds ~200
- [ ] **Row virtualization on large tables** -- when datasets grow beyond seed volume
- [ ] **Saved filter presets** -- if admins repeatedly apply the same province/type combos
- [ ] **CSV import for bulk profile updates** -- if manual SQL updates become tedious

### Future Consideration (v2+)

- [ ] **Live data pipeline** -- replace seed data with RAGflow event capture
- [ ] **Multi-tenant clinic admin accounts** -- if business model requires self-serve
- [ ] **Audit logging** -- if compliance or admin count warrants it
- [ ] **Notification/alerting system** -- if proactive monitoring is needed
- [ ] **Advanced forecasting (ARIMA/seasonal)** -- if linear regression proves too naive

---

## Feature Prioritization Matrix

| Feature | Admin Value | Implementation Cost | Risk | Priority |
|---------|-------------|---------------------|------|----------|
| Middleware fix | CRITICAL | LOW | LOW | P0 |
| Database schema + migrations | CRITICAL | MEDIUM | LOW | P0 |
| Seed data script | CRITICAL | HIGH | MEDIUM | P0 |
| Admin auth gate (requireAdmin) | CRITICAL | LOW | LOW | P0 |
| Admin layout shell | HIGH | MEDIUM | LOW | P1 |
| KPI cards | HIGH | LOW | LOW | P1 |
| Time-series area charts | HIGH | MEDIUM | MEDIUM | P1 |
| Category donut charts | MEDIUM | LOW | LOW | P1 |
| Paginated DataTable | HIGH | MEDIUM | LOW | P1 |
| Filter bar (province/type/month) | HIGH | MEDIUM | MEDIUM | P1 |
| Excel export | HIGH | MEDIUM | MEDIUM | P1 |
| Leaflet map (dashboard) | MEDIUM | HIGH | HIGH | P2 |
| Leaflet map (check-users full-width) | MEDIUM | HIGH | HIGH | P2 |
| Forecast dotted line | MEDIUM | HIGH | HIGH | P2 |
| Color-coded pivot table (clinics) | HIGH | HIGH | HIGH | P2 |
| Color-coded pivot table (users monthly) | MEDIUM | HIGH | HIGH | P2 |
| Clinic detail modal (daily grid) | MEDIUM | HIGH | HIGH | P2 |
| Conversation history drawer | MEDIUM | MEDIUM | MEDIUM | P2 |
| Sparkline charts in table | LOW | MEDIUM | LOW | P2 |
| PDF export | LOW | MEDIUM | HIGH | P3 |
| Print view | LOW | LOW | LOW | P3 |
| Copy to clipboard | LOW | LOW | LOW | P3 |
| CSV export | LOW | LOW | LOW | P3 |
| Inline stacked bar charts per user | LOW | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P0: Must exist before any UI work begins (infrastructure)
- P1: Core dashboard experience -- what admins interact with daily
- P2: Power-user features -- differentiators that make the dashboard excellent
- P3: Nice-to-have polish -- valuable but not critical for initial usability

---

## Spec Coverage Assessment

The spec is unusually thorough. Key strengths:

1. **API response shapes are fully typed** -- eliminates frontend-backend ambiguity
2. **Materialized views are pre-designed** -- no per-request computation debates
3. **Export scope is per-page** -- avoids "export everything everywhere" bloat
4. **Out of scope is explicit** -- prevents scope creep
5. **Color thresholds are defined** -- no design ambiguity for pivot cells
6. **Component list is complete** -- 10 shared components with clear responsibilities

Key gaps to address during implementation:

1. **Loading states** -- spec does not define skeleton/spinner patterns for async data
2. **Error states** -- what happens when API calls fail? No error UI defined
3. **Empty states** -- what does a chart look like with zero data for a filter combination?
4. **Mobile breakpoints** -- sidebar collapse is mentioned but table/chart responsive behavior is not detailed
5. **Accessibility** -- no ARIA labels or keyboard navigation spec for custom components

---

## Sources

- [SaaS Dashboard UI/UX Strategies](https://www.aufaitux.com/blog/saas-dashboard-ui-ux-design-strategies) -- KPI card design patterns
- [TanStack Table Cells Guide](https://tanstack.com/table/v8/docs/guide/cells) -- conditional cell rendering for color-coded pivots
- [Leaflet Developer Guide for React](https://andrejgajdos.com/leaflet-developer-guide-to-high-performance-map-visualizations-in-react/) -- performance and SSR considerations
- [Recharts Dashed Line Chart](https://recharts.github.io/en-US/examples/DashedLineChart/) -- strokeDasharray for forecast lines
- [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) -- future clustering when user count grows
- [shadcn/ui Sheet component](https://ui.shadcn.com/docs/components/radix/sheet) -- drawer pattern for conversation history
- [Cascading Dropdowns in React](https://www.freecodecamp.org/news/how-to-build-dependent-dropdowns-in-react/) -- dependent filter pattern
- [jsPDF + jspdf-autotable](https://github.com/tannerlinsley/react-table/discussions/2513) -- PDF export from table data

---
*Feature research for: Bamboo Vet Admin SaaS Analytics Dashboard*
*Researched: 2026-03-18*
