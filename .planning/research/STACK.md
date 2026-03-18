# Technology Stack: Admin SaaS Dashboard (New Dependencies)

**Project:** Bamboo Vet Admin Dashboard (Product B)
**Researched:** 2026-03-18
**Context:** Subsequent milestone adding admin analytics dashboard to existing Next.js 16.1.6 / React 19.2.3 / Tailwind CSS v4 / shadcn/ui codebase

> **Scope:** This document covers only the NEW dependencies being added for the admin dashboard. The existing stack (Next.js, React, Supabase, Tailwind, shadcn/ui, Upstash) is documented in `.planning/codebase/STACK.md` and is not repeated here.

---

## Recommended Stack

### Charts: Recharts 3.x

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| recharts | ^3.8.0 | Time-series charts, donut/pie charts, bar charts, sparklines | Most popular React charting library (3,700+ dependents). Built on D3 but declarative React API. v3.x supports React 19 peer dependency natively. Simpler API than Victory or Nivo for the chart types needed (Line, Area, Bar, Pie, RadialBar). |

**Confidence:** HIGH -- npm registry confirms v3.8.0 published 2026-03-13; React 19 peer dep supported since v3.x.

**Critical patterns:**

1. **Every Recharts component file MUST have `'use client'` at the top.** Recharts uses D3 internally which requires DOM access. Without this directive, Next.js App Router treats components as Server Components and throws `TypeError: Super expression must either be null or a function`.

2. **Data fetching stays in Server Components; charts receive data as props.** This is the canonical pattern:

```typescript
// app/admin/dashboard/page.tsx (Server Component -- NO 'use client')
import { DashboardCharts } from '@/components/admin/dashboard-charts';

export default async function DashboardPage() {
  const data = await fetchDashboardData(); // server-side fetch
  return <DashboardCharts data={data} />;
}
```

```typescript
// components/admin/dashboard-charts.tsx (Client Component)
'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts';

export function DashboardCharts({ data }: { data: DashboardData }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data.timeSeries}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="queries" stroke="#3D9A7A" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

3. **ResponsiveContainer needs a parent with explicit height.** It reads its parent's dimensions. If the parent has no height, the chart collapses to 0px. Always wrap in a `<div>` with a fixed or min-height, or use the `height` prop directly on `ResponsiveContainer`.

4. **No need for `dynamic(() => ..., { ssr: false })` for Recharts.** The `'use client'` directive is sufficient. Recharts SSR works fine -- it renders SVG on the server which hydrates on the client. Only use `ssr: false` if you encounter specific SSR errors (unlikely with v3.x).

### Maps: Leaflet + react-leaflet

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| leaflet | ^1.9.4 | Map rendering engine | Industry standard open-source map library. OpenStreetMap tiles (free, no API key). |
| react-leaflet | ^5.0.0 | React bindings for Leaflet | Official React wrapper. v5.0.0 requires React 19 as peer dep (compatible). |
| @types/leaflet | ^1.9.12 | TypeScript types | Required -- leaflet has no built-in TS types. |

**Confidence:** HIGH -- react-leaflet v5.0.0 explicitly lists React 19 as peer dependency.

**Critical patterns:**

1. **Leaflet MUST be loaded with `ssr: false` via `next/dynamic`.** Leaflet directly accesses `window` and `document` on module load (not just at render time). Unlike Recharts, `'use client'` alone is NOT sufficient because the import itself crashes on the server.

2. **The `dynamic()` call MUST be inside a Client Component**, not a Server Component. This is an App Router limitation.

```typescript
// components/admin/map-wrapper.tsx (Client Component wrapper)
'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(
  () => import('@/components/admin/leaflet-map'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full items-center justify-center rounded-lg bg-muted">
        <span className="text-muted-foreground">Dang tai ban do...</span>
      </div>
    ),
  }
);

