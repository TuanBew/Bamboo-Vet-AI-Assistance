# Phase 6: Security & Polish - Research

**Researched:** 2026-03-28
**Domain:** Security hardening, print CSS, Vietnamese PDF export, i18n extraction, seed data expansion
**Confidence:** HIGH

## Summary

Phase 6 is a polish and hardening phase with no new pages or features. It covers five requirement areas: (1) verifying all npm packages are installed at correct versions with no high CVEs, (2) adding print CSS so `window.print()` hides the sidebar, (3) verifying `createServiceClient()` never leaks into the client bundle, (4) updating CSP for Leaflet tile servers, and (5) embedding a Vietnamese-capable font in jsPDF exports. Additionally, CONTEXT.md specifies seed data expansion (27-month realistic distribution) and i18n dictionary extraction as scope items.

The project already has all required packages installed in `package.json` at current versions (jspdf@4.2.1, jspdf-autotable@5.0.7, recharts@3.8.0, react-leaflet@5.0.0, @tanstack/react-table@8.21.3, xlsx@0.18.5). The `tsx` devDependency is missing and needs to be added. The DataTable PDF handler is still a console.log stub. The ColorPivotTable has a working PDF handler but without Vietnamese font support. The CSP in `next.config.js` uses a broad `img-src 'self' data: https:` which already covers tile images, but `connect-src` needs the OpenStreetMap tile server added.

**Primary recommendation:** This phase is mostly verification and patching. The largest work items are seed data expansion (new TS generator functions) and i18n dictionary extraction (mechanical refactor across 13+ admin components). Both are low-risk but high-volume.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- jsPDF version pinning: Must use `jspdf@^4.2.0` (CVE-2025-68428 mitigation) -- already at 4.2.1
- All required packages installed (recharts, react-leaflet, leaflet, @types/leaflet, @tanstack/react-table, xlsx, jspdf, jspdf-autotable, tsx)
- npm audit compliance: No high/critical CVEs on admin dependencies
- Service role client boundary: `createServiceClient()` and `SUPABASE_SERVICE_ROLE_KEY` ONLY in server-side code; verified via build analysis of `.next/static/chunks/*.js`
- Print stylesheet in `globals.css` with `@media print` rules; sidebar hidden, tables full-width
- Vietnamese font pre-embedded in client bundle (~200KB increase); applies to Check Users DataTable PDF and any other PDF exports
- CSP updated for `https://*.tile.openstreetmap.org` in both `img-src` and `connect-src`
- i18n dictionary at `lib/i18n/vietnamese.ts` with `VI` export object; all admin components refactored to use it
- NO rate limiting on admin routes
- Seed data expanded to cover full 27 months with realistic non-linear distribution (profiles 120-150, conversations 10K-12K, messages 50K-60K, customers 400-500, purchases 1500-2000, suppliers 8-10, products 82-92, purchase orders 120-150, chat analytics 12K)

### Claude's Discretion
- UI rendering issues: fix during implementation as needed
- Bundle verification approach: manual inspection + ANALYZE flag
- Exact seed data row counts: adjust based on testing and dashboard responsiveness

### Deferred Ideas (OUT OF SCOPE)
- AI analysis panel (v2)
- Audit logging (v2)
- Real-time data (v2)
- Multi-tenant admin accounts (v2)
- Vietnamese font licensing review (v2)
- Rate limiting for admin
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POL-01 | Install all new dependencies at correct versions | Package verification section; all already installed except `tsx` |
| POL-02 | `@media print` CSS hides sidebar during `window.print()` | Print CSS patterns section; Tailwind `print:hidden` utility |
| POL-03 | Service role client only in server-side code, verified via build | Bundle verification section; grep + ANALYZE approach |
| POL-04 | CSP updated for Leaflet tile server | CSP configuration section; `connect-src` update needed |
| POL-05 | jsPDF handles Vietnamese diacritics correctly | Vietnamese PDF font section; Roboto TTF + addFileToVFS pattern |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Installed Version | Latest | Purpose | Status |
|---------|-------------------|--------|---------|--------|
| jspdf | 4.2.1 | 4.2.1 | PDF generation | OK |
| jspdf-autotable | 5.0.7 | 5.0.7 | PDF table formatting | OK |
| recharts | 3.8.0 | 3.8.1 | Charts | Minor patch available |
| react-leaflet | 5.0.0 | 5.0.0 | Maps | OK |
| leaflet | 1.9.4 | 1.9.4 | Map engine | OK |
| @types/leaflet | 1.9.21 | 1.9.21 | Leaflet types | OK |
| @tanstack/react-table | 8.21.3 | 8.21.3 | Data tables | OK |
| xlsx | 0.18.5 | 0.18.5 | Excel export | OK |

