# Phase 3: Admin Dashboard Page + New Activity Page - Research

**Researched:** 2026-03-19
**Domain:** Recharts charting, react-leaflet maps, Next.js SSR data fetching, Supabase materialized view queries
**Confidence:** HIGH

## Summary

Phase 3 transforms two stub pages (`/admin/dashboard` and `/admin/new-activity`) into fully functional analytics pages. The core technical domains are: (1) Recharts chart rendering across multiple chart types (BarChart, AreaChart, ComposedChart, LineChart, PieChart donuts, inline sparklines/stacked bars in table rows), (2) react-leaflet map integration with SSR-safe dynamic import and custom colored markers, (3) API route design querying Supabase materialized views with server-side linear regression for forecast, and (4) the SSR + client refetch hybrid data fetching pattern using Server Components for initial render and Client Components for filter-driven refetches.

All Phase 2 component stubs (KpiCard, SectionHeader, FilterBar, MapView, SparklineChart) exist and have well-defined interfaces. The phase requires installing 4 new packages (recharts, react-leaflet, leaflet, @tanstack/react-table) and creating 2 API routes, 2 client wrapper components, 2 skeleton components, a forecast utility, and wiring the stub components with real implementations.

**Primary recommendation:** Build API routes first (they define the data shape everything else consumes), then wire charts and components page by page, with Leaflet map and inline table charts as the highest-risk items requiring careful SSR handling and dimension constraints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Install `recharts react-leaflet leaflet @types/leaflet @tanstack/react-table` as the very first task of Phase 3
- `xlsx`, `jspdf`, `jspdf-autotable`, `tsx` are NOT installed in Phase 3
- Hybrid SSR + client refetch pattern: `page.tsx` is Server Component reading searchParams, calls API route server-side, passes data as props to a Client Component (`DashboardClient.tsx` / `NewActivityClient.tsx`)
- Full section skeleton during refetch (animated gray placeholders replacing charts/tables)
- Filter state source of truth: URL searchParams (`?province=HN&month=2026-03&clinic_type=phong_kham`)
- Immediate refetch on each filter change (no submit button, no debounce)
- KPI cards always show platform-wide totals (unfiltered from `mv_dashboard_kpis`)
- New Activity page: month/year picker only (no province/clinic_type filter)
- Dashboard "Nguoi dung" table: top 20 users, no pagination, with inline Recharts BarCharts and SparklineChart per row
- Map pin color thresholds: >50 green, 10-50 yellow, 1-9 red, 0 grey
- Map center: Vietnam (~16N, 106E), zoom 6

