# Domain Pitfalls

**Domain:** Admin analytics dashboard (Next.js 15 App Router + Supabase + Recharts + Leaflet)
**Researched:** 2026-03-18

---

## Critical Pitfalls

Mistakes that cause broken deployments, security incidents, or require rewrites.

---

### Pitfall 1: `proxy.ts` Is Not Middleware — No Guards Run Today

**What goes wrong:** The project root has `proxy.ts` exporting a function named `proxy`. Next.js App Router ignores this entirely. It only recognizes `middleware.ts` (or `middleware.js`) at the project root with a named export `middleware`. As a result, **zero middleware executes today** — no session refresh, no auth guards, no route protection.

**Why it happens:** An earlier rename or naming convention error. The `config.matcher` is correctly written, and `lib/supabase/middleware.ts` (`updateSession`) is correct — but the entry point file has the wrong name and wrong export name.

**Consequences:** Adding `/admin/*` guards to `updateSession()` will have no effect until the file is renamed. Deploying admin pages without this fix exposes them to unauthenticated access. Existing `/app` routes are also unprotected (the guard in `updateSession` line 30 never runs).

**Warning signs:**
- Navigating to `/app` while logged out does NOT redirect to `/login`
- `console.log` in `updateSession` never fires
- Supabase session cookies are never refreshed (silent auth expiry)

**Prevention:**
1. Rename `proxy.ts` to `middleware.ts` at project root
2. Rename the exported function from `proxy` to `middleware`
3. Keep the `config` export unchanged

```typescript
// middleware.ts (project root)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Detection:** Add a smoke test: `curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/app` should redirect to `/login` when not authenticated. If it returns the `/app` page, middleware is not running.

**Phase:** Phase 2 (Auth & Middleware) — must be the very first task before any admin guard logic.

**Confidence:** HIGH — verified by reading `proxy.ts` directly; Next.js docs confirm the naming requirement.

---

### Pitfall 2: Supabase Service Role Client Leaking to Client Bundle

**What goes wrong:** `createServiceClient()` in `lib/supabase/server.ts` reads `SUPABASE_SERVICE_ROLE_KEY` from `process.env`. If any client component (`'use client'`) imports from this file — even indirectly — the bundler may include the service client factory in the client bundle. While the env var itself won't resolve at runtime (Next.js only exposes `NEXT_PUBLIC_*` to the client), the import chain signals a severe architectural boundary violation that can cause confusing runtime errors and may leak the key in edge cases (e.g., if someone adds `NEXT_PUBLIC_` prefix by mistake).

**Why it happens:** Admin page components need data from service-role API routes. A developer shortcuts by importing `createServiceClient()` directly in a client component instead of calling the API route via `fetch`.

**Consequences:** Bundle includes server-only code. At minimum: runtime crash (`cookies()` not available). At worst: accidental exposure of the service role key if env var naming is changed carelessly.

**Warning signs:**
- Build warnings about `cookies` from `next/headers` being used in a client component
- `Module not found: Can't resolve 'next/headers'` in client bundle
- Any import of `lib/supabase/server.ts` in a file with `'use client'`

**Prevention:**

1. Add the `server-only` package to enforce the boundary:

```bash
npm install server-only
```

2. Add the import at the top of `lib/supabase/server.ts`:

```typescript
import 'server-only'
// ... rest of the file
```

This causes a build-time error if any client component imports from this module.

3. Architectural rule: Client components fetch from `/api/admin/*` routes. They never import from `lib/supabase/server.ts` or `lib/admin/auth.ts`.

4. Every admin API route uses the pattern:
```typescript
// app/api/admin/dashboard/route.ts
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const db = createServiceClient()
  // ... query with db
}
```

**Phase:** Phase 2 (Auth & Middleware) — add `server-only` when creating `requireAdmin()`.

**Confidence:** HIGH — standard Next.js pattern documented in official docs; `server-only` package is an official React team recommendation.

---

### Pitfall 3: Supabase RLS Blocking Trigger Inserts on `profiles`

**What goes wrong:** The `handle_new_user()` trigger fires `AFTER INSERT ON auth.users` to create a `profiles` row. But `auth.users` triggers run under the `supabase_auth_admin` role, which does NOT have RLS bypass privileges. If the `profiles` table has RLS enabled with no INSERT policy for this role, the trigger silently fails — new users register successfully but have no `profiles` row.