### Missing (Must Install)
| Library | Version | Purpose | Type |
|---------|---------|---------|------|
| tsx | latest | TypeScript execution for seed scripts | devDependency |

### Font Asset (Must Add)
| Asset | Source | Size | Purpose |
|-------|--------|------|---------|
| Roboto-Regular.ttf | Google Fonts | ~170KB (Vietnamese subset) or ~150KB (latin+vietnamese) | Vietnamese diacritics in PDF |

**Installation:**
```bash
npm install -D tsx
```

**recharts patch (optional):**
```bash
npm install recharts@3.8.1
```

## Architecture Patterns

### 1. Vietnamese Font Embedding in jsPDF

**What:** jsPDF's 14 built-in fonts only support ASCII/Western European. Vietnamese diacritics require embedding a custom TTF font as base64.

**Implementation pattern (HIGH confidence -- verified from jsPDF docs and community examples):**

```typescript
// lib/pdf/vietnamese-font.ts
// Generated from Roboto-Regular.ttf using jsPDF font converter
// or manually base64-encoded

export const ROBOTO_REGULAR_BASE64 = '...' // base64 string of TTF file

export function addVietnameseFont(doc: jsPDF): void {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.setFont('Roboto')
}
```

**Font file preparation:**
1. Download Roboto-Regular.ttf from Google Fonts (or use the `@fontsource/roboto` npm package)
2. Convert to base64: `node -e "const fs=require('fs'); console.log(fs.readFileSync('Roboto-Regular.ttf').toString('base64'))" > roboto-base64.txt`
3. Create `lib/pdf/vietnamese-font.ts` exporting the base64 string
4. Call `addVietnameseFont(doc)` before any text rendering in PDF exports

**Font choice: Roboto over Noto Sans Vietnamese**
- Roboto supports Vietnamese natively (has `vietnamese` subset in Google Fonts)
- Full TTF is ~170KB; subset can be ~120KB
- SIL Open Font License -- no licensing concerns for embedding
- Noto Sans Vietnamese is larger (~300KB+) and provides no advantage for this use case

**Where to apply:**
- `components/admin/DataTable.tsx` -- replace `handlePdf` console.log stub
- `components/admin/ColorPivotTable.tsx` -- add font before `autoTable` call

### 2. Print CSS Pattern

**What:** Hide sidebar and topbar during `window.print()`, show only main content at full width.

**Implementation in globals.css:**

```css
@media print {
  /* Hide navigation chrome */
  .admin-sidebar,
  .admin-topbar {
    display: none !important;
  }

  /* Full-width content */
  .admin-content {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
  }

  /* Reset dark background for print */
  body, .bg-gray-900 {
    background: white !important;
    color: black !important;
  }
}
```

**Alternatively, use Tailwind `print:` variant:**
The admin layout (`app/admin/layout.tsx`) wraps `<AdminSidebar />` and `<AdminTopBar />`. Adding `print:hidden` class to these wrapper elements is cleaner than CSS-only:

```tsx
<AdminSidebar className="print:hidden" />
<AdminTopBar className="print:hidden" />
```

However, since `AdminSidebar` and `AdminTopBar` are existing components that don't accept a `className` prop, the CSS approach in `globals.css` targeting specific selectors is more practical. Add a `data-print-hide` attribute or a specific class to the sidebar `<aside>` and topbar elements.