### Claude's Discretion
- Exact Recharts color palette for chart series (teal/cyan theme to match admin shell)
- Recharts chart height per section
- Exact skeleton placeholder shapes
- `lib/admin/forecast.ts` linear regression implementation details
- `avg_session_duration_min` computation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within Phase 3 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | `GET /api/admin/dashboard` returns KPIs, monthly_series with forecast, category_stats, top_users, clinic_map, top_clinics | API route pattern with requireAdmin + createServiceClient; Supabase MV queries; forecast.ts integration |
| DASH-02 | `lib/admin/forecast.ts` linear regression on last 6 months, extrapolates 3 months with `is_forecast: true` | Linear regression formula documented; implementation pattern provided |
| DASH-03 | Dashboard "Tong quan" section: grouped BarChart + AreaChart with forecast dotted line | Recharts ComposedChart with Area + Line strokeDasharray pattern |
| DASH-04 | Dashboard "Chi so tap trung": LineChart, 5 KPI cards, 6 PieChart donuts | Recharts LineChart, PieChart donut config (innerRadius/outerRadius) |
| DASH-05 | Dashboard "Nguoi dung": table with sparklines + 2 inline horizontal BarCharts per row | Recharts inline BarChart pattern with fixed dimensions, SparklineChart wiring |
| DASH-06 | Dashboard "Phong kham": Leaflet map + top 10 horizontal BarChart | react-leaflet SSR-safe setup, custom DivIcon for colored pins |
| ACT-01 | `GET /api/admin/new-activity` returns 6 KPIs, daily series, recent_sessions, top_questions, category_stats | API route pattern; raw SQL for avg_session_duration_min; 60-char prefix grouping |
| ACT-02 | New Activity 6 KPI cards with distinct colored backgrounds | KpiCard component already supports bgColor prop |
| ACT-03 | New Activity AreaChart + BarChart (daily volume) | Standard Recharts AreaChart/BarChart patterns |
| ACT-04 | New Activity recent sessions table | Simple HTML table (not DataTable -- no export needed) |
| ACT-05 | New Activity top 10 questions horizontal BarChart | Recharts BarChart layout="vertical" pattern |
| ACT-06 | New Activity 3 category donut PieCharts | Same donut pattern as DASH-04 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.0 | All charts (Bar, Area, Line, Pie, Composed, inline sparklines) | De facto React charting library; supports React 19; composable API |
| react-leaflet | 5.0.0 | Map component wrapper for Leaflet | Official React wrapper for Leaflet; supports React 19 |
| leaflet | 1.9.4 | Map rendering engine | Industry standard for web maps; required peer dep of react-leaflet |
| @types/leaflet | 1.9.21 | TypeScript types for Leaflet | Required for TypeScript projects using Leaflet |
| @tanstack/react-table | 8.21.3 | Table logic (used by DataTable stub) | Headless table library; installed now for DataTable component readiness |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/ssr | 0.9.x | Server-side Supabase client | API routes querying materialized views |
| lucide-react | 0.577.x | Icons for KPI cards and UI elements | Icon props on KpiCard |
| next | 16.1.6 | Framework (App Router, Server Components) | SSR data fetching, dynamic imports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | @nivo/core | Nivo has better defaults but heavier bundle; recharts is more flexible for inline charts |
| L.DivIcon (custom pins) | leaflet-defaulticon-compatibility | defaulticon-compatibility fixes default icons but doesn't help with custom colored pins |
| inline Recharts in table | SVG sparklines by hand | Hand-rolled SVGs are lighter but lose tooltip/interaction support |

**Installation:**
```bash
npm install recharts react-leaflet leaflet @types/leaflet @tanstack/react-table
```

**Version verification:** All versions confirmed via `npm view [package] version` on 2026-03-19.

**Peer dependency notes:**
- recharts requires `react-is` as peer dep (React 16-19 compatible). Check if `react-is` is already installed or auto-resolved.
- react-leaflet 5.0.0 requires `react ^19.0.0` and `leaflet ^1.9.0` -- both satisfied.

## Architecture Patterns

### Recommended Project Structure (new files for Phase 3)
```
app/
  admin/
    dashboard/
      page.tsx                    # Server Component: reads searchParams, fetches data, passes to client
      DashboardClient.tsx         # Client Component: owns filter state, charts, refetch logic
      DashboardSkeleton.tsx       # Skeleton loading state during refetch
    new-activity/
      page.tsx                    # Server Component (same pattern)
      NewActivityClient.tsx       # Client Component
      NewActivitySkeleton.tsx     # Skeleton loading state
  api/
    admin/
      dashboard/
        route.ts                  # GET handler: KPIs + charts + forecast + map data
      new-activity/
        route.ts                  # GET handler: KPIs + daily data + sessions + questions
lib/
  admin/
    auth.ts                       # Already exists -- requireAdmin()
    forecast.ts                   # NEW: linear regression helper
components/
  admin/
    FilterBar.tsx                 # MODIFY: wire with real select inputs
    MapView.tsx                   # MODIFY: replace placeholder with real Leaflet map
    SparklineChart.tsx            # MODIFY: replace placeholder with real Recharts LineChart
```

