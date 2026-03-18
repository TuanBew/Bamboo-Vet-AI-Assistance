# Phase 2: Admin Shell & Role-Based Routing - Research

**Researched:** 2026-03-18
**Domain:** Next.js 16 proxy/middleware, Supabase auth guards, Tailwind v4 dark mode, admin layout patterns
**Confidence:** HIGH

## Summary

Phase 2 wires up the admin route protection layer, builds the dark sidebar layout shell, creates the `requireAdmin()` server utility, fixes the Tailwind v4 dark mode selector, and scaffolds all 7 shared admin components as renderable stubs. The codebase is Next.js 16.1.6 with Supabase Auth (SSR), Tailwind CSS v4, and shadcn/ui (base-ui variant).

The most critical research finding is a **correction to the CONTEXT.md decision about renaming proxy.ts to middleware.ts**. In Next.js 16, `middleware.ts` is officially deprecated and replaced by `proxy.ts`. The existing `proxy.ts` with its `proxy` export is the **correct** file convention. The design spec's claim that "proxy.ts is not currently active as Next.js middleware" was written assuming Next.js 15 conventions -- it is incorrect for Next.js 16. The file does NOT need renaming; it is already wired correctly.

A secondary finding concerns using `createServiceClient()` from `lib/supabase/server.ts` inside the proxy file. The `server.ts` module imports `cookies` from `next/headers` at the top level. In Next.js 16, proxy defaults to the Node.js runtime (not Edge), so this import is safe and will not cause runtime errors. The `createServiceClient()` function itself uses a no-op cookie adapter, so it works independently of any cookie context.

**Primary recommendation:** Keep `proxy.ts` as-is (do NOT rename to middleware.ts). Extend `updateSession()` in `lib/supabase/middleware.ts` with admin guard logic. Fix the dark mode selector as the very first code change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Desktop-only internal tool -- no mobile compatibility, no hamburger toggle, no responsive collapse
- Fixed 240px sidebar, always expanded, no collapse toggle of any kind
- Dark sidebar: `#1a1f2e` background, teal/cyan section labels, white active item highlight
- Active nav item: white background pill (high contrast against dark sidebar)
- Sidebar is a static layout column -- no state management needed
- **First task of Phase 2:** ~~rename proxy.ts to middleware.ts~~ **CORRECTED: proxy.ts is already the correct convention for Next.js 16 -- verify it is active by smoke-testing, then proceed** (see Critical Correction below)
- Admin route guards live in `updateSession()` inside `lib/supabase/middleware.ts` -- extend the existing function, do not create a new middleware file
- DB fetch for `is_admin` on every `/admin/*` request using `createServiceClient()` -- ~10-30ms overhead is acceptable
- Two-hop login redirect preserved: `/login` -> `/app` -> `/admin/dashboard` (middleware intercepts `/app` for admins). No changes to login page or auth callbacks.
- `globals.css` dark mode selector fix is the very first code change
- **Page routes:** Middleware only. `app/admin/layout.tsx` does NOT call `requireAdmin()` -- trust middleware, no double DB query.
- **API routes:** `requireAdmin()` in each `/api/admin/*` route handler only. Middleware does NOT check `/api/admin/*` paths.
- Guard pattern: `const auth = await requireAdmin(); if (auth instanceof NextResponse) return auth; const { user, profile } = auth;`
- Fix `(&:is(.dark *))` to `(&:where(.dark, .dark *))` as the very first task
- The admin layout wraps its content in a `.dark` class div

