# Phase 4: Knowledge Base page + Users Analytics page - Research

**Researched:** 2026-03-19
**Domain:** Admin analytics pages — Recharts charting, @tanstack/react-table DataTable, Supabase service-role queries
**Confidence:** HIGH

## Summary

Phase 4 builds two read-only analytics pages following the exact same SSR + client refetch pattern established in Phase 3 (Dashboard, Nhap-hang). Both pages are data-display only — no CRUD operations. The Knowledge Base page (`/admin/knowledge-base`) displays document registry KPIs, 6 charts across two sections, and a fully functional paginated DataTable with search and Excel export. The Users page (`/admin/users`) displays user growth charts, two facility breakdown sections with KPI tiles, and a collapsible heavy-users section.

The critical implementation work is: (1) upgrading the `DataTable.tsx` stub into a full @tanstack/react-table implementation with pagination, sorting, search, copy, and Excel export; (2) building two service functions that query `kb_documents` and `profiles` + `mv_monthly_queries` via Supabase service client; (3) composing Recharts charts following the established `DashboardClient.tsx` patterns (horizontal BarCharts, PieCharts, LineCharts).

**Primary recommendation:** Follow the Phase 3 pattern exactly (SSR page.tsx -> Client.tsx with useState/fetch refetch), upgrade the DataTable stub to support @tanstack/react-table with real pagination/sort/export, and install `xlsx` for Excel export functionality.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SSR `page.tsx` server component calls API with default params, passes data as props to Client Component
- Client Components (`KnowledgeBaseClient.tsx`, `UsersClient.tsx`) own filter state + data, handle refetches via `fetch()`
- Full section skeleton during refetch
- Filter state stored in URL searchParams
- KB search: 300ms debounce, page reset on search, no top-level filter dropdowns, default 10 rows
- KB DataTable: default sort by relevance score descending, client-side column sort via @tanstack/react-table, export Copy + Excel only
- KB columns: Ma | Ten tai lieu | Chunk count | Ngay tao | Loai | Trang thai | Relevance score
- Users filter: Year + Month + Province + Clinic type via FilterBar, immediate refetch on change
- Users facility type icons: colored dot badges (phong_kham=teal, nha_thuoc=blue, thu_y=green, my_pham=pink, khac=gray)
- Users breakdown column order: Ma | Icon (dot) | Loai co so | So luong | %
- Heavy users section: collapsed by default, >10 queries/month threshold

### Claude's Discretion
- Exact dot badge size and shade within each color family
- Recharts chart heights for KB and Users charts
- Exact skeleton placeholder shapes for each section
- Debounce implementation detail (useCallback + useEffect vs lodash.debounce)
- Column widths and truncation on the KB DataTable
- Users page chart grid layout (2+1 or 3-column for the three top charts)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KB-01 | `GET /api/admin/knowledge-base` returns 3 KPIs, 6 chart datasets, paginated documents with search/filter | API route pattern from Phase 3 (`requireAdmin()` + service function), response shape defined in design spec section 5 |
| KB-02 | `/admin/knowledge-base` renders 3 KPI cards + 6 charts (4 in section 1 + 2 in section 2) | KpiCard component exists, Recharts BarChart/PieChart patterns from DashboardClient.tsx |
| KB-03 | `/admin/knowledge-base` renders paginated DataTable with 7 columns, Copy + Excel export, search bar | DataTable.tsx stub must be upgraded to full @tanstack/react-table implementation; xlsx must be installed |
| USERS-01 | `GET /api/admin/users` returns monthly_new_users, users_by_province/district, all_users_kpis, facility_breakdown, users_with_queries data, heavy_users | Service function queries profiles + mv_monthly_queries + auth.admin.listUsers() |
| USERS-02 | `/admin/users` renders 3 charts: LineChart + BarChart + horizontal BarChart | Recharts patterns established in Phase 3 |
| USERS-03 | "Tat ca khach hang" section: 4 KPI tiles + breakdown table with colored dot icons | KpiCard for tiles, simple HTML table for breakdown, dot badges via Tailwind |
| USERS-04 | "Khach hang dang truy van" section: same layout with % tong KH + % KH con hoat dong columns | Same component pattern as USERS-03, extended columns |
| USERS-05 | "Nguoi dung nhieu truy van" collapsible section with >10/month threshold | SectionHeader with `defaultOpen={false}`, simple table inside |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | All charts (BarChart, PieChart, LineChart) | Already installed, used extensively in Phase 3 |
| @tanstack/react-table | 8.21.3 | DataTable pagination, sorting, filtering | Already installed, DataTable stub wraps it |
| next | 16.x | App Router SSR + API routes | Project framework |
| @supabase/supabase-js | installed | Service client for DB queries | Established pattern |