### Pattern 1: SSR + Client Refetch Hybrid
**What:** Server Component fetches initial data via internal API call, passes to Client Component. Client Component manages filter state and refetches on filter change.
**When to use:** Both dashboard and new-activity pages.
**Example:**
```typescript
// app/admin/dashboard/page.tsx (Server Component)
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; province?: string; clinic_type?: string }>
}) {
  const params = await searchParams
  const month = params.month || new Date().toISOString().slice(0, 7)
  const province = params.province || ''
  const clinic_type = params.clinic_type || ''

  // Server-side fetch to own API route
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const qs = new URLSearchParams({ month, ...(province && { province }), ...(clinic_type && { clinic_type }) })
  const res = await fetch(`${baseUrl}/api/admin/dashboard?${qs}`, {
    headers: { cookie: /* forward cookies for auth */ },
    cache: 'no-store',
  })
  const data = await res.json()

  return <DashboardClient initialData={data} initialFilters={{ month, province, clinic_type }} />
}
```

**IMPORTANT NOTE on Server-to-API calls in Next.js 16:** Calling your own API route from a Server Component requires forwarding cookies for auth. Use `headers()` from `next/headers` to forward the cookie header. Alternatively, extract the query logic into a shared service function and call it directly from both the Server Component and the API route handler, avoiding the network hop.

**Recommended approach (shared service):**
```typescript
// lib/admin/services/dashboard.ts
export async function getDashboardData(filters: DashboardFilters) {
  const db = createServiceClient()
  // ... query logic here
  return { kpis, monthly_series, category_stats, top_users, clinic_map, top_clinics }
}

// app/admin/dashboard/page.tsx -- calls service directly
// app/api/admin/dashboard/route.ts -- also calls same service (for client-side refetch)
```

### Pattern 2: API Route Guard
**What:** Every `/api/admin/*` route starts with requireAdmin() check.
**When to use:** All admin API routes.
**Example:**
```typescript
// app/api/admin/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || ''
  const province = searchParams.get('province') || ''
  const clinic_type = searchParams.get('clinic_type') || ''

  const db = createServiceClient()
  // ... query materialized views
  return NextResponse.json({ kpis, monthly_series, ... })
}
```

### Pattern 3: Recharts ComposedChart with Forecast Line
**What:** Combine Area (solid for real data) + Line (dashed for forecast) in a single ComposedChart.
**When to use:** Dashboard "Tong quan" section monthly trend chart.
**Example:**
```typescript
// Prepare data: all months in one array, null out forecast values for area, null out real values for line
const chartData = monthly_series.map(d => ({
  label: `${d.year}/${String(d.month).padStart(2, '0')}`,
  real: d.is_forecast ? null : d.query_count,
  forecast: d.is_forecast ? d.query_count : null,
  // Bridge: last real point duplicated in forecast series for continuity
}))

<ComposedChart data={chartData} width={600} height={280}>
  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
  <Area type="monotone" dataKey="real" fill="#06b6d4" fillOpacity={0.3} stroke="#06b6d4" />
  <Line type="monotone" dataKey="forecast" stroke="#06b6d4" strokeDasharray="4 4" strokeOpacity={0.7} dot={false} connectNulls={false} />
</ComposedChart>
```

**Critical detail:** To make the forecast line connect from the last real data point, duplicate the last real month's value as the first point of the forecast series. This creates visual continuity between the solid area and dashed line.

### Pattern 4: Leaflet with Custom Colored DivIcon Markers
**What:** Use `L.divIcon` with inline CSS to create color-coded circle markers instead of default Leaflet icons (which break in Next.js webpack).
**When to use:** Dashboard "Phong kham" map section.
**Example:**
```typescript
'use client'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

function getMarkerIcon(color: string) {
  return L.divIcon({
    className: '',  // empty to avoid default leaflet-div-icon styling
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  })
}

function getColorForQueries(count: number): string {
  if (count > 50) return '#22c55e'  // green
  if (count >= 10) return '#eab308' // yellow
  if (count >= 1) return '#ef4444'  // red
  return '#6b7280'                  // grey
}
```

**Why DivIcon over default Icon:** The default Leaflet marker icon (`marker-icon.png`) breaks in Next.js because webpack processes the image path incorrectly. Using `L.divIcon` with inline HTML/CSS completely sidesteps this issue. No extra packages like `leaflet-defaulticon-compatibility` are needed.