### Claude's Discretion
- Exact breadcrumb implementation in top bar
- SectionHeader collapse animation timing
- Component stub content (placeholder text/data for non-wired components)
- shadcn component variants chosen for KpiCard, FilterBar, etc.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within Phase 2 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Unauthenticated user accessing `/admin/*` redirected to `/login` | Proxy guard in `updateSession()` -- check `user` is null, redirect |
| AUTH-02 | Authenticated non-admin accessing `/admin/*` redirected to `/login` | Service role fetch of `profiles.is_admin` in `updateSession()` |
| AUTH-03 | Admin accessing `/app` redirected to `/admin/dashboard` (two-hop) | Add admin check after existing `/app` guard in `updateSession()` |
| AUTH-04 | `requireAdmin()` utility returns `{ user, profile }` or `NextResponse(403)` | New file `lib/admin/auth.ts` using `createServiceClient()` |
| AUTH-05 | globals.css dark mode selector fix | Change `(&:is(.dark *))` to `(&:where(.dark, .dark *))` |
| SHELL-01 | Admin layout renders dark sidebar + top bar | `app/admin/layout.tsx` server component with static sidebar |
| SHELL-02 | Sidebar has 3 sections, 7 nav items, teal labels, white active highlight | Static `AdminSidebar.tsx` component with `usePathname()` |
| SHELL-03 | Top bar shows breadcrumb + "Lam moi du lieu" refresh button | Server action calling `scripts/refresh-views.ts` logic |
| SHELL-04 | Settings page with admin profile, refresh button, last-refresh timestamp | Page reading `mv_dashboard_kpis.refreshed_at` |
| SHELL-05 | No language toggle, no RAGflow chat | Admin layout does NOT wrap with LanguageProvider |
| COMP-01 | DataTable wrapping @tanstack/react-table v8 with export config | Stub with prop types defined, no table logic yet |
| COMP-02 | ColorPivotTable with color-coded cells | Stub with threshold constants defined |
| COMP-03 | FilterBar with province/district/clinic_type/date/search | Stub with controlled props interface |
| COMP-04 | MapView wrapping react-leaflet with `next/dynamic` SSR:false | Stub with dynamic import pattern |
| COMP-05 | SparklineChart minimal Recharts LineChart | Stub with props interface |
| COMP-06 | KpiCard colored card with large number + label | Fully implementable in Phase 2 |
| COMP-07 | SectionHeader teal bar with collapsible toggle | Fully implementable in Phase 2 |
</phase_requirements>

## Critical Correction: proxy.ts vs middleware.ts

### The Problem
The CONTEXT.md and design spec both state: "proxy.ts is not currently active as Next.js middleware" and instruct renaming `proxy.ts` to `middleware.ts`. This guidance was written assuming Next.js 15 conventions.

### The Reality (Next.js 16)
The project runs **Next.js 16.1.6**. In Next.js 16.0.0, `middleware.ts` was officially **deprecated** and replaced by `proxy.ts`. The existing `proxy.ts` file at project root -- with its `export async function proxy(request)` signature -- is **already the correct convention**.

From the official Next.js 16 docs:
> "The `middleware` file convention is deprecated and has been renamed to `proxy`."

**Confidence: HIGH** -- Verified directly from official Next.js docs at nextjs.org/docs/app/api-reference/file-conventions/proxy.

### Impact on Phase 2
- **Do NOT rename** `proxy.ts` to `middleware.ts` -- this would break the proxy in Next.js 16
- The proxy IS already wired. First task should be a **smoke test** to confirm: visit `/app` while logged out and verify redirect to `/login`
- If the smoke test fails, investigate whether Next.js 16.1.6 still supports `middleware.ts` for backward compatibility (it likely does, but `proxy.ts` is the forward path)
- All CONTEXT.md references to "rename proxy.ts to middleware.ts" should be read as "verify proxy.ts is active"

### Backward Compatibility Note
Next.js 16 still recognizes `middleware.ts` for backward compatibility, but it is deprecated. Keeping `proxy.ts` is the correct forward-looking approach.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | Framework | Already installed, App Router |
| @supabase/ssr | 0.9.0 | Auth SSR | Already installed, cookie-based auth |
| @supabase/supabase-js | 2.99.1 | DB client | Already installed |
| tailwindcss | 4.2.1 | Styling | Already installed, CSS-first config |
| shadcn | 4.0.6 | UI components | Already installed, base-ui variant |
| lucide-react | 0.577.0 | Icons | Already installed |