### Supporting (MUST install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| xlsx | latest | Excel export from DataTable | KB-03 Copy + Excel export toolbar |

**Note:** `xlsx` is NOT currently installed despite being listed in the design spec. It must be installed before DataTable Excel export can work. The `jspdf` and `jspdf-autotable` packages are NOT needed for Phase 4 (only Copy + Excel on KB page; no PDF export until Phase 5).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx | exceljs | xlsx is simpler for basic export; exceljs adds streaming but unnecessary here |
| Manual debounce | lodash.debounce | Project has no lodash; use native setTimeout approach (2 lines of code) |

**Installation:**
```bash
npm install xlsx
```

## Architecture Patterns

### Recommended Project Structure
```
app/admin/knowledge-base/
  page.tsx                    # SSR server component — calls getKnowledgeBaseData()
  KnowledgeBaseClient.tsx     # 'use client' — charts, KPI cards, DataTable
  KnowledgeBaseSkeleton.tsx   # Loading skeleton

app/admin/users/
  page.tsx                    # SSR server component — calls getUsersData()
  UsersClient.tsx             # 'use client' — charts, KPI tiles, breakdown tables
  UsersSkeleton.tsx           # Loading skeleton

app/api/admin/knowledge-base/
  route.ts                    # GET handler with requireAdmin()

app/api/admin/users/
  route.ts                    # GET handler with requireAdmin()

lib/admin/services/
  knowledge-base.ts           # getKnowledgeBaseData() — queries kb_documents
  users.ts                    # getUsersData() — queries profiles, mv_monthly_queries, auth.admin

components/admin/
  DataTable.tsx               # UPGRADE from stub to full implementation
```

### Pattern 1: SSR + Client Refetch (established Phase 3)
**What:** Server component fetches data with default params, passes to client component which manages state and refetches on filter change.
**When to use:** Every admin page.
**Example (from existing `app/admin/dashboard/page.tsx`):**
```typescript
// page.tsx (server component)
import { getKnowledgeBaseData } from '@/lib/admin/services/knowledge-base'
import { KnowledgeBaseClient } from './KnowledgeBaseClient'

export default async function AdminKnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const data = await getKnowledgeBaseData({ page, page_size: 10, search })
  return <KnowledgeBaseClient initialData={data} initialFilters={{ page, search }} />
}
```

### Pattern 2: API Route with requireAdmin()
**What:** Every `/api/admin/*` route starts with auth check.
**Example (from existing `app/api/admin/dashboard/route.ts`):**
```typescript
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  // ... parse searchParams, call service, return JSON
}
```

### Pattern 3: Service Function with createServiceClient()
**What:** All DB queries go through a service function in `lib/admin/services/`. Uses `createServiceClient()` which bypasses RLS.
**Example:**
```typescript
import { createServiceClient } from '@/lib/supabase/server'

export async function getKnowledgeBaseData(filters: KBFilters): Promise<KBData> {
  const supabase = createServiceClient()
  // ... query kb_documents table
}
```

### Pattern 4: Recharts Chart Constants (established Phase 3)
**What:** Shared styling constants for dark theme charts.
**Example (from DashboardClient.tsx):**
```typescript
const CHART_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const TOOLTIP_STYLE = { backgroundColor: '#111827', border: '1px solid #374151', color: 'white' }
const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }
const GRID_STYLE = { stroke: '#374151', strokeDasharray: '3 3' }
```