**Why it happens:** RLS is enabled on `profiles` (as required — users should only see their own row). But the trigger function defaults to `SECURITY INVOKER`, which runs with the caller's privileges (`supabase_auth_admin`), not the function owner's.

**Consequences:** Every new user signup creates an `auth.users` row but no `profiles` row. The admin dashboard shows zero users. The `is_admin` check in middleware fails (no profile found). Debugging is hard because Supabase does not surface trigger errors in the dashboard UI — you must check Postgres logs.

**Warning signs:**
- New user signs up, but `SELECT * FROM profiles WHERE email = 'new@user.com'` returns nothing
- Admin dashboard user count is 0 despite having registrations
- Middleware `is_admin` check always returns false/null

**Prevention:** The trigger function MUST use `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

`SECURITY DEFINER` runs the function as the role that created it (typically `postgres`, which has `bypassrls`). This is the standard Supabase pattern for `auth.users` triggers.

Additionally, set the `search_path` to prevent privilege escalation:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Detection:** After running migrations, create a test user via `supabase.auth.signUp()` and immediately query `profiles`. If the row is missing, the trigger is broken.

**Phase:** Phase 1 (Database & Migrations) — must be correct in the initial migration file.

**Confidence:** HIGH — confirmed in Supabase official docs and community discussions. This is the single most common Supabase trigger mistake.

---

### Pitfall 4: Materialized View `REFRESH CONCURRENTLY` Fails Without Unique Index

**What goes wrong:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires at least one `UNIQUE` index on the view that covers all rows (no `WHERE` clause, no expression — only column names). If the unique index is missing, Postgres throws: `ERROR: cannot refresh materialized view concurrently. Create a UNIQUE index with no WHERE clause on one or more columns of the materialized view.`

**Why it happens:** The migration creates the view but forgets the `CREATE UNIQUE INDEX` statement. Or the unique index is added on the wrong columns (allowing duplicates in the view output), which causes the index creation itself to fail.

**Consequences:** The "Lam moi du lieu" (refresh data) button in the admin top bar calls `refresh-views.ts`, which crashes. Stale data persists. If the error is caught silently, admins see outdated analytics with no indication of failure.

**Warning signs:**
- The refresh button triggers an error or hangs
- Analytics data does not update after seeding new data
- Postgres logs show the `cannot refresh...concurrently` error

**Prevention:**

1. Every migration that creates a materialized view must ALSO create its unique index in the same file:

```sql
-- mv_monthly_queries
CREATE MATERIALIZED VIEW mv_monthly_queries AS
SELECT ... GROUP BY ca.user_id, year, month;

CREATE UNIQUE INDEX ON mv_monthly_queries (user_id, year, month);
```

```sql
-- mv_daily_queries
CREATE MATERIALIZED VIEW mv_daily_queries AS
SELECT ... GROUP BY ca.user_id, year, month, day;

CREATE UNIQUE INDEX ON mv_daily_queries (user_id, year, month, day);
```

```sql
-- mv_category_stats
CREATE MATERIALIZED VIEW mv_category_stats AS
SELECT ... GROUP BY year, month, province, clinic_type, drug_group, animal_type, query_type;

CREATE UNIQUE INDEX ON mv_category_stats (year, month, province, clinic_type, drug_group, animal_type, query_type);
```

2. **Exception: `mv_dashboard_kpis`** produces a single aggregate row with no natural unique key. It CANNOT use `CONCURRENTLY`. The refresh script must handle this differently:

```typescript
// scripts/refresh-views.ts
const concurrentViews = [
  'mv_monthly_queries',
  'mv_daily_queries',
  'mv_category_stats',
];
const nonConcurrentViews = ['mv_dashboard_kpis'];

for (const view of concurrentViews) {
  await db.rpc('', undefined); // or raw SQL:
  const { error } = await supabase.rpc('refresh_view', { view_name: view });
  // Actually, use raw SQL via supabase-js:
}