### Supporting (already installed, relevant to Phase 2)
| Library | Version | Purpose |
|---------|---------|---------|
| @base-ui/react | 1.3.0 | shadcn primitives (Dialog, Sheet) |
| class-variance-authority | 0.7.1 | Component variant management |
| clsx | 2.1.1 | Conditional classnames |
| tailwind-merge | 3.5.0 | Tailwind class merging |
| tw-animate-css | 1.4.0 | Animation utilities |

### Phase 2 New Installs: NONE
All 7 shared components in Phase 2 are **stubs**. Libraries like `@tanstack/react-table`, `recharts`, `react-leaflet`, `xlsx`, `jspdf` are not needed until Phases 3-6 when the components gain real functionality. Installing them now would add unused dependencies.

**Exception:** If the planner decides to make `KpiCard` and `SectionHeader` fully functional (they're simple enough), no new libraries are needed -- they use only Tailwind + lucide-react.

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
proxy.ts                           # KEEP AS-IS (Next.js 16 convention)
app/globals.css                    # Fix dark mode selector (first change)
app/admin/
  layout.tsx                       # Server component: dark sidebar + top bar
  dashboard/page.tsx               # "Coming soon" placeholder
  new-activity/page.tsx            # "Coming soon" placeholder
  knowledge-base/page.tsx          # "Coming soon" placeholder
  users/page.tsx                   # "Coming soon" placeholder
  check-users/page.tsx             # "Coming soon" placeholder
  check-clinics/page.tsx           # "Coming soon" placeholder
  settings/page.tsx                # Admin profile + refresh button + timestamp
components/admin/
  AdminSidebar.tsx                 # Static dark sidebar (client component for usePathname)
  KpiCard.tsx                      # Colored card component (fully functional)
  SectionHeader.tsx                # Teal collapsible header (fully functional)
  DataTable.tsx                    # Stub: prop types + "Coming soon"
  ColorPivotTable.tsx              # Stub: prop types + "Coming soon"
  FilterBar.tsx                    # Stub: prop types + "Coming soon"
  MapView.tsx                      # Stub: dynamic import pattern + "Coming soon"
  SparklineChart.tsx               # Stub: prop types + "Coming soon"
lib/admin/
  auth.ts                          # requireAdmin() utility
lib/supabase/
  middleware.ts                    # Extended updateSession() with admin guards
```

### Pattern 1: Proxy Guard with Service Role DB Lookup
**What:** The proxy (via `updateSession()`) checks `profiles.is_admin` for `/admin/*` routes using the service role client.
**When to use:** Every `/admin/*` page route request.
**Critical detail:** Use `createServiceClient()` (service role, bypasses RLS) NOT the anon supabase client already initialized in `updateSession()`. The anon client cannot read other users' profile rows due to RLS.

```typescript
// In lib/supabase/middleware.ts, inside updateSession(), AFTER the session refresh
// Source: verified from existing codebase + Supabase SSR docs

const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
const isAppRoute = request.nextUrl.pathname.startsWith('/app')

if (isAdminRoute || isAppRoute) {
  if (!user) {
    if (isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    // existing /app guard already handles unauthenticated -> /login
  } else {
    // User is authenticated -- check admin status
    const { createServiceClient } = await import('@/lib/supabase/server')
    const svc = createServiceClient()
    const { data: profile } = await svc
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.is_admin === true

    if (isAdminRoute && !isAdmin) {
      // Non-admin trying to access admin routes
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (isAppRoute && isAdmin) {
      // Admin hitting /app -> redirect to admin dashboard
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }
  }
}
```

**Important implementation note:** Use dynamic `import()` for `createServiceClient` inside the proxy to avoid top-level `cookies` import from `next/headers` being evaluated in the proxy module scope. While Next.js 16 proxy uses Node.js runtime and `cookies` from `next/headers` should be available, a dynamic import is safer and avoids any tree-shaking issues.

### Pattern 2: Admin Layout (Server Component with Client Sidebar)
**What:** `app/admin/layout.tsx` is a server component that wraps children in a dark-themed container. The `AdminSidebar` is a client component (needs `usePathname()` for active state).
**When to use:** All `/admin/*` pages.

```typescript
// app/admin/layout.tsx
// Source: existing app/app/layout.tsx pattern adapted for admin

import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'

export const metadata = {
  title: 'Bamboo Vet Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // NO auth check here -- trust proxy middleware
  // NO LanguageProvider -- admin is Vietnamese only
  return (
    <div className="dark"> {/* Enable dark: variant for all children */}
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <AdminSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminTopBar />
          <main className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