**Recommended approach:** Add CSS class identifiers to `AdminSidebar` (`id="admin-sidebar"`) and `AdminTopBar` (`id="admin-topbar"`), then use `@media print` rules in `globals.css`.

### 3. Service Role Client Boundary Verification

**What:** Verify `createServiceClient()` and `SUPABASE_SERVICE_ROLE_KEY` do not leak into the client JavaScript bundle.

**Current usage locations (all server-side -- GOOD):**
- `app/api/admin/users/[userId]/conversations/route.ts` (API route)
- `app/api/admin/users/[userId]/conversations/[conversationId]/messages/route.ts` (API route)
- `app/admin/settings/page.tsx` (Server Component)
- `app/admin/_actions/refresh-views.ts` (Server Action)
- `app/api/conversations/route.ts` (API route)
- `app/api/conversations/[id]/route.ts` (API route)
- `app/api/chat/route.ts` (API route)
- `app/app/layout.tsx` (Server Component)
- `app/app/conversation/[id]/page.tsx` (Server Component)

**None of these are `'use client'` files** -- all are server components, API routes, or server actions. This is correct.

**Verification method:**
```bash
# After next build:
# 1. Check client chunks for service role references
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/chunks/ 2>/dev/null
grep -r "createServiceClient" .next/static/chunks/ 2>/dev/null

# 2. Optional: use ANALYZE flag
ANALYZE=true next build
# Then inspect client bundle in bundle analyzer output
```

**Expected result:** Zero matches in `.next/static/chunks/`. If any match is found, the offending import must be traced and moved to server-only code.

### 4. CSP Configuration for Leaflet

**Current CSP in `next.config.js`:**
```
img-src 'self' data: https:
connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:9380
```

**Issue:** `img-src` already allows `https:` (all HTTPS origins), so tile images will load. However, `connect-src` does NOT include `https://*.tile.openstreetmap.org`, which means XHR/fetch requests for tiles may be blocked.

**Required change:**
```javascript
"connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:9380 https://*.tile.openstreetmap.org",
```

**Note:** Leaflet loads tiles via `<img>` tags (covered by `img-src https:`), but some plugins or configurations may use `fetch()`. Adding to `connect-src` is defensive and explicitly documented in the CONTEXT.md requirement.

### 5. i18n Dictionary Structure

**What:** Extract all hardcoded Vietnamese strings from admin components into `lib/i18n/vietnamese.ts`.

**Existing i18n:** The project already has `lib/i18n/translations.ts` for Product A (chatbot) with vi/en translations. The admin dictionary is separate because admin is Vietnamese-only (SHELL-05).

**Dictionary structure (from CONTEXT.md):**
```typescript
// lib/i18n/vietnamese.ts
export const VI = {
  nav: {
    dashboard: 'Dashboard',
    nhapHang: 'Nhap hang',
    tonKho: 'Ton kho',
    khachHang: 'Khach hang',
    checkCustomers: 'Check Khach hang',
    checkDistributor: 'Check NPP',
    checkUsers: 'Check Users',
    checkClinics: 'Check Phong kham',
    settings: 'Cai dat',
    sectionCore: 'CORE',
    sectionChecked: 'CHECKED',
    sectionOther: 'OTHER',
  },
  buttons: {
    refresh: 'Lam moi du lieu',
    export: 'Xuat',
    copy: 'Copy',
    excel: 'Excel',
    csv: 'CSV',
    pdf: 'PDF',
    print: 'Print',
    prev: 'Truoc',
    next: 'Tiep theo',
    search: 'Tim kiem',
  },
  table: {
    noData: 'Khong co du lieu',
    rowsPerPage: 'Rows per page:',
    showing: 'ang hien thi',
    of: 'trong tong so',
    records: 'ban ghi',
    display: 'Hien thi',
    rows: 'dong',
  },
  // ... sections for each page: dashboard, nhapHang, tonKho, etc.
}
```