// Use the postgres connection directly via supabase management API or pg client
// REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_queries;
// REFRESH MATERIALIZED VIEW mv_dashboard_kpis;  -- NO concurrently
```

3. **NULL columns in the unique index for `mv_category_stats`:** If `province`, `clinic_type`, `drug_group`, `animal_type`, or `query_type` can be NULL, multiple rows with the same set of NULLs will violate uniqueness expectations. Use `COALESCE` in the view:

```sql
CREATE MATERIALIZED VIEW mv_category_stats AS
SELECT
  EXTRACT(YEAR FROM c.created_at)::int AS year,
  EXTRACT(MONTH FROM c.created_at)::int AS month,
  COALESCE(p.province, '__none__') AS province,
  COALESCE(p.clinic_type, '__none__') AS clinic_type,
  COALESCE(ca.drug_group, '__none__') AS drug_group,
  COALESCE(ca.animal_type, '__none__') AS animal_type,
  COALESCE(ca.query_type, '__none__') AS query_type,
  COUNT(*) AS count
FROM conversations c
JOIN chat_analytics ca ON ca.conversation_id = c.id
JOIN profiles p ON p.id = ca.user_id
GROUP BY year, month, province, clinic_type, drug_group, animal_type, query_type;
```

Without `COALESCE`, PostgreSQL unique indexes treat each NULL as distinct, which means the index may not prevent duplicate rows for the `CONCURRENTLY` algorithm.

**Phase:** Phase 1 (Database & Migrations) — unique indexes must be in the same migration file as the views.

**Confidence:** HIGH — PostgreSQL official documentation explicitly states the unique index requirement.

---

### Pitfall 5: Leaflet SSR Hydration Error — `window is not defined`

**What goes wrong:** Leaflet directly accesses the DOM (`window`, `document`) at import time. Any server-side rendering of a component that imports `leaflet` or `react-leaflet` crashes with `ReferenceError: window is not defined`.

**Why it happens:** Next.js App Router renders components on the server by default. Even `'use client'` components go through an initial server render. `import L from 'leaflet'` or `import { MapContainer } from 'react-leaflet'` executes Leaflet's initialization code which touches `window`.

**Consequences:** Build failure or runtime crash on any page that uses Leaflet. If caught late, it blocks the entire Dashboard and Check Users pages.

**Warning signs:**
- `ReferenceError: window is not defined` during `next build` or dev server
- Error traces pointing to `node_modules/leaflet/dist/leaflet-src.js`

**Prevention:** Use Next.js `dynamic()` with `ssr: false` for the map wrapper component. Never import `leaflet` or `react-leaflet` in a server-rendered file.

```typescript
// components/admin/MapView.tsx
'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon paths (another common Leaflet + bundler issue)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

interface MapViewProps {
  pins: Array<{ lat: number; lng: number; label: string; count?: number }>
  center?: [number, number]
  zoom?: number
}

export default function MapView({ pins, center = [16.0, 106.0], zoom = 6 }: MapViewProps) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-[400px] w-full rounded-lg">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {pins.map((pin, i) => (
        <Marker key={i} position={[pin.lat, pin.lng]}>
          <Popup>{pin.label}{pin.count != null && ` (${pin.count})`}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

```typescript
// In the page or parent component that uses the map:
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/admin/MapView'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full rounded-lg bg-gray-800 animate-pulse" />,
})
```

**Also required: CSP update.** The current `next.config.js` CSP has `img-src 'self' data: https:` which allows all HTTPS images (tiles will work). But if CSP is ever tightened, add `*.tile.openstreetmap.org` explicitly to `img-src`.

**Also required: Copy Leaflet marker assets** to `public/leaflet/` or configure a custom icon path. The default Leaflet marker icons are referenced via CSS but bundlers break the paths.

**Phase:** Phase 4 (Dashboard Page) — first page that uses the map component.