```

### Pattern 3: requireAdmin() Utility
**What:** Server utility for API route protection.
**When to use:** Every `/api/admin/*` route handler.

```typescript
// lib/admin/auth.ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user, profile }
}
```

**Note:** In API routes (not proxy), `createClient()` is safe to call because it uses `cookies()` from `next/headers` which is available in Route Handlers. The `requireAdmin()` uses `createClient()` for session verification (via `getUser()`) and `createServiceClient()` for the profile lookup (bypasses RLS).

### Pattern 4: Component Stubs with Type-Safe Props
**What:** Shared components defined with full TypeScript interfaces but minimal rendering.
**When to use:** All 5 stub components (DataTable, ColorPivotTable, FilterBar, MapView, SparklineChart).

```typescript
// components/admin/DataTable.tsx
'use client'

export interface ExportConfig {
  copy?: boolean
  excel?: boolean
  csv?: boolean
  pdf?: boolean
  print?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: { key: keyof T; label: string }[]
  exportConfig?: ExportConfig
  searchPlaceholder?: string
}

export function DataTable<T>({ data, columns, exportConfig }: DataTableProps<T>) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">
        DataTable -- {columns.length} columns, {data.length} rows configured
      </p>
      <p className="text-xs text-gray-500 mt-1">Component stub -- wired in Phase 3+</p>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Double auth check:** Do NOT call `requireAdmin()` in `app/admin/layout.tsx`. The proxy handles page-level auth. Only API routes use `requireAdmin()`.
- **Renaming proxy.ts to middleware.ts:** Next.js 16 deprecated middleware.ts. Keep proxy.ts.
- **Using anon client for is_admin lookup in proxy:** The anon Supabase client (created in `updateSession()`) cannot read other users' profile rows due to RLS. Must use `createServiceClient()` (service role).
- **Wrapping admin in LanguageProvider:** Admin is Vietnamese-only. Do not import or wrap with the i18n context.
- **Adding mobile responsiveness:** This is a desktop-only internal tool. No hamburger, no responsive breakpoints, no collapse toggle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode variant | Custom CSS selectors | Tailwind v4 `@custom-variant dark` | Standard Tailwind v4 pattern, one line fix |
| Dialog/Sheet components | Custom modal/drawer | shadcn/ui Dialog + Sheet (already installed) | Already in `components/ui/`, base-ui primitives |
| Route active state | Custom path matching | `usePathname()` from `next/navigation` | Standard Next.js hook, handles prefetching |
| Admin auth in proxy | Custom JWT parsing | `supabase.auth.getUser()` + service role profile fetch | Supabase handles token refresh, getUser() verifies with auth server |
| Icon system | Custom SVG imports | lucide-react (already installed) | Already used throughout Product A |

## Common Pitfalls

### Pitfall 1: Dark Mode Selector Bug (AUTH-05)
**What goes wrong:** The current `globals.css` has `@custom-variant dark (&:is(.dark *));` which does NOT match the `.dark` element itself -- only its descendants. Admin layout wraps content in `<div className="dark">` but that div's own children that use `dark:` classes at the boundary won't match.
**Why it happens:** `:is(.dark *)` means "any descendant of .dark" but not .dark itself. The fix uses `:where(.dark, .dark *)` to match both.
**How to avoid:** Change line 4 of `globals.css` from `@custom-variant dark (&:is(.dark *));` to `@custom-variant dark (&:where(.dark, .dark *));`
**Warning signs:** Dark background colors not appearing on admin pages.

### Pitfall 2: cookies() Import in Proxy Context
**What goes wrong:** `lib/supabase/server.ts` imports `cookies` from `next/headers` at the module level. If the proxy file imports from this module, the `cookies` function is evaluated at import time.
**Why it happens:** Module-level side effects in the proxy file context.
**How to avoid:** In Next.js 16, proxy uses Node.js runtime by default, so `cookies` from `next/headers` is available. However, as a safety measure, use dynamic `import()` for `createServiceClient` inside `updateSession()` when called from proxy context, or create a separate `lib/supabase/service.ts` that only exports `createServiceClient` without the `cookies` import.
**Warning signs:** Build errors about "cookies() can only be called in..." or edge runtime incompatibility.

### Pitfall 3: Auth Redirect Loop
**What goes wrong:** Admin user logs in, gets sent to `/app`, proxy redirects to `/admin/dashboard`, but if the admin check fails (e.g., DB query error), it redirects back to `/login`, creating a loop.
**Why it happens:** Error handling in the `is_admin` DB fetch.
**How to avoid:** If the profile fetch fails (DB error, not "not found"), let the request through to `/app` rather than redirecting. Only redirect to `/login` when the user is definitively not an admin.
**Warning signs:** Infinite redirect errors in browser.

### Pitfall 4: Supabase Session vs getUser()
**What goes wrong:** Using `getSession()` instead of `getUser()` for auth checks.
**Why it happens:** `getSession()` reads from cookies without server verification. Tokens can be spoofed.
**How to avoid:** Always use `supabase.auth.getUser()` which verifies the token with the Supabase auth server. The existing `updateSession()` already does this correctly.
**Warning signs:** Auth bypasses in development when cookies are manually modified.

### Pitfall 5: Login Page Redirect for Non-Admin
**What goes wrong:** AUTH-02 says redirect non-admin users to `/login`, but they're already authenticated. Showing them the login page is confusing.
**Why it happens:** Design decision -- non-admins should not know the admin panel exists.
**How to avoid:** Keep the redirect to `/login` as specified. The user will see they're already logged in and the login page will redirect them to `/app` (existing behavior in line 37-44 of `updateSession()`). Wait -- this creates a redirect loop for non-admin authenticated users hitting `/admin/*`: proxy sends to `/login`, login page middleware sends authenticated user to `/app`. This is actually correct -- not a loop, just a two-step redirect back to `/app`.
**Warning signs:** None -- this flow is correct by design.

## Code Examples

### globals.css Dark Mode Fix (AUTH-05)
```css
/* Line 4 of app/globals.css */
/* BEFORE (broken): */
@custom-variant dark (&:is(.dark *));