**Scope of extraction (components with hardcoded Vietnamese):**
1. `AdminSidebar.tsx` -- nav labels (currently without diacritics: "Nhap hang", "Ton kho", etc.)
2. `AdminTopBar.tsx` -- "Lam moi du lieu" button text
3. `ColorPivotTable.tsx` -- "Tim kiem", "Hien thi", "dong", "Truoc", "Tiep theo", "Khong co du lieu", pagination text
4. `DataTable.tsx` -- "Search...", "No data available", "Rows per page:"
5. `KpiCard.tsx` -- labels passed as props (extraction at call sites)
6. `SectionHeader.tsx` -- titles passed as props (extraction at call sites)
7. `DashboardClient.tsx` -- section titles, chart labels
8. `NhapHangClient.tsx` -- filter labels, table headers
9. `TonKhoClient.tsx` -- KPI labels, chart titles
10. `KhachHangClient.tsx` -- section titles, KPI labels
11. `CheckUsersClient.tsx` -- table headers, filter labels
12. `CheckClinicsClient.tsx` -- filter labels, table headers
13. `CheckCustomersClient.tsx` -- labels
14. `CheckDistributorClient.tsx` -- labels

**Important observation:** Many Vietnamese strings in the sidebar and ColorPivotTable currently lack diacritics (e.g., "Nhap hang" instead of "Nhap hang", "Tim kiem" instead of "Tim kiem"). The i18n extraction should also ADD correct diacritics where missing.

### 6. Seed Data Expansion Strategy

**Current state:**
- `profiles.md`: 86 lines (header + ~82 profiles)
- `conversations.md`: 214 lines (~210 conversations -- NOT the 4000 stated)
- `customers.ts`: 124 lines (~200 customers via generator)
- `products.ts`: 88 lines (62 products)
- `suppliers.ts`: 7 lines (5 suppliers)
- `purchase_orders.ts`: 65 lines (~86 orders via generator)
- `customer_purchases.ts`: 94 lines (~500-800 via generator)

**Key insight:** The `.md` files (profiles, conversations, query_events) contain static markdown tables. The `.ts` files contain generator functions that produce data algorithmically. For expansion to 10K+ conversations and 50K+ messages, generators (`.ts` files) are the ONLY viable approach -- markdown tables at that scale would be enormous and unmaintainable.

**Expansion approach:**
1. **Convert remaining `.md` seed files to `.ts` generators** for profiles and conversations/messages/query_events
2. **Use deterministic pseudo-random functions** (sin-based hash already established in Phase 04 decisions) for reproducible output
3. **Implement growth curve functions** that produce the required non-linear distribution:
   - 2024: 60-100 queries/month (ramp)
   - 2025 Q1-Q2: 150-250/month (growth)
   - 2025 Q3-Q4: 350-450/month (peak)
   - 2026 Q1: 200-300/month (seasonal dip)
4. **Daily variance:** 20-30% fluctuation, weekday > weekend, no flat lines
5. **Geographic clustering:** HCMC 25%, Ha Noi 15%, Da Nang 8%, long tail for others

**Seed runner update:** `scripts/seed.ts` currently mixes markdown parsing and TS imports. After expansion, it should import all data from `.ts` generators and batch-insert using Supabase client with appropriate chunk sizes (e.g., 500 rows per insert for conversations, 1000 for messages).

**Performance consideration:** 50K-60K message inserts could take minutes. Use batch inserts (Supabase `.insert()` accepts arrays) with chunks of 500-1000 rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF table layout | Manual cell positioning with jsPDF | `jspdf-autotable` plugin | Handles pagination, column widths, cell wrapping automatically |
| Vietnamese font in PDF | Runtime font loading from CDN | Pre-embedded base64 TTF in `lib/pdf/vietnamese-font.ts` | Eliminates network dependency; guaranteed availability |
| Print styling | JavaScript DOM manipulation for print | `@media print` CSS rules | Browser-native, zero JS overhead, standard pattern |
| Bundle analysis | Custom webpack plugin | `grep` on `.next/static/chunks/` + optional `ANALYZE=true` | Simple, reliable, no additional dependencies |
| i18n framework | Full next-intl or react-i18next setup | Simple `VI` object export | Admin is Vietnamese-only; full i18n framework is overkill |
| Seed data randomness | External RNG library | Deterministic sin-based hash (already in codebase) | Reproducible, no dependencies, already established pattern |