### Pattern 5: Inline Recharts in Table Cells
**What:** Render small Recharts BarChart components inside HTML table cells with fixed dimensions.
**When to use:** Dashboard "Nguoi dung" section -- drug group + query type stacked bars per row.
**Example:**
```typescript
// Inline horizontal stacked bar (120px x 24px, no axes, no legend)
<BarChart width={120} height={24} data={[userData]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
  <XAxis type="number" hide />
  <YAxis type="category" dataKey="name" hide />
  <Bar dataKey="khangSinh" stackId="a" fill="#06b6d4" />
  <Bar dataKey="vitamin" stackId="a" fill="#3b82f6" />
  <Bar dataKey="vacXin" stackId="a" fill="#10b981" />
  <Bar dataKey="hormone" stackId="a" fill="#f59e0b" />
  <Bar dataKey="khangKySinhTrung" stackId="a" fill="#ef4444" />
  <Bar dataKey="khac" stackId="a" fill="#8b5cf6" />
</BarChart>
```

**Performance note:** Rendering 20 rows x 3 inline charts = 60 Recharts instances. Each is lightweight since they have no axes/legend/tooltip, but test for jank. If performance is an issue, consider using SVG rect elements directly instead.

### Anti-Patterns to Avoid
- **useEffect for data fetching:** Never use `useEffect(() => fetch(...))` for initial data load. The Server Component handles initial data; the Client Component only refetches when filters change.
- **Service role key in client bundle:** `createServiceClient()` must only be called in API route handlers or Server Components, never in `'use client'` files.
- **Leaflet CSS missing:** Forgetting `import 'leaflet/dist/leaflet.css'` causes an unstyled map with broken tiles. This import must be in the client component where MapContainer is rendered.
- **Recharts ResponsiveContainer in table cells:** Do NOT use `<ResponsiveContainer>` for inline table charts -- it causes layout thrashing. Use fixed `width` and `height` props directly on the chart component.
- **Forecast data mixed with real data in same series:** Do NOT put both real and forecast values in the same `<Area>` or `<Line>` dataKey. Use separate series with `null` values to create the visual break between solid and dashed rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG charts | Recharts BarChart/AreaChart/PieChart/LineChart | Tooltips, legends, animations, responsiveness are non-trivial |
| Map rendering | Custom tile renderer | react-leaflet MapContainer + TileLayer | Tile loading, zoom, pan, popup management are complex |
| Linear regression | ML library (tensorflow, scikit) | Simple `y = a + bx` in 20 lines | Only 6 data points, simple extrapolation -- no ML needed |
| URL search params sync | Custom state manager | `useSearchParams()` + `router.push()` | Next.js built-in, works with SSR |
| Donut chart | Custom SVG arc math | Recharts PieChart with innerRadius/outerRadius | Arc calculations, label positioning, hover effects are error-prone |
| Colored map pins | Image editing per color | L.divIcon with inline CSS | Dynamic colors, no image assets needed |

**Key insight:** The inline Recharts in table cells is the most tempting to hand-roll (plain SVG rects). Recharts works here but watch performance with 60 instances. If slow, fall back to plain SVG.

## Common Pitfalls

### Pitfall 1: Leaflet SSR Crash
**What goes wrong:** `ReferenceError: window is not defined` when importing Leaflet in a Server Component.
**Why it happens:** Leaflet accesses `window` and `document` on import. Next.js Server Components run on the server.
**How to avoid:** The MapView component already uses `dynamic(() => ..., { ssr: false })`. The real Leaflet component must be in a separate file that is dynamically imported. Never import `leaflet` or `react-leaflet` at the top of a file that could be server-rendered.
**Warning signs:** Build error or hydration mismatch mentioning `window`.

### Pitfall 2: Forecast Line Disconnected from Real Data
**What goes wrong:** The dashed forecast line starts floating, disconnected from the last real data point.
**Why it happens:** The forecast series starts at month N+1 but the real series ends at month N. With `connectNulls={false}` (default), there is a gap.
**How to avoid:** Include the last real month's value as the first point of the forecast series (bridge point). This point appears in both the real Area and the forecast Line, creating visual continuity.
**Warning signs:** Visual gap between solid area and dashed line on the chart.