### Anti-Patterns to Avoid
- **Building a new table from scratch:** Use the DataTable component with @tanstack/react-table, do NOT hand-roll pagination/sorting logic
- **Fetching auth.users from client side:** The `supabase.auth.admin.listUsers()` call MUST be server-side only (service role key)
- **Importing xlsx on server:** xlsx is a client-side export library; import it dynamically in the DataTable export handler to avoid SSR bundle issues

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table pagination + sorting | Custom pagination state machine | @tanstack/react-table `useReactTable()` with `getPaginationRowModel()`, `getSortedRowModel()` | Edge cases: page bounds, sort stability, column type inference |
| Excel export | Manual CSV-to-XLSX conversion | `xlsx` library: `XLSX.utils.json_to_sheet()` + `XLSX.writeFile()` | Handles encoding, cell types, Vietnamese diacritics |
| Clipboard copy | Custom textarea hack | `navigator.clipboard.writeText()` with tab-separated values | Native browser API, reliable |
| Debounce | setTimeout without cleanup | `useCallback` + `useRef` timer with cleanup in `useEffect` return | Avoids stale closures and memory leaks |
| Colored dot badges | SVG icon components | Tailwind: `<span className="inline-block w-3 h-3 rounded-full bg-teal-500" />` | Zero JS, pure CSS |

## Common Pitfalls

### Pitfall 1: DataTable Stub is Empty
**What goes wrong:** The current `DataTable.tsx` is a placeholder stub that renders "Component stub -- wired in Phase 3+". It has the correct TypeScript interfaces (`ExportConfig`, `DataTableColumn`, `DataTableProps`) but zero implementation.
**Why it happens:** Phase 2 created stubs for all shared components; Phase 3 used inline tables instead of DataTable for its user table.
**How to avoid:** Fully implement DataTable with @tanstack/react-table BEFORE building the KB page. The KB page depends entirely on a working DataTable.
**Warning signs:** If the KB table renders as a gray box with "Component stub" text.

### Pitfall 2: xlsx Not Installed
**What goes wrong:** Excel export button does nothing or throws runtime error.
**Why it happens:** `xlsx` is listed in the design spec's install command but was not installed in Phase 1-3 (not needed until now).
**How to avoid:** Run `npm install xlsx` as the first task of this phase.
**Warning signs:** `Cannot find module 'xlsx'` at build time.

### Pitfall 3: Supabase auth.admin.listUsers() Pagination
**What goes wrong:** `verified_email` count is wrong because `listUsers()` returns max 1000 users per page by default.
**Why it happens:** Supabase admin API has pagination limits.
**How to avoid:** For 82 seed users this is not an issue. But the correct pattern is to loop with `page` and `perPage` params if the user count could exceed 1000. For this project (82 users), a single call suffices.
**Warning signs:** verified_email count lower than expected.

### Pitfall 4: KB Search Debounce Causing Stale State
**What goes wrong:** Rapid typing triggers multiple API calls; earlier responses arriving after later ones overwrite newer data.
**Why it happens:** Network race conditions with debounced fetches.
**How to avoid:** Use an AbortController pattern: each new fetch aborts the previous in-flight request. Store the controller in a ref.
**Warning signs:** Table data "flickers" between search results.

### Pitfall 5: Recharts Horizontal BarChart Requires layout="vertical"
**What goes wrong:** BarChart renders bars vertically instead of horizontally.
**Why it happens:** Recharts defaults to vertical layout. For horizontal bars (categories on Y-axis, values on X-axis), you must set `layout="vertical"` on `<BarChart>` and swap XAxis/YAxis data keys.
**How to avoid:** Use `<BarChart layout="vertical">` with `<XAxis type="number" />` and `<YAxis type="category" dataKey="name" />`.
**Warning signs:** Chart looks rotated 90 degrees from the reference image.

### Pitfall 6: PieChart Label Overlap
**What goes wrong:** PieChart labels overlap when there are many small slices.
**Why it happens:** Default Recharts label positioning doesn't handle small arcs well.
**How to avoid:** Use `<Pie label={false}>` and rely on `<Legend>` + `<Tooltip>` for identification. Or use custom label renderer that only shows labels for slices > 5%.
**Warning signs:** Unreadable text on donut charts.

## Code Examples

### DataTable Full Implementation Pattern
```typescript
// Source: @tanstack/react-table v8 docs + project conventions
'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table'

// The DataTable receives pre-paginated server data for the KB page
// Client-side sorting operates on the current page only (per CONTEXT.md decision)
```