## Common Pitfalls

### Pitfall 1: jsPDF Default Font Silently Drops Vietnamese Characters
**What goes wrong:** Vietnamese characters (a, e, o, u, d, etc.) render as `?` or empty boxes in PDF output when using default Helvetica/Courier fonts.
**Why it happens:** jsPDF's built-in fonts only support ASCII and Western European character sets. Vietnamese diacritics are outside this range.
**How to avoid:** ALWAYS call `addFileToVFS()` + `addFont()` + `setFont()` before any text rendering. Also set the font in autoTable's `styles.font` property.
**Warning signs:** PDF exports show `?` characters or missing diacritics.

### Pitfall 2: autoTable Ignores Custom Font
**What goes wrong:** Even after setting `doc.setFont('Roboto')`, autoTable renders with default font.
**Why it happens:** autoTable has its own font configuration in `styles` object that overrides the document-level font.
**How to avoid:** Pass `styles: { font: 'Roboto' }` in the autoTable options object.

### Pitfall 3: Base64 Font String Bloats Bundle
**What goes wrong:** Embedding a full Roboto TTF (170KB raw, ~230KB base64) in a `.ts` file increases the client bundle significantly.
**Why it happens:** The font file is imported in a `'use client'` component.
**How to avoid:** Use dynamic import (`const { ROBOTO_REGULAR_BASE64 } = await import(...)`) so the font data loads only when PDF export is triggered, not on initial page load. This is already the pattern used for xlsx and jspdf imports in DataTable/ColorPivotTable.

### Pitfall 4: Print CSS Doesn't Override Dark Background
**What goes wrong:** Printed pages have dark backgrounds that waste ink and reduce readability.
**Why it happens:** The admin uses `bg-gray-900` extensively. `@media print` rules must explicitly override these.
**How to avoid:** Include background reset rules: `background: white !important; color: black !important;` for body and main content areas in print media query. Also set `-webkit-print-color-adjust: exact;` if color cells (ColorPivotTable) should retain their colors.

### Pitfall 5: Seed Script Timeout on Large Inserts
**What goes wrong:** Inserting 50K+ rows causes Supabase client timeout or connection drops.
**Why it happens:** Default Supabase client timeout and PostgreSQL connection limits.
**How to avoid:** Batch inserts in chunks of 500-1000 rows with small delays between batches. Use `upsert` with `onConflict` for idempotency.

### Pitfall 6: CSP `connect-src` Missing Tile Server
**What goes wrong:** Map tiles appear as grey/broken on pages with Leaflet maps.
**Why it happens:** While `img-src https:` covers `<img>` tag tile loading, some browsers or Leaflet versions use `fetch()` for tiles, which is governed by `connect-src`.
**How to avoid:** Add `https://*.tile.openstreetmap.org` to `connect-src` explicitly.

## Code Examples

### Vietnamese Font PDF Export (DataTable)
```typescript
// In DataTable.tsx handlePdf:
const handlePdf = useCallback(async () => {
  const jsPDFModule = await import('jspdf')
  const jsPDF = jsPDFModule.default
  await import('jspdf-autotable')

  // Dynamic import of font data (lazy-loaded, not in initial bundle)
  const { ROBOTO_REGULAR_BASE64 } = await import('@/lib/pdf/vietnamese-font')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Register Vietnamese-capable font
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.setFont('Roboto')

  const headers = columns.map(c => c.label)
  const body = data.map(row => headers.map(h => String(row[h] ?? '')))

  ;(doc as unknown as Record<string, Function>).autoTable({
    head: [headers],
    body,
    startY: 15,
    styles: { fontSize: 7, cellPadding: 2, font: 'Roboto' },
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
    theme: 'grid',
  })

  doc.save('export.pdf')
}, [data, columns])
```
*Source: jsPDF docs + jspdf-autotable README*