**Confidence:** HIGH — confirmed in react-leaflet GitHub issues (#1152, #956) and all Next.js + Leaflet guides.

---

### Pitfall 6: Recharts `ResponsiveContainer` Renders 0x0 in SSR

**What goes wrong:** `ResponsiveContainer` uses the browser `ResizeObserver` API to measure its parent element. During server-side rendering (or the initial server pass of a `'use client'` component), there is no DOM to measure. The container renders with width=0 and height=0, producing an invisible chart. On hydration it may flash to correct size, but logs fill with warnings.

**Why it happens:** Recharts is a client-side library that relies on DOM measurement. Even with `'use client'`, the component's initial render happens on the server.

**Consequences:** Charts appear blank on initial load. Console floods with `The width(0) and height(0) of chart should be greater than 0` warnings. Layout shift when the chart pops in after hydration.

**Warning signs:**
- Charts are invisible until a window resize or state change
- Console warnings about 0 width/height
- Layout jumps after page load

**Prevention:** Wrap all Recharts components in a dedicated client component. Set explicit `minHeight` on the parent container so `ResponsiveContainer` has something to measure during the first client render.

```typescript
// components/admin/ChartWrapper.tsx
'use client'

import { ResponsiveContainer } from 'recharts'
import { type ReactNode } from 'react'

interface ChartWrapperProps {
  children: ReactNode
  height?: number
  className?: string
}

export function ChartWrapper({ children, height = 300, className }: ChartWrapperProps) {
  return (
    <div className={className} style={{ width: '100%', minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  )
}
```

Usage:
```typescript
<ChartWrapper height={350}>
  <BarChart data={monthlyData}>
    <XAxis dataKey="month" />
    <YAxis />
    <Bar dataKey="query_count" fill="#06b6d4" />
  </BarChart>
</ChartWrapper>
```

Key rules:
- Every chart page file must have `'use client'` at the top (or the chart section must be a client component)
- `ResponsiveContainer` must be inside a parent `div` that has an explicit `width` and `height`/`minHeight`
- Never import Recharts in a Server Component

**Phase:** Phase 4 (Dashboard Page) — establish the `ChartWrapper` pattern on the first chart page, reuse everywhere.

**Confidence:** HIGH — well-documented Recharts limitation; confirmed in recharts/recharts#1579.

---

## Moderate Pitfalls

---

### Pitfall 7: `xlsx` Library Bloating Client Bundle (~800KB+)

**What goes wrong:** `import * as XLSX from 'xlsx'` pulls in the entire SheetJS library including codepage tables, XML parsers, and format readers — even if you only need `writeFile`. The full bundle is ~800KB+ minified, significantly increasing page load time.

**Why it happens:** SheetJS is a monolithic library with limited tree-shaking support (class-based architecture). The standard import pulls everything.

**Prevention:**

1. Use `writeFileXLSX` from the ESM export (write-only, much smaller):

```typescript
import { utils, writeFileXLSX } from 'xlsx'

function exportToExcel(data: any[], filename: string) {
  const ws = utils.json_to_sheet(data)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Sheet1')
  writeFileXLSX(wb, `${filename}.xlsx`)
}
```

2. Dynamic import so it never enters the initial bundle:

```typescript
async function exportToExcel(data: any[], filename: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

3. For CSV export, avoid `xlsx` entirely — use a 10-line helper:

```typescript
function exportToCSV(data: Record<string, any>[], filename: string) {
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}
```

The `\uFEFF` BOM prefix ensures Vietnamese characters display correctly in Excel.

**Phase:** Phase 3 (Admin Shell & DataTable) — establish export utilities when building `DataTable.tsx`.

**Confidence:** HIGH — SheetJS bundle size is well-documented; `writeFileXLSX` recommendation is from official SheetJS docs.

---

### Pitfall 8: `jspdf` Crashes with `window is not defined` in Server Context

**What goes wrong:** `jspdf` accesses `window` and `document` at import time. A top-level `import jsPDF from 'jspdf'` in any file that gets server-rendered will crash the build.

**Why it happens:** Same root cause as Leaflet — browser-only library imported in a module that the server evaluates. Even `'use client'` does not prevent the initial server pass from evaluating the import.

**Prevention:** Always use dynamic import, only in event handlers:

```typescript
async function exportToPDF(data: any[], columns: string[], filename: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  autoTable(doc, {
    head: [columns],
    body: data.map(row => columns.map(col => String(row[col] ?? ''))),
    styles: { font: 'helvetica', fontSize: 8 },
  })
  doc.save(`${filename}.pdf`)
}
```

Key rules:
- Never use a top-level `import` for `jspdf` or `jspdf-autotable`
- Always `await import(...)` inside the click handler or export function
- This also benefits bundle size (PDF library only loads when user clicks "Export PDF")

**Phase:** Phase 3 (Admin Shell & DataTable) — part of the export toolbar implementation.

**Confidence:** HIGH — confirmed in jsPDF GitHub issue #1959.

---

### Pitfall 9: Next.js Middleware Running on Every Static Asset

**What goes wrong:** Without a proper `config.matcher`, the middleware function executes on EVERY request — including `_next/static/*`, `_next/image/*`, favicon, and all public assets. Each invocation calls `supabase.auth.getUser()` which is a network request to Supabase (~10-30ms). For a page that loads 30 static assets, this adds 30 unnecessary Supabase calls.

**Why it happens:** Middleware runs on all routes by default. The matcher regex is complex and easy to get wrong — a small typo can nullify the exclusion pattern.

**Consequences:** Massive latency increase on page loads. Supabase rate limits may be hit. Unnecessary cost on Supabase auth API.

**Warning signs:**
- Slow page loads despite fast API responses
- Supabase dashboard shows unexpectedly high auth.getUser() call volume
- Network tab shows `middleware` headers on `_next/static` requests

**Prevention:** The current `proxy.ts` matcher is actually correct. Preserve it exactly when renaming to `middleware.ts`:

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

This negative lookahead excludes:
- `_next/static/*` — compiled JS/CSS
- `_next/image/*` — optimized images
- `favicon.ico`
- Any file with image extensions (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`)

**Additional consideration for admin:** When adding Leaflet, you may put marker icons in `/public/leaflet/`. These `.png` files are already excluded by the `.*\\.(?:...png...)$` pattern. No matcher change needed.

**Phase:** Phase 2 (Auth & Middleware) — verify matcher is preserved during the rename.

**Confidence:** HIGH — existing matcher is correct; verified against Next.js middleware docs.

---

### Pitfall 10: @tanstack/react-table v8 — Accidentally Double-Filtering (Server + Client)

**What goes wrong:** TanStack Table v8 applies client-side filtering, sorting, and pagination by default. If the API already filters/sorts/paginates (as all `/api/admin/*` routes do), the table double-processes the data — client-side filtering removes rows that the server already filtered, or sorting contradicts the server order.

**Why it happens:** The developer sets up API-side pagination and filtering but forgets to disable the table's built-in client-side operations. TanStack Table is designed as a headless utility that does both — you must explicitly opt out of one.

**Consequences:** Missing rows (client filter removes valid server results). Pagination that shows fewer rows than expected. Sort order that flips unexpectedly.

**Warning signs:**
- Table shows fewer rows than the API returned
- Changing a filter causes the table to briefly show correct data then re-filter
- Page count doesn't match `total` from API

**Prevention:** For server-side tables, disable all client-side operations:

```typescript
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  // Do NOT include these for server-side tables:
  // getFilteredRowModel: getFilteredRowModel(),  // ← client filtering
  // getSortedRowModel: getSortedRowModel(),      // ← client sorting
  // getPaginationRowModel: getPaginationRowModel(), // ← client pagination
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  pageCount: Math.ceil(total / pageSize),
  state: {
    pagination: { pageIndex, pageSize },
    sorting,
    columnFilters,
  },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
})
```

The key flags are `manualPagination`, `manualSorting`, `manualFiltering` — these tell TanStack Table that the server handles these operations.

For small client-side tables (like the "recent sessions" table in New Activity with max ~50 rows), client-side filtering is fine — use the standard `getFilteredRowModel()` etc.

**Phase:** Phase 3 (Admin Shell & DataTable) — establish the pattern in the shared `DataTable` component.

**Confidence:** HIGH — documented in TanStack Table v8 sorting and filtering guides.

---

## Minor Pitfalls

---

### Pitfall 11: Leaflet Default Marker Icons Missing After Bundling

**What goes wrong:** Leaflet's default marker icons (`marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`) are referenced via CSS with relative paths. Webpack/Turbopack rewrites these paths, causing broken image references. Markers appear as broken image icons.

**Prevention:** Copy marker assets to `public/leaflet/` and explicitly set the icon paths (shown in Pitfall 5 code). Alternatively, use a custom SVG marker via `L.divIcon`.

**Phase:** Phase 4 (Dashboard Page).

**Confidence:** HIGH — universally documented react-leaflet issue.

---

### Pitfall 12: CSP Blocks Leaflet Tile Loading

**What goes wrong:** The current CSP in `next.config.js` has `img-src 'self' data: https:` which allows all HTTPS images — so OpenStreetMap tiles will load. However, Leaflet also uses inline styles for marker positioning and tile transforms. The current CSP has `style-src 'self' 'unsafe-inline'` which permits this. If CSP is tightened later (removing `'unsafe-inline'` from `style-src`), Leaflet breaks.

**Prevention:** Document the CSP dependency. When tightening CSP in the future, test Leaflet separately. Consider adding a comment in `next.config.js`:

```javascript
// style-src 'unsafe-inline' is required by Leaflet for marker/tile positioning
// img-src https: covers *.tile.openstreetmap.org
```

If `img-src` is ever restricted from `https:` to specific domains, add:
```
img-src 'self' data: https://*.tile.openstreetmap.org
```

**Phase:** Phase 4 (Dashboard Page) — document during Leaflet integration.

**Confidence:** MEDIUM — current CSP is permissive enough; this is a future-proofing concern.

---

### Pitfall 13: `mv_category_stats` NULL Columns Break Unique Index

**What goes wrong:** The `mv_category_stats` view groups by `province`, `clinic_type`, `drug_group`, `animal_type`, `query_type`. If any seed profile has NULL for `province` or `clinic_type`, or any `chat_analytics` row has NULL for a category field, the GROUP BY produces rows with NULLs. PostgreSQL treats NULLs as distinct in unique indexes, meaning multiple rows with `(2024, 1, NULL, NULL, 'khang_sinh', 'trau_bo', 'dieu_tri')` can coexist — but this is usually fine for the unique index. However, the `REFRESH CONCURRENTLY` algorithm uses the unique index to identify rows for UPDATE/DELETE. Rows with NULLs may behave unpredictably during concurrent refresh.

**Prevention:** Use `COALESCE` in the view definition to replace NULLs with sentinel values (shown in Pitfall 4). Alternatively, ensure seed data never produces NULLs in the grouped columns — validate in the seed script.

**Phase:** Phase 1 (Database & Migrations).

**Confidence:** MEDIUM — PostgreSQL docs mention NULL handling in unique indexes; the practical impact depends on whether seed data contains NULLs.

---

### Pitfall 14: `createServiceClient()` Used in Middleware (Cookie-less Context)

**What goes wrong:** The spec says middleware should call `createServiceClient()` to check `profiles.is_admin`. But `createServiceClient()` in `lib/supabase/server.ts` is a synchronous function that does not use `cookies()` (it has no-op cookie handlers). This is fine for the service role use case. However, the middleware also calls `supabase.auth.getUser()` via the anon client (which uses cookies from the request). If a developer accidentally uses `createServiceClient()` for the session check instead of the cookie-based client, auth will fail silently.

**Prevention:** In `updateSession()`, use the cookie-based Supabase client for session detection, and a separate `createServiceClient()` call only for the `profiles.is_admin` lookup:

```typescript
// lib/supabase/middleware.ts — inside updateSession()
// 1. Session check with cookie-based client (existing)
const { data: { user } } = await supabase.auth.getUser()

// 2. Admin check with service role client (new)
if (user && request.nextUrl.pathname.startsWith('/admin')) {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const db = createServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.redirect(new URL('/app', request.url))
  }
}
```

**Note:** The dynamic import avoids bundling `server-only` (if added per Pitfall 2) into the middleware bundle, which runs in the Edge runtime. If `server-only` causes issues in Edge, extract the service client to a separate file without the `server-only` guard specifically for middleware use.

**Phase:** Phase 2 (Auth & Middleware).

**Confidence:** MEDIUM — depends on implementation details of the middleware Edge runtime.

---

### Pitfall 15: Vietnamese Characters in PDF/Excel Exports

**What goes wrong:** Vietnamese text contains diacritics (e.g., "Tổng truy van", "Phong kham thu y"). PDF export via `jspdf` uses Helvetica by default, which does not support Vietnamese diacritics — characters render as `?` or boxes. Excel export may show garbled text if the BOM is missing.

**Prevention:**

For PDF: Embed a Vietnamese-compatible font (e.g., Roboto, Noto Sans) as a base64 string:
```typescript
// This is verbose but necessary for Vietnamese PDF support
import robotoBase64 from '@/lib/fonts/roboto-regular-base64'

const doc = new jsPDF()
doc.addFileToVFS('Roboto-Regular.ttf', robotoBase64)
doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
doc.setFont('Roboto')
```

For Excel/CSV: The `\uFEFF` BOM prefix (shown in Pitfall 7) ensures Excel opens the file with UTF-8 encoding. SheetJS handles this automatically for `.xlsx` but NOT for `.csv`.

**Phase:** Phase 3 (Admin Shell & DataTable) — test exports with Vietnamese text during implementation.

**Confidence:** MEDIUM — jsPDF font limitation is documented; the exact font embedding approach varies.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 1 (Database) | Trigger missing SECURITY DEFINER (#3) | Review migration SQL before applying |
| Phase 1 (Database) | Mat view missing unique index (#4) | Include CREATE UNIQUE INDEX in same migration file |
| Phase 1 (Database) | NULL columns in mv_category_stats (#13) | Use COALESCE or validate seed data |
| Phase 2 (Auth) | proxy.ts rename forgotten (#1) | First task, smoke test immediately |
| Phase 2 (Auth) | Service role leaking to client (#2) | Install `server-only`, add to server.ts |
| Phase 2 (Auth) | Middleware service client misuse (#14) | Two clients in middleware: cookie-based + service role |
| Phase 3 (Shell & Tables) | xlsx bundle bloat (#7) | Dynamic import, use writeFileXLSX |
| Phase 3 (Shell & Tables) | jspdf SSR crash (#8) | Dynamic import only, never top-level |
| Phase 3 (Shell & Tables) | TanStack double-filtering (#10) | Set manual* flags for server-side tables |
| Phase 3 (Shell & Tables) | Vietnamese in exports (#15) | BOM for CSV, embedded font for PDF |
| Phase 4 (Dashboard) | Leaflet SSR crash (#5) | dynamic() with ssr: false |
| Phase 4 (Dashboard) | Recharts 0x0 render (#6) | ChartWrapper with explicit height |
| Phase 4 (Dashboard) | Leaflet broken marker icons (#11) | Copy to public/, set paths explicitly |
| Phase 4 (Dashboard) | CSP blocking tiles (#12) | Current CSP is OK; document dependency |

---

## Sources

- [react-leaflet SSR issue #1152](https://github.com/PaulLeCam/react-leaflet/issues/1152) — Next.js 15 window is not defined
- [react-leaflet SSR issue #956](https://github.com/PaulLeCam/react-leaflet/issues/956) — long-standing SSR incompatibility
- [Recharts ResponsiveContainer issue #1579](https://github.com/recharts/recharts/issues/1579) — 0 width/height warning
- [PostgreSQL REFRESH MATERIALIZED VIEW docs](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) — CONCURRENTLY unique index requirement
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — SECURITY DEFINER pattern
- [Supabase discussion #3563](https://github.com/orgs/supabase/discussions/3563) — Bypass RLS in postgres function
- [Next.js Middleware docs](https://nextjs.org/docs/15/pages/api-reference/file-conventions/middleware) — matcher config
- [Clerk blog: skip middleware for static files](https://clerk.com/blog/skip-nextjs-middleware-static-and-public-files) — matcher patterns
- [TanStack Table sorting guide](https://tanstack.com/table/v8/docs/guide/sorting) — manual sorting flag
- [TanStack Table filtering guide](https://tanstack.com/table/v8/docs/guide/column-filtering) — manual filtering flag
- [SheetJS bundle size issue #694](https://github.com/SheetJS/sheetjs/issues/694) — tree shaking limitations
- [SheetJS ESM support issue #2033](https://github.com/SheetJS/sheetjs/issues/2033) — writeFileXLSX for smaller bundles
- [jsPDF window issue #1959](https://github.com/parallax/jsPDF/issues/1959) — Next.js SSR crash
- [Supabase creating SSR client docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — server vs client separation
- [Supabase API keys docs](https://supabase.com/docs/guides/api/api-keys) — service role key security
- [Leaflet CSP issue #3056](https://github.com/Leaflet/Leaflet/issues/3056) — Content Security Policy
- [Stop "Window Is Not Defined" in Next.js (2025)](https://dev.to/devin-rosario/stop-window-is-not-defined-in-nextjs-2025-394j)