### Excel Export Pattern
```typescript
// Source: xlsx library docs
// Dynamic import to avoid SSR bundle issues
async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

### Copy to Clipboard Pattern
```typescript
function copyToClipboard(data: Record<string, unknown>[], columns: string[]) {
  const header = columns.join('\t')
  const rows = data.map(row => columns.map(col => String(row[col] ?? '')).join('\t'))
  const text = [header, ...rows].join('\n')
  navigator.clipboard.writeText(text)
}
```

### Horizontal BarChart Pattern
```typescript
// Source: Recharts docs + DashboardClient.tsx patterns
<ResponsiveContainer width="100%" height={300}>
  <BarChart layout="vertical" data={chunks_by_drug_group}>
    <CartesianGrid {...GRID_STYLE} />
    <XAxis type="number" tick={AXIS_TICK} />
    <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={120} />
    <Tooltip contentStyle={TOOLTIP_STYLE} />
    <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Donut PieChart Pattern
```typescript
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie data={doc_type_breakdown} dataKey="count" nameKey="name"
         cx="50%" cy="50%" innerRadius={60} outerRadius={90} label={false}>
      {doc_type_breakdown.map((_, i) => (
        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
      ))}
    </Pie>
    <Tooltip contentStyle={TOOLTIP_STYLE} />
    <Legend />
  </PieChart>
</ResponsiveContainer>
```

### Colored Dot Badge Pattern
```typescript
const CLINIC_TYPE_COLORS: Record<string, string> = {
  phong_kham: 'bg-teal-500',
  nha_thuoc: 'bg-blue-500',
  thu_y: 'bg-green-500',
  my_pham: 'bg-pink-500',
  khac: 'bg-gray-500',
}

function DotBadge({ clinicType }: { clinicType: string }) {
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${CLINIC_TYPE_COLORS[clinicType] || 'bg-gray-500'}`} />
  )
}
```

### Debounce with AbortController Pattern
```typescript
const abortRef = useRef<AbortController | null>(null)
const timerRef = useRef<ReturnType<typeof setTimeout>>()

const handleSearch = useCallback((value: string) => {
  setSearchValue(value)
  clearTimeout(timerRef.current)
  timerRef.current = setTimeout(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const params = new URLSearchParams({ search: value, page: '1' })
    router.push(`/admin/knowledge-base?${params}`)
    try {
      const res = await fetch(`/api/admin/knowledge-base?${params}`, {
        signal: abortRef.current.signal,
      })
      if (res.ok) setData(await res.json())
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }, 300)
}, [router])
```

### Supabase KB Documents Query Pattern
```typescript
// Server-side service function
export async function getKnowledgeBaseData(filters: KBFilters) {
  const supabase = createServiceClient()

  // KPIs: aggregate from kb_documents
  const { count: total_documents } = await supabase
    .from('kb_documents')
    .select('*', { count: 'exact', head: true })

  // Chart data: group by drug_group, category, doc_type, source
  const { data: allDocs } = await supabase
    .from('kb_documents')
    .select('*')

  // Compute aggregations in JS (acceptable for 120 docs)
  // ... group by logic

  // Paginated documents list
  let query = supabase
    .from('kb_documents')
    .select('*', { count: 'exact' })
    .order('relevance_score', { ascending: false })
    .range((filters.page - 1) * filters.page_size, filters.page * filters.page_size - 1)

  if (filters.search) {
    query = query.or(`doc_name.ilike.%${filters.search}%,doc_code.ilike.%${filters.search}%`)
  }

  const { data: documents, count } = await query
  // ... return shaped response
}
```

### Users Service — auth.admin.listUsers Pattern
```typescript
// For verified_email count — server-side only
const supabase = createServiceClient()
const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
const verified_email = authUsers.filter(u => u.email_confirmed_at != null).length
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @tanstack/react-table v7 (useTable hook) | v8 (useReactTable function) | 2022 | Different API — columns defined as ColumnDef[], no plugins, built-in row models |
| Recharts 2.x | Recharts 3.x (3.8.0 installed) | 2024 | Minor API tweaks; ResponsiveContainer still works same way |
| xlsx "community edition" | xlsx (SheetJS CE) | Ongoing | Free version works fine for basic export; Pro version unnecessary |

## Open Questions