### Pitfall 3: Recharts in Server Components
**What goes wrong:** `Error: useRef is not a function` or similar React hooks error.
**Why it happens:** Recharts components use React hooks internally and must be rendered in Client Components.
**How to avoid:** All chart components must be in files with `'use client'` directive. The DashboardClient.tsx and NewActivityClient.tsx are already marked as client components.
**Warning signs:** Any Recharts import in a file without `'use client'`.

### Pitfall 4: PieChart Donut with Zero-Value Slices
**What goes wrong:** PieChart renders incorrectly or throws when a category has count=0.
**Why it happens:** Recharts PieChart cannot render a slice with value 0 meaningfully.
**How to avoid:** Filter out categories with `count === 0` before passing data to PieChart.
**Warning signs:** Empty or buggy-looking donut charts.

### Pitfall 5: Server Component Calling Own API Route
**What goes wrong:** Auth fails because cookies are not forwarded, or `fetch` to `localhost` fails in production.
**Why it happens:** Server Components making HTTP requests to their own API routes need to forward auth cookies. In production, `localhost` may not resolve correctly.
**How to avoid:** Extract query logic into a shared service function (`lib/admin/services/dashboard.ts`) callable from both the Server Component and the API route. The Server Component calls the service directly; the API route wraps it with auth guard for client-side refetch.
**Warning signs:** 403 errors on initial page load despite being authenticated.

### Pitfall 6: Leaflet Map Not Sizing Correctly
**What goes wrong:** Map appears as a thin strip or doesn't render tiles.
**Why it happens:** MapContainer requires explicit height. If the parent has no height, the map collapses.
**How to avoid:** Set explicit `style={{ height: '400px', width: '100%' }}` on MapContainer, or use a wrapper div with fixed height and `className="h-[400px]"`.
**Warning signs:** Map container visible but no tiles or very small.

### Pitfall 7: Supabase MV Query Returns Stringified Numbers
**What goes wrong:** Chart data shows `"123"` (string) instead of `123` (number), causing chart rendering issues.
**Why it happens:** Supabase returns numeric/bigint columns as strings in some configurations.
**How to avoid:** Parse numeric fields with `Number()` or `parseInt()` when mapping API response data for charts.
**Warning signs:** Charts with NaN values or incorrect axis scaling.

## Code Examples

### Linear Regression (forecast.ts)
```typescript
// lib/admin/forecast.ts
export interface MonthlyDataPoint {
  year: number
  month: number
  query_count: number
  session_count: number
}

export interface ForecastPoint extends MonthlyDataPoint {
  is_forecast: boolean
}

/**
 * Simple linear regression: y = a + b*x
 * Takes last 6 months of real data, extrapolates 3 months.
 */
export function computeForecast(
  data: MonthlyDataPoint[],
  forecastMonths: number = 3
): ForecastPoint[] {
  // Sort by date ascending
  const sorted = [...data].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
  const recent = sorted.slice(-6)

  if (recent.length < 2) {
    // Not enough data -- return empty forecast
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  const n = recent.length
  const xs = recent.map((_, i) => i)
  const ys = recent.map(d => d.query_count)

  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0)

  const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const a = (sumY - b * sumX) / n

  // Generate forecast points
  const lastPoint = recent[recent.length - 1]
  const forecastPoints: ForecastPoint[] = []

  for (let i = 1; i <= forecastMonths; i++) {
    let forecastMonth = lastPoint.month + i
    let forecastYear = lastPoint.year
    while (forecastMonth > 12) {
      forecastMonth -= 12
      forecastYear++
    }

    const predictedValue = Math.max(0, Math.round(a + b * (n - 1 + i)))

    forecastPoints.push({
      year: forecastYear,
      month: forecastMonth,
      query_count: predictedValue,
      session_count: Math.round(predictedValue * 0.25), // rough session estimate
      is_forecast: true,
    })
  }

  return [
    ...sorted.map(d => ({ ...d, is_forecast: false })),
    ...forecastPoints,
  ]
}
```

### FilterBar Wiring (real implementation)
```typescript
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function FilterBar({ provinces, clinicTypes, ... }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  // Render real <select> elements calling updateFilter on change
}
```