### Print CSS Rules
```css
/* globals.css */
@media print {
  #admin-sidebar,
  #admin-topbar {
    display: none !important;
  }

  .admin-main {
    margin-left: 0 !important;
    width: 100% !important;
  }

  /* Light background for printing */
  body,
  .bg-gray-900,
  .bg-gray-800 {
    background: white !important;
    color: black !important;
  }

  /* Keep color cells in pivot tables */
  .bg-green-500,
  .bg-yellow-400,
  .bg-red-500 {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### CSP Update
```javascript
// next.config.js - connect-src line:
"connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:9380 https://*.tile.openstreetmap.org",
```

### Bundle Verification Script
```bash
#!/bin/bash
# scripts/verify-bundle.sh
echo "Building Next.js..."
npx next build

echo "Checking client bundle for service role leaks..."
MATCHES=$(grep -rl "SUPABASE_SERVICE_ROLE_KEY\|createServiceClient" .next/static/chunks/ 2>/dev/null | wc -l)

if [ "$MATCHES" -gt 0 ]; then
  echo "FAIL: Service role client found in client bundle!"
  grep -rl "SUPABASE_SERVICE_ROLE_KEY\|createServiceClient" .next/static/chunks/
  exit 1
else
  echo "PASS: No service role client in client bundle."
fi
```

### Seed Data Growth Curve Function
```typescript
// Deterministic monthly volume based on growth curve
function getMonthlyVolume(year: number, month: number): number {
  const monthIndex = (year - 2024) * 12 + (month - 1) // 0-26 for Jan 2024 - Mar 2026

  let base: number
  if (monthIndex < 12) {
    // 2024: ramp from 60 to 100
    base = 60 + (monthIndex / 11) * 40
  } else if (monthIndex < 18) {
    // 2025 Q1-Q2: 150-250
    base = 150 + ((monthIndex - 12) / 5) * 100
  } else if (monthIndex < 24) {
    // 2025 Q3-Q4: 350-450
    base = 350 + ((monthIndex - 18) / 5) * 100
  } else {
    // 2026 Q1: 200-300
    base = 300 - ((monthIndex - 24) / 2) * 50
  }

  // Add deterministic variance (20-30%)
  const hash = deterministicHash(`vol-${year}-${month}`)
  const variance = 0.8 + (hash % 40) / 100 // 0.80 to 1.20
  return Math.round(base * variance)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsPDF standard fonts only | Custom TTF embedding via `addFileToVFS` | jsPDF 1.4.0+ | Full Unicode support including Vietnamese |
| Inline CSS for print | Tailwind `print:` variant or `@media print` in global CSS | Always available | Cleaner, more maintainable |
| Manual bundle inspection | `grep` on build output + optional webpack analyzer | Next.js 13+ | Simple, scriptable verification |

## Open Questions

1. **Exact Roboto TTF variant to use**
   - What we know: Roboto-Regular.ttf from Google Fonts supports Vietnamese. Full file is ~170KB, base64 is ~230KB.
   - What's unclear: Whether to use the full TTF or a Vietnamese-subset WOFF2 (jsPDF only supports TTF).
   - Recommendation: Use full Roboto-Regular.ttf since jsPDF requires TTF format and the size difference is marginal (~50KB). Dynamic import ensures it only loads when PDF export is triggered.

2. **Seed data migration strategy**
   - What we know: Some seeds are `.md` (profiles, conversations, query_events, kb_documents, clinics), others are `.ts` (customers, products, suppliers, purchase orders, etc.).
   - What's unclear: Whether to convert all `.md` to `.ts` or keep `.md` for small tables and add `.ts` generators for expanded data.
   - Recommendation: Keep `.md` for small static data (clinics, kb_documents). Convert profiles and conversations/messages/query_events to `.ts` generators since they need 10x-50x expansion.

3. **i18n dictionary: diacritics restoration**
   - What we know: Many existing Vietnamese strings in components lack proper diacritics (e.g., "Nhap hang" should be "Nhap hang" with correct Vietnamese characters).
   - What's unclear: The exact correct Vietnamese for every label (some may be intentionally simplified).
   - Recommendation: The CONTEXT.md examples use full diacritics ("Bang dieu khien", etc.). Apply diacritics to all strings during dictionary extraction. The reference in the sidebar already shows some labels without diacritics -- fix them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists, node environment, @/ alias) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POL-01 | All packages installed at correct versions | smoke | `node -e "require('jspdf'); require('recharts')"` + `npm audit --audit-level=high` | No -- Wave 0 |