1. **Users page verified_email via auth.admin.listUsers()**
   - What we know: Design spec says to use `supabase.auth.admin.listUsers()` and filter by `email_confirmed_at IS NOT NULL`
   - What's unclear: Seed data may not set `email_confirmed_at` on auth.users (seeds create profiles, not auth users directly). This count may be 0 in dev.
   - Recommendation: Implement the query as specified; if the count is 0, it reflects seed data reality — not a bug.

2. **KB page: doc_type and category filter params**
   - What we know: API supports `doc_type` and `category` params per spec. CONTEXT.md says "No top-level filter dropdowns" on KB page UI.
   - What's unclear: Whether the API should still accept and process these params (for future use) even though the UI does not expose them.
   - Recommendation: Implement the API to accept them (future-proof), but the client component only sends `search` and `page` params.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (installed as devDep) |
| Config file | `vitest.config.ts` (exists, node environment, @ alias configured) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KB-01 | Service returns correct KPI aggregates from kb_documents | unit | `npx vitest run lib/admin/__tests__/knowledge-base.test.ts -t "kpis"` | No — Wave 0 |
| KB-01 | Service returns paginated documents with search filter | unit | `npx vitest run lib/admin/__tests__/knowledge-base.test.ts -t "pagination"` | No — Wave 0 |
| KB-02 | Charts render without errors (smoke) | manual-only | Visual inspection against samples/3_ton_kho.jpg | N/A |
| KB-03 | DataTable renders columns, sorts, paginates | manual-only | Visual inspection — @tanstack/react-table client component | N/A |
| USERS-01 | Service returns correct user KPIs and breakdowns | unit | `npx vitest run lib/admin/__tests__/users.test.ts -t "kpis"` | No — Wave 0 |
| USERS-02 | Charts render without errors (smoke) | manual-only | Visual inspection against samples/4_khach_hang.jpg | N/A |
| USERS-03 | Facility breakdown table shows correct dot colors and percentages | manual-only | Visual inspection | N/A |
| USERS-04 | "Users with queries" section shows pct_of_total and pct_of_active | manual-only | Visual inspection | N/A |
| USERS-05 | Heavy users section collapsed by default, shows >10 threshold | manual-only | Visual inspection — click to expand | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/admin/__tests__/knowledge-base.test.ts` — covers KB-01 (service function unit tests)
- [ ] `lib/admin/__tests__/users.test.ts` — covers USERS-01 (service function unit tests)
- [ ] `npm install xlsx` — required for KB-03 Excel export

## Sources

### Primary (HIGH confidence)
- **Project codebase** — `components/admin/DataTable.tsx` (stub interface), `DashboardClient.tsx` (chart patterns), `app/api/admin/dashboard/route.ts` (API route pattern), `lib/admin/services/dashboard.ts` (service function pattern), `lib/admin/auth.ts` (requireAdmin pattern)
- **Design spec** — `docs/2026-03-18-admin-dashboard-design.md` sections 5, 6, 7.4, 7.5, 8 (API shapes, export config, page specs, shared components)
- **Reference images** — `samples/3_ton_kho.jpg` (KB layout), `samples/4_khach_hang.jpg` (Users layout)
- **CONTEXT.md** — `04-CONTEXT.md` (all locked decisions, filter behavior, column specs)

### Secondary (MEDIUM confidence)
- @tanstack/react-table v8 API (useReactTable, ColumnDef, row models) — based on installed version 8.21.3
- Recharts 3.x API (layout="vertical" for horizontal bars) — based on installed version 3.8.0
- xlsx (SheetJS) basic export API — well-established library, json_to_sheet + writeFile pattern

### Tertiary (LOW confidence)
- Supabase auth.admin.listUsers() pagination behavior with seed data — may return 0 verified emails depending on how seeds create auth users

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed except xlsx; patterns established in Phase 3
- Architecture: HIGH — exact same SSR + client refetch pattern from Dashboard/NhapHang; copy and adapt
- Pitfalls: HIGH — DataTable stub is confirmed empty (read the file); xlsx confirmed missing (npm ls); Recharts horizontal bar pattern is well-documented
- API shapes: HIGH — fully specified in design spec section 5 with TypeScript interfaces

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — all libraries are installed, patterns are established, no moving targets)