### Donut PieChart Configuration
```typescript
const CHART_COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

<PieChart width={200} height={200}>
  <Pie
    data={filteredData}  // exclude count === 0
    dataKey="count"
    nameKey="name"
    cx="50%"
    cy="50%"
    innerRadius={60}
    outerRadius={80}
    paddingAngle={2}
  >
    {filteredData.map((_, index) => (
      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
    ))}
  </Pie>
  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: 'white' }} />
</PieChart>
```

### SparklineChart Real Implementation
```typescript
'use client'
import { LineChart, Line } from 'recharts'

export function SparklineChart({ data, color = '#3D9A7A', width = 120, height = 32, className }: SparklineChartProps) {
  const chartData = data.map((value, index) => ({ index, value }))

  return (
    <div className={className} style={{ width, height }}>
      <LineChart width={width} height={height} data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  )
}
```

### MapView Real Implementation Pattern
```typescript
'use client'
import dynamic from 'next/dynamic'

export interface MapPin {
  id: string
  latitude: number
  longitude: number
  label: string
  popupContent?: string
  color?: string
}

export interface MapViewProps {
  pins: MapPin[]
  center?: [number, number]
  zoom?: number
  className?: string
}

// The actual map component -- in a separate file or inline
function LeafletMapInner({ pins, center = [16.0, 106.0], zoom = 6, className }: MapViewProps) {
  // Import leaflet CSS and create map
  // Use L.divIcon for colored markers
  // Render MapContainer > TileLayer > Markers with Popups
}

// Dynamic import with ssr: false
export const MapView = dynamic(() => Promise.resolve(LeafletMapInner), { ssr: false })
```

### API Route avg_session_duration_min Computation
```sql
-- Raw SQL for avg session duration in a given month
SELECT COALESCE(
  AVG(
    GREATEST(
      EXTRACT(EPOCH FROM (max_ts - min_ts)) / 60,
      1  -- minimum 1 minute for single-message conversations
    )
  ),
  0
) AS avg_session_duration_min
FROM (
  SELECT
    c.id,
    MIN(m.created_at) AS min_ts,
    MAX(m.created_at) AS max_ts
  FROM conversations c
  JOIN messages m ON m.conversation_id = c.id
  WHERE EXTRACT(YEAR FROM c.created_at) = $1
    AND EXTRACT(MONTH FROM c.created_at) = $2
  GROUP BY c.id
) sub
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-leaflet v3 (class components) | react-leaflet v5 (hooks, React 19) | 2024 | v5 dropped class component API; use hooks-based MapContainer |
| Leaflet default marker icon workarounds | L.divIcon with CSS | Ongoing | DivIcon avoids webpack asset issues entirely |
| recharts v1 (class components) | recharts v3 (hooks, React 19) | 2024-2025 | v3 is fully hook-based; same API surface for chart components |
| useEffect data fetching | Server Components + client refetch | Next.js 13+ | SSR data available on first paint; no loading flash |
| getServerSideProps | async Server Components | Next.js 13+ (App Router) | searchParams available directly in page component |

**Deprecated/outdated:**
- `react-leaflet` v3/v4: Do not use; v5 is current and supports React 19
- `recharts` v1/v2: Do not use; v3 has better React 19 support and performance
- `leaflet-defaulticon-compatibility`: Not needed when using DivIcon approach

## Open Questions

1. **react-is peer dependency for recharts**
   - What we know: recharts 3.8.0 lists `react-is` as a peer dependency
   - What's unclear: Whether `react-is` is already installed as a transitive dependency in the project
   - Recommendation: Check after install; if missing, install `react-is@^19.0.0`

2. **Server Component calling own API route in production**
   - What we know: Fetching `http://localhost:3000/api/...` from a Server Component works in dev but may fail in production (Vercel)
   - What's unclear: Whether Next.js 16 internal fetch optimizes same-origin API calls
   - Recommendation: Use the shared service function pattern instead of HTTP calls. Server Component calls the service directly; API route wraps it for client-side refetch.