export function MapWrapper(props: MapProps) {
  return <LeafletMap {...props} />;
}
```

```typescript
// components/admin/leaflet-map.tsx (the actual map -- never imported directly)
'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon (Webpack breaks Leaflet's icon path resolution)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function LeafletMap({ markers, center, zoom }: MapProps) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]}>
          <Popup>{m.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

3. **Leaflet CSS MUST be imported.** Import `leaflet/dist/leaflet.css` inside the map component file (not in globals.css) so it only loads when the map loads.

4. **Marker icon fix is mandatory.** Webpack/Turbopack breaks Leaflet's built-in icon URL resolution. The pattern above (deleting `_getIconUrl` and providing explicit URLs) is the standard fix. Alternative: install `leaflet-defaulticon-compatibility` but the manual fix is simpler and avoids an extra dependency.

5. **CSP is already compatible.** The existing `img-src 'self' data: https:` covers OpenStreetMap tile images. No CSP changes needed.

6. **Note on react-leaflet maintenance.** The library has not published a new version in ~12 months. It works, but monitor for any React 19.x-specific issues. If it becomes unmaintained, the fallback is using Leaflet directly with `useEffect` + `useRef`.

### Data Tables: @tanstack/react-table v8

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @tanstack/react-table | ^8.21.3 | Headless table with sorting, pagination, filtering | De facto standard for React tables. Headless (no UI opinions) so it pairs with shadcn/ui styling. Supports server-side pagination natively via `manualPagination`. Works with React 19. |

**Confidence:** HIGH -- v8.21.3 officially supports React 16.8 through 19. Headless design means no DOM conflicts.

**Critical patterns:**

1. **Server-side pagination pattern with `manualPagination: true`:**

```typescript
'use client';

import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';

interface ServerTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  onPaginationChange: (pageIndex: number, pageSize: number) => void;
}

export function ServerTable<T>({
  data, columns, pageCount, pageIndex, pageSize, onPaginationChange,
}: ServerTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination: { pageIndex, pageSize } },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize })
        : updater;
      onPaginationChange(next.pageIndex, next.pageSize);
    },
    manualPagination: true,   // <-- tells table data is pre-paginated
    manualFiltering: true,    // <-- if server-side filtering
    manualSorting: true,      // <-- if server-side sorting
    getCoreRowModel: getCoreRowModel(),
  });

  // render with flexRender...
}
```

2. **URL-based pagination state.** Use `useSearchParams` to store `page` and `pageSize` in the URL, enabling bookmarkable paginated views and server-side data fetching based on URL params.

3. **shadcn/ui integration.** shadcn's `<Table>` component provides the styled `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` elements. TanStack Table provides the logic. They compose naturally -- use `flexRender` to render cells inside shadcn's `<TableCell>`.

4. **`'use client'` is required** because `useReactTable` is a React hook.

### Export: xlsx + jsPDF + jspdf-autotable

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| xlsx | 0.18.5 (npm) | Excel (.xlsx) and CSV export | SheetJS Community Edition. Most widely used spreadsheet library for JS. |
| jspdf | ^4.2.0 | PDF generation | Client-side PDF creation. v4.0.0+ required -- fixes critical CVE-2025-68428 (path traversal, CVSS 9.2). |
| jspdf-autotable | ^5.0.7 | PDF table rendering | Plugin for jsPDF that renders structured tables. Works with jsPDF 4.x. |

**Confidence:** MEDIUM for xlsx (npm version is stale at 0.18.5; SheetJS publishes newer versions only to their CDN), HIGH for jsPDF/autotable.

**Critical patterns:**

1. **xlsx installation note.** The npm `xlsx` package is stuck at 0.18.5 (last npm publish was years ago). SheetJS now publishes to their own CDN. For this project, 0.18.5 from npm is sufficient for basic Excel/CSV export. If advanced features are needed later, install from CDN: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.

2. **All export functions are client-side only.** They generate files in the browser and trigger downloads. Mark export utility files with `'use client'` or ensure they are only called from client components.

3. **Export utility signatures:**

```typescript
// lib/admin/export.ts
'use client';

import { utils, writeFile } from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

/** Export data as .xlsx Excel file */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Sheet1'
): void {
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  writeFile(wb, `${filename}.xlsx`);
}

/** Export data as .csv file */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  const ws = utils.json_to_sheet(data);
  const csv = utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export data as .pdf file with table */
export function exportToPDF(
  columns: string[],
  rows: (string | number)[][],
  filename: string,
  title?: string
): void {
  const doc = new jsPDF();
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 22);
  }
  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: title ? 30 : 20,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [61, 154, 122] }, // brand teal #3D9A7A
  });
  doc.save(`${filename}.pdf`);
}
```

4. **CSV with BOM for Vietnamese.** The `'\uFEFF'` prefix (UTF-8 BOM) is essential for Vietnamese characters to display correctly when the CSV is opened in Excel. Without it, Excel defaults to ANSI encoding and diacritics break.

5. **jsPDF v4.x is mandatory.** Versions <= 3.0.4 have CVE-2025-68428 (critical path traversal allowing arbitrary file read in Node.js). While this admin dashboard generates PDFs client-side only, pinning to v4.2.0+ avoids npm audit warnings and is best practice.

6. **Vietnamese font support in PDF.** jsPDF's default fonts (Helvetica, Courier, Times) do not support Vietnamese diacritics. For proper Vietnamese rendering, you would need to embed a custom font (e.g., Roboto or Noto Sans). For MVP, Latin-compatible column headers and numeric data will render fine; full Vietnamese text in PDF cells requires adding a custom font via `doc.addFont()`. Flag this for later if Vietnamese text in PDFs is required.

### Tailwind CSS v4: Dark Theme for Admin Sidebar

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| (existing) tailwindcss | ^4 | Dark admin sidebar with #1a1f2e background | Already installed. Tailwind v4 uses CSS-first configuration -- no `tailwind.config.js` needed. |

**Confidence:** HIGH -- verified against current Tailwind v4 documentation and the existing `globals.css`.

**Critical patterns:**

1. **The existing `@custom-variant dark` has a bug.** The current `globals.css` line 4 reads:
   ```css
   @custom-variant dark (&:is(.dark *));
   ```
   This only matches *descendants* of `.dark`, not the `.dark` element itself. The correct pattern (from Tailwind v4 docs) is:
   ```css
   @custom-variant dark (&:where(.dark, .dark *));
   ```
   Using `:where()` instead of `:is()` also avoids specificity inflation. This must be fixed before building the admin dark theme.

2. **Admin dark theme approach: CSS variables scoped to `.dark` class on `<html>`.** Since the admin dashboard is always dark and the chatbot is always light, the cleanest pattern is:
   - Add `.dark` class to `<html>` when on any `/admin/*` route
   - Define dark-mode CSS variable overrides in `globals.css`
   - Use `dark:` prefix on admin components

3. **Add admin dark theme variables to `globals.css`:**

```css
/* Add after the existing @theme inline block */
.dark {
  --background: oklch(0.15 0.02 250);       /* ~#1a1f2e */
  --foreground: oklch(0.93 0.01 250);       /* light gray text */
  --card: oklch(0.18 0.02 250);             /* slightly lighter card bg */
  --card-foreground: oklch(0.93 0.01 250);
  --muted: oklch(0.22 0.02 250);
  --muted-foreground: oklch(0.65 0.01 250);
  --border: oklch(0.28 0.02 250);
  --input: oklch(0.28 0.02 250);
  --sidebar-background: oklch(0.13 0.02 250);  /* darker sidebar */
  --sidebar-foreground: oklch(0.85 0.01 250);
  --sidebar-border: oklch(0.25 0.02 250);
  --sidebar-accent: oklch(0.20 0.02 250);
  --sidebar-accent-foreground: oklch(0.93 0.01 250);
}
```

4. **Toggle `.dark` class via layout, not a theme provider.** Since admin is always dark:

```typescript
// app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark">
      {/* Admin shell: sidebar + top bar + content */}
      {children}
    </div>
  );
}
```

   Note: Apply `.dark` to a wrapper `<div>` rather than `<html>` to avoid affecting Product A (chatbot) routes. The `@custom-variant dark` selector `(&:where(.dark, .dark *))` will match descendants of this div.

5. **No additional Tailwind plugins or packages needed.** The existing Tailwind v4 setup with `@custom-variant dark` handles everything. No `next-themes` package required since the admin is always dark.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Charts | Recharts 3.x | Nivo, Victory, Chart.js via react-chartjs-2 | Recharts has simplest React-native API; Nivo is heavier; Victory has smaller community; Chart.js requires wrapper and canvas (SVG preferred for styling) |
| Maps | react-leaflet 5.0 | Mapbox GL JS, Google Maps | Mapbox requires API key + costs at scale; Google Maps requires API key; OpenStreetMap is free and sufficient for clinic markers in Vietnam |
| Tables | @tanstack/react-table 8.x | AG Grid, Material React Table | AG Grid is heavy (overkill for admin tables); Material React Table adds Material UI dependency which conflicts with Tailwind-first approach |
| Excel export | xlsx (SheetJS) | ExcelJS | SheetJS is simpler API for basic export; ExcelJS is better for styled workbooks but adds complexity we do not need |
| PDF export | jsPDF + autotable | Puppeteer, React-PDF | Puppeteer requires server-side headless browser (overkill); React-PDF is for rendering PDFs in browser not generating them |
| Dark theme | Tailwind v4 built-in | next-themes | next-themes adds a package + provider for toggle; admin is always dark so no toggle needed |

---

## Type Declarations

```bash
# @types/leaflet is required (leaflet has no built-in types)
# recharts, @tanstack/react-table, jspdf, jspdf-autotable, xlsx all ship their own types
npm install -D @types/leaflet
```

---

## Installation

```bash
# Core dependencies for admin dashboard
npm install recharts leaflet react-leaflet @tanstack/react-table xlsx jspdf jspdf-autotable

# Type definitions
npm install -D @types/leaflet
```

**Expected package.json additions:**

```json
{
  "dependencies": {
    "recharts": "^3.8.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "@tanstack/react-table": "^8.21.3",
    "xlsx": "^0.18.5",
    "jspdf": "^4.2.0",
    "jspdf-autotable": "^5.0.7"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.12"
  }
}
```

---

## Peer Dependency Compatibility Matrix

| Package | Requires React | Our React | Compatible? |
|---------|---------------|-----------|-------------|
| recharts 3.8.x | ^16.0.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0 | 19.2.3 | YES |
| react-leaflet 5.0.0 | ^19.0.0 | 19.2.3 | YES |
| @tanstack/react-table 8.21.x | ^16.8 \|\| ^17 \|\| ^18 \|\| ^19 | 19.2.3 | YES |
| jspdf 4.2.x | (none) | -- | YES |
| jspdf-autotable 5.0.x | (none) | -- | YES |
| xlsx 0.18.5 | (none) | -- | YES |

No peer dependency conflicts expected. All packages support React 19.

---

## Known Gotchas Summary

| Gotcha | Severity | Mitigation |
|--------|----------|------------|
| Recharts in Server Component crashes | HIGH | Always add `'use client'` to chart component files |
| Leaflet import crashes SSR | HIGH | Use `next/dynamic` with `{ ssr: false }` inside a `'use client'` wrapper component |
| Leaflet marker icons missing | MEDIUM | Manually set icon URLs on `L.Icon.Default` (webpack breaks auto-resolution) |
| ResponsiveContainer 0-height | MEDIUM | Ensure parent element has explicit height |
| xlsx npm version outdated | LOW | v0.18.5 is functional for basic export; upgrade from SheetJS CDN only if needed |
| jsPDF <= 3.x has CVE-2025-68428 | HIGH | Pin to ^4.2.0 minimum |
| Vietnamese diacritics in CSV | MEDIUM | Prepend UTF-8 BOM (`\uFEFF`) to CSV output |
| Vietnamese text in PDF | MEDIUM | Default fonts lack Vietnamese glyphs; embed custom font if needed (defer to later phase) |
| `@custom-variant dark` selector bug | HIGH | Fix existing `(&:is(.dark *))` to `(&:where(.dark, .dark *))` in globals.css |
| Leaflet CSS not loaded | MEDIUM | Import `leaflet/dist/leaflet.css` in the map component file |
| `dynamic({ ssr: false })` in Server Component | HIGH | App Router forbids this; must use Client Component wrapper pattern |
| TanStack Table manual pagination `pageCount` | MEDIUM | Must pass `pageCount` (total pages) or `rowCount` (total rows, v8.13+) for correct page navigation |

---

## Sources

- [Recharts npm](https://www.npmjs.com/package/recharts) -- version 3.8.0 confirmed
- [react-leaflet npm](https://www.npmjs.com/package/react-leaflet) -- version 5.0.0, React 19 peer dep
- [@tanstack/react-table npm](https://www.npmjs.com/package/@tanstack/react-table) -- version 8.21.3
- [jspdf npm](https://www.npmjs.com/package/jspdf) -- version 4.2.0
- [jspdf-autotable npm](https://www.npmjs.com/package/jspdf-autotable) -- version 5.0.7
- [xlsx npm / SheetJS](https://www.npmjs.com/package/xlsx) -- version 0.18.5 (npm), 0.20.3 (CDN)
- [CVE-2025-68428 - jsPDF path traversal](https://github.com/advisories/GHSA-f8cm-6447-x5h2) -- fixed in v4.0.0
- [Tailwind CSS v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- `@custom-variant dark` pattern
- [TanStack Table Pagination Guide](https://tanstack.com/table/v8/docs/guide/pagination) -- manualPagination API
- [React Leaflet on Next.js 15 (App Router)](https://xxlsteve.net/blog/react-leaflet-on-next-15/) -- dynamic import pattern
- [Next.js Lazy Loading docs](https://nextjs.org/docs/pages/guides/lazy-loading) -- `dynamic()` with `ssr: false`