/* AFTER (fixed): */
@custom-variant dark (&:where(.dark, .dark *));
```
Source: Tailwind CSS v4 official docs (https://tailwindcss.com/docs/dark-mode) and community verification

### AdminSidebar Navigation Structure
```typescript
// components/admin/AdminSidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, BookOpen, Users,
  Building2, UserCheck, Settings
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'CORE',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/new-activity', label: 'Nguoi dung moi', icon: TrendingUp },
      { href: '/admin/knowledge-base', label: 'Ton kho tri thuc', icon: BookOpen },
      { href: '/admin/users', label: 'Khach hang', icon: Users },
    ],
  },
  {
    label: 'CHECKED',
    items: [
      { href: '/admin/check-clinics', label: 'Check Phong kham', icon: Building2 },
      { href: '/admin/check-users', label: 'Check Nguoi dung', icon: UserCheck },
    ],
  },
  {
    label: 'OTHER',
    items: [
      { href: '/admin/settings', label: 'Cai dat', icon: Settings },
    ],
  },
] as const

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] min-w-[240px] h-screen bg-[#1a1f2e] text-white flex flex-col">
      {/* Logo area */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <span className="text-lg font-semibold">Bamboo Vet</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-4 mb-2 text-xs font-semibold tracking-wider text-teal-400 uppercase">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 mx-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-white text-[#1a1f2e] font-medium'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

### Refresh Server Action Pattern
```typescript
// app/admin/_actions/refresh-views.ts
'use server'

import { createServiceClient } from '@/lib/supabase/server'

export async function refreshMaterializedViews() {
  const svc = createServiceClient()

  // 3 views with CONCURRENTLY, 1 without
  await Promise.all([
    svc.rpc('', { /* or raw SQL */ }).then(() => {}), // placeholder
  ])

  // Actually use raw SQL via Supabase's .rpc or pg function
  const views = [
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_queries',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_queries',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats',
    'REFRESH MATERIALIZED VIEW mv_dashboard_kpis',
  ]

  for (const sql of views) {
    // Note: Supabase JS client doesn't have raw SQL exec.
    // Use a Postgres function or the existing refresh-views.ts pattern.
    // The existing scripts/refresh-views.ts already handles this.
  }
}
```

**Note:** The existing `scripts/refresh-views.ts` handles view refresh. For the server action, the planner should decide whether to:
1. Call the same logic inline (duplicate), or
2. Extract the refresh logic to a shared module imported by both the script and the server action.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16.0.0 | File convention renamed; `middleware` export deprecated |
| `darkMode: 'class'` in tailwind.config.js | `@custom-variant dark` in CSS | Tailwind v4 | Config-less, CSS-first approach |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | New SSR package, cookie-based auth |
| `getSession()` for auth checks | `getUser()` for auth checks | Supabase SSR best practice | `getUser()` verifies with auth server, `getSession()` can be spoofed |
| shadcn/ui (Radix primitives) | shadcn/ui (base-ui primitives) | shadcn v4 | This project uses `@base-ui/react`, NOT `@radix-ui` |

**Deprecated/outdated:**
- `middleware.ts` file convention: Deprecated in Next.js 16, replaced by `proxy.ts`
- `tailwind.config.js` for dark mode: Replaced by `@custom-variant` in CSS in Tailwind v4
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`

## Existing shadcn/ui Components Available

The project already has these shadcn/ui components installed (using `@base-ui/react` primitives, NOT Radix):

| Component | File | Relevant to Phase 2 |
|-----------|------|---------------------|
| Dialog | `components/ui/dialog.tsx` | Used by `ClinicDetailModal` (Phase 5, stub now) |
| Sheet | `components/ui/sheet.tsx` | Used by `UserHistoryDrawer` (Phase 5, stub now) |
| Button | `components/ui/button.tsx` | Admin top bar, refresh button |
| Card | `components/ui/card.tsx` | KpiCard base |
| Badge | `components/ui/badge.tsx` | is_admin badge on settings |
| Input | `components/ui/input.tsx` | FilterBar search |
| Separator | `components/ui/separator.tsx` | Layout dividers |
| Scroll Area | `components/ui/scroll-area.tsx` | Sidebar overflow |
| Skeleton | `components/ui/skeleton.tsx` | Loading states |
| Tooltip | `components/ui/tooltip.tsx` | Nav item tooltips |
| Sidebar | `components/ui/sidebar.tsx` | Product A sidebar (do NOT reuse for admin) |

**Important:** The `components/ui/sidebar.tsx` is the Product A sidebar (uses shadcn SidebarProvider). The admin sidebar is a SEPARATE component at `components/admin/AdminSidebar.tsx` -- it is a simple static layout column, not using the shadcn sidebar system.

## Open Questions

1. **Refresh Server Action Implementation**
   - What we know: `scripts/refresh-views.ts` already refreshes views. The admin top bar needs a "Lam moi du lieu" button.
   - What's unclear: Supabase JS client doesn't expose raw SQL execution. The existing script uses `supabase.rpc()` or a custom function. Need to check how `scripts/refresh-views.ts` actually executes the REFRESH commands.
   - Recommendation: Read `scripts/refresh-views.ts` during planning to understand the refresh mechanism, then extract shared logic for the server action.

2. **Dynamic Import Safety in Proxy**
   - What we know: `createServiceClient()` uses no-op cookies and should work in proxy context. Next.js 16 proxy uses Node.js runtime.
   - What's unclear: Whether the top-level `import { cookies } from 'next/headers'` in `server.ts` causes issues when the module is imported in proxy context.
   - Recommendation: Test with a direct import first. If it fails, use dynamic `import()` or extract `createServiceClient` to its own file.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual smoke testing (no automated test framework detected) |
| Config file | none -- no jest/vitest/playwright config found |
| Quick run command | `npm run build && npm run dev` (manual verification) |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Unauthenticated /admin/* -> /login | smoke | Manual: visit /admin/dashboard logged out | N/A |
| AUTH-02 | Non-admin /admin/* -> /login | smoke | Manual: login as non-admin, visit /admin/dashboard | N/A |
| AUTH-03 | Admin /app -> /admin/dashboard | smoke | Manual: login as admin, observe redirect | N/A |
| AUTH-04 | requireAdmin() returns correctly | unit | Could write vitest test | Wave 0 |
| AUTH-05 | Dark mode selector works | visual | Manual: check dark background renders | N/A |
| SHELL-01 | Admin layout renders sidebar + top bar | visual | Manual: visit /admin/dashboard as admin | N/A |
| SHELL-02 | Sidebar 3 sections, 7 items, active state | visual | Manual: navigate between pages | N/A |
| SHELL-03 | Top bar breadcrumb + refresh button | visual+smoke | Manual: click refresh, verify no error | N/A |
| SHELL-04 | Settings page with profile + timestamp | visual | Manual: visit /admin/settings | N/A |
| SHELL-05 | No language toggle, no RAGflow | visual | Manual: verify absence | N/A |
| COMP-01 through COMP-07 | Components render without errors | smoke | `npm run build` (type checking + compilation) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (catches type errors and import issues)
- **Per wave merge:** Full manual smoke test of all admin routes
- **Phase gate:** All admin routes accessible as admin, all redirects work, all components render

### Wave 0 Gaps
- No automated test framework is configured in this project. All validation is manual smoke testing + build verification.
- The `npm run build` command serves as the primary automated verification (TypeScript compilation, import resolution, page rendering).
- Consider adding a basic Playwright config for smoke tests if time permits, but this is NOT a Phase 2 requirement.

## Sources

### Primary (HIGH confidence)
- Next.js 16 official docs - proxy.ts file convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Tailwind CSS v4 dark mode docs: https://tailwindcss.com/docs/dark-mode
- Supabase SSR docs - creating a client: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Existing codebase files: `proxy.ts`, `lib/supabase/middleware.ts`, `lib/supabase/server.ts`, `app/globals.css`, `app/app/layout.tsx`, `app/(auth)/login/page.tsx`, `package.json`

### Secondary (MEDIUM confidence)
- Supabase SSR auth setup for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Next.js 16 blog post: https://nextjs.org/blog/next-16
- Community guidance on dark mode fix: https://www.sujalvanjare.com/blog/fix-dark-class-not-applying-tailwind-css-v4

### Tertiary (LOW confidence)
- Next.js 16 proxy runtime default (Node.js vs Edge): Some documentation inconsistency exists. The official proxy.ts docs say "Proxy defaults to using the Node.js runtime" but version history notes may differ. Smoke test will confirm.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, versions verified via npm
- Architecture: HIGH - Patterns derived from existing codebase + official docs
- Pitfalls: HIGH - Dark mode bug confirmed in existing code, proxy convention verified against official docs
- proxy.ts correction: HIGH - Verified directly from official Next.js 16 docs

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack, no fast-moving dependencies)