3. **Recharts performance with 60 inline charts**
   - What we know: Each inline BarChart is lightweight (no axes/legend) but 60 instances in one page could cause jank
   - What's unclear: Actual render performance with real data
   - Recommendation: Implement with Recharts first; if performance is poor, replace inline charts with plain SVG rects (simple proportional width calculation)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual visual verification + build verification |
| Config file | None (no automated test framework set up) |
| Quick run command | `npm run build` (ensures no SSR crashes, type errors) |
| Full suite command | `npm run build && npm run dev` (build + visual check) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | API returns correct response shape | smoke | `curl http://localhost:3000/api/admin/dashboard` (requires auth) | N/A |
| DASH-02 | Forecast adds 3 months with is_forecast:true | unit | Manual: verify forecast.ts logic with sample data | N/A |
| DASH-03 | Tong quan charts render without crash | smoke | `npm run build` (no SSR errors) + visual | N/A |
| DASH-04 | Chi so tap trung section renders | smoke | `npm run build` + visual | N/A |
| DASH-05 | User table with inline charts | smoke | `npm run build` + visual | N/A |
| DASH-06 | Leaflet map renders with pins | smoke | `npm run build` (no window errors) + visual | N/A |
| ACT-01 | New Activity API returns correct shape | smoke | `curl http://localhost:3000/api/admin/new-activity` (requires auth) | N/A |
| ACT-02 | 6 KPI cards with colored backgrounds | visual | Manual check | N/A |
| ACT-03 | AreaChart + BarChart render | smoke | `npm run build` + visual | N/A |
| ACT-04 | Recent sessions table renders | visual | Manual check | N/A |
| ACT-05 | Top 10 questions horizontal bar | visual | Manual check | N/A |
| ACT-06 | 3 donut charts render | visual | Manual check | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (catches type errors, SSR crashes, import issues)
- **Per wave merge:** `npm run build` + manual visual verification of both pages
- **Phase gate:** Both pages fully functional with real data from seeded database

### Wave 0 Gaps
- No automated test infrastructure for this phase (analytics dashboard is visual-heavy)
- Primary validation is `npm run build` (catches SSR/type/import errors) + visual verification
- Consider: adding a simple integration test that calls the API route and checks response shape

## Sources

### Primary (HIGH confidence)
- npm registry -- verified versions: recharts 3.8.0, react-leaflet 5.0.0, leaflet 1.9.4, @types/leaflet 1.9.21, @tanstack/react-table 8.21.3
- Existing codebase -- MapView.tsx, SparklineChart.tsx, FilterBar.tsx, KpiCard.tsx, SectionHeader.tsx, auth.ts, server.ts interfaces verified via Read tool
- Design spec (`docs/2026-03-18-admin-dashboard-design.md`) -- API response shapes, page layouts, component specs

### Secondary (MEDIUM confidence)
- [React Leaflet on Next.js 15](https://xxlsteve.net/blog/react-leaflet-on-next-15/) -- dynamic import pattern, marker icon fix, CSS import requirements
- [Making React-Leaflet work with NextJS](https://placekit.io/blog/articles/making-react-leaflet-work-with-nextjs-493i) -- SSR-safe patterns
- [Recharts official examples](https://recharts.github.io/en-US/examples/DashedLineChart/) -- strokeDasharray, ComposedChart patterns
- [Leaflet Markers With Custom Icons](https://leafletjs.com/examples/custom-icons/) -- DivIcon documentation
- [react-leaflet marker icon issue #753](https://github.com/PaulLeCam/react-leaflet/issues/753) -- webpack asset handling problem and DivIcon solution

### Tertiary (LOW confidence)
- Performance of 60 inline Recharts instances -- based on general knowledge, not benchmarked

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry; peer deps confirmed compatible
- Architecture: HIGH -- SSR+client hybrid pattern is well-documented for Next.js App Router; existing stubs define clear interfaces
- Pitfalls: HIGH -- Leaflet SSR crash and marker icon issues are extremely well-documented problems with known solutions
- API route design: HIGH -- response shapes defined in design spec; query patterns use existing MV schema
- Inline charts performance: MEDIUM -- 60 Recharts instances is unusual; may need SVG fallback

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries, no breaking changes expected)
