---
name: Phase 7 Performance Optimization Context
type: phase_context
created: 2026-03-29
updated: 2026-03-29
---

# Phase 7: Performance Optimization - Context

**Gathered:** 2026-03-29 (updated after user verification — original fixes insufficient)
**Status:** Ready for replanning

<domain>
## Phase Boundary

Fix server-side performance so that ALL pages (admin and chatbot) load fast.
The original plans addressed SSE streaming and client memoization, but the
real root cause was identified through user testing: middleware making 2
sequential Supabase network calls on every request.

</domain>

<decisions>
## Implementation Decisions

### Root Cause (Confirmed by user testing)
- Network requests hang in DevTools on ALL pages — both admin and chatbot `/app`
- Slow in both dev AND production (eliminates Turbopack as cause)
- Root cause: `proxy.ts` middleware runs `supabase.auth.getUser()` + `profiles.select('is_admin')` on every single request — two sequential Supabase network calls (200-500ms each) before any page renders

### Fix 1: Middleware auth method
- Switch from `getUser()` to `getSession()` in `lib/supabase/middleware.ts`
- `getSession()` reads from cookie locally — zero network calls
- `getUser()` is still called inside server components and API handlers where real security is needed
- This is the Supabase-recommended pattern for middleware specifically

### Fix 2: JWT custom claim for is_admin
- Add `is_admin` to the Supabase JWT via a `custom_access_token_hook` Postgres function
- Middleware reads `session.user.app_metadata.is_admin` from the JWT — no extra DB call
- New SQL migration needed: create the hook function + grant execute permission
- Hook must be registered in Supabase Dashboard > Authentication > Hooks > Custom Access Token

### Fix 3: Skip is_admin check for /app routes
- Regular users on `/app` (chatbot) never need an is_admin DB check
- Only check is_admin for `/admin/*` routes (and auth redirect pages)
- Eliminates the entire profile fetch for chatbot users

### Fix 4: Dashboard SSR streaming
- `app/admin/dashboard/page.tsx` currently blocks rendering until `getDashboardData()` completes
- Move to Suspense streaming: page renders skeleton immediately, data streams in
- `DashboardSkeleton` component already exists at `app/admin/dashboard/DashboardSkeleton.tsx`
- Apply the same pattern to other heavy SSR admin pages (nhap-hang, ton-kho, etc.)

### Prior fixes (Phase 7 plans 01-04) — Keep as-is
- SSE streaming timeout + reader.cancel() cleanup — already implemented, keep
- React.memo / useMemo on client components — already implemented, keep
- check-users server-side pagination — already implemented, keep
- jsonWithCache ETag headers — already implemented, keep

### Claude's Discretion
- Which other admin pages to apply Suspense streaming to (besides dashboard)
- Exact Postgres hook function implementation details
- Whether to add a migration or apply via Supabase Dashboard SQL editor

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Middleware (primary fix target)
- `proxy.ts` — Next.js middleware entry point, calls updateSession
- `lib/supabase/middleware.ts` — Auth session refresh + admin route guard; the double Supabase call is here
- `lib/supabase/server.ts` — createClient / createServiceClient patterns

### Auth and profiles
- `supabase/migrations/20260318_002_alter_profiles.sql` — is_admin column definition on profiles table
- `supabase/migrations/20260318_005_add_profile_trigger.sql` — existing triggers, check before adding new hook

### Admin pages with SSR blocking
- `app/admin/dashboard/page.tsx` — SSR data fetch (getDashboardData) blocking render
- `app/admin/dashboard/DashboardSkeleton.tsx` — skeleton already built, use in Suspense
- `app/admin/nhap-hang/page.tsx` — also does SSR blocking fetch
- `app/admin/ton-kho/page.tsx` — also does SSR blocking fetch

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardSkeleton`: Already implemented at `app/admin/dashboard/DashboardSkeleton.tsx` — can be used directly in Suspense boundary
- `jsonWithCache`: Already implemented at `lib/admin/cache-headers.ts` — ETag utility, keep as-is
- `requireAdmin`: In `lib/admin/auth.ts` — used in API route handlers, separate from middleware auth

### Established Patterns
- All admin page.tsx files follow same pattern: `const data = await getXxxData(params)` then pass as `initialData` to client component
- Middleware pattern: `proxy.ts` → `lib/supabase/middleware.ts:updateSession()`
- Supabase migrations use IF NOT EXISTS guards for idempotent re-runs (see migration 002)

### Integration Points
- JWT hook must be a Postgres function in `public` schema named `custom_access_token_hook`
- Hook registration: Supabase Dashboard > Authentication > Hooks (no config.toml exists, so hosted project)
- After JWT claim is set, middleware reads: `session?.user?.app_metadata?.is_admin`

</code_context>

<specifics>
## Specific Ideas

- "Network requests hang in DevTools on ALL pages — both admin and chatbot"
- "Slow in both dev and production" — confirms this is not a Turbopack/dev-server-only issue
- The fix must reduce middleware overhead from ~400-1000ms to near-zero
- DashboardSkeleton already exists, so streaming is low-effort

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-performance-optimization*
*Context updated: 2026-03-29 (replanning required — original root cause was wrong)*