| POL-02 | Print CSS hides sidebar | manual-only | Visual: `window.print()` preview inspection | N/A (CSS visual check) |
| POL-03 | Service role client not in client bundle | smoke | `npx next build && grep -r "createServiceClient" .next/static/chunks/` | No -- Wave 0 |
| POL-04 | CSP allows Leaflet tile server | manual-only | Browser console: no CSP errors on map pages | N/A (browser check) |
| POL-05 | Vietnamese diacritics in PDF | unit | `npx vitest run tests/pdf-vietnamese.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npm audit --audit-level=high`
- **Phase gate:** Full suite green + manual print/CSP verification before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/pdf-vietnamese.test.ts` -- verify jsPDF + Roboto font renders Vietnamese characters (POL-05)
- [ ] `tests/bundle-security.test.ts` -- verify createServiceClient not in client chunks (POL-03)
- [ ] `tests/csp-config.test.ts` -- verify next.config.js CSP includes tile.openstreetmap.org (POL-04)
- [ ] `tests/packages.test.ts` -- verify all required packages at expected versions (POL-01)

## Sources

### Primary (HIGH confidence)
- `package.json` -- verified all installed package versions
- `next.config.js` -- current CSP configuration reviewed
- `lib/supabase/server.ts` -- createServiceClient() pattern confirmed
- `components/admin/DataTable.tsx` -- PDF handler is console.log stub (line 183)
- `components/admin/ColorPivotTable.tsx` -- working PDF handler without Vietnamese font (lines 190-223)
- `app/admin/layout.tsx` -- admin shell structure confirmed (sidebar + topbar + main)
- `scripts/seed.ts` -- seed runner structure and markdown parser confirmed

### Secondary (MEDIUM confidence)
- [jsPDF Custom Fonts Guide](https://www.devlinpeck.com/content/jspdf-custom-font) -- addFileToVFS + addFont pattern
- [jsPDF-Autotable Special Characters](https://www.edopedia.com/blog/jspdf-autotable-print-special-characters-fonts-in-table/) -- font embedding for non-ASCII
- [jsPDF Unicode Issue #2093](https://github.com/parallax/jsPDF/issues/2093) -- Unicode language support discussion
- [jsPDF Text and Fonts DeepWiki](https://deepwiki.com/parallax/jsPDF/3.1-text-and-fonts) -- font system documentation
- [Roboto Google Fonts](https://fonts.google.com/specimen/Roboto) -- Vietnamese subset availability confirmed
- [MDN Printing Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) -- @media print patterns

### Tertiary (LOW confidence)
- Roboto TTF file size estimates (~170KB full, ~120KB subset) -- based on multiple sources but not directly measured

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against npm registry; versions confirmed in package.json
- Architecture (PDF fonts): HIGH -- jsPDF addFileToVFS pattern is well-documented and widely used for CJK/Vietnamese
- Architecture (print CSS): HIGH -- standard CSS @media print, no framework-specific concerns
- Architecture (CSP): HIGH -- straightforward directive addition to existing config
- Architecture (i18n): HIGH -- simple object export pattern, mechanical refactor
- Architecture (seed expansion): MEDIUM -- growth curve algorithms need tuning during implementation; batch insert performance untested
- Pitfalls: HIGH -- common issues well-documented in jsPDF issues and community

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no fast-moving dependencies)
