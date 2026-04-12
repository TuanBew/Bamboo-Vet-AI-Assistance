# AI Analysis Board — Design Document

**Date**: 2026-04-12  
**Status**: Approved  
**Branch**: `feature/ai-analysis-board`  
**Constraint**: Database READ-ONLY. Product A FROZEN.

---

## 1. Component Architecture & File Structure

### Files to Create
- `components/admin/AIAnalysisBoard.tsx` — client component (state machine, timer, render)
- `app/api/ai-analysis/route.ts` — POST proxy (Supabase → Gemini → sanitized HTML)
- `lib/admin/services/ai-analysis.ts` — pure data aggregation helpers (unit-testable)
- `tests/performance/ai-analysis.spec.ts` — Playwright E2E tests
- `lib/admin/__tests__/ai-analysis.test.ts` — unit tests for aggregation logic

### Files to Modify
- `app/admin/dashboard/DashboardClient.tsx` — insert AIAnalysisBoard after filter bar
- `lib/i18n/vietnamese.ts` — add aiAnalysis namespace
- `.env.local` — add GEMINI_API_KEY (server-side only, no NEXT_PUBLIC_ prefix)
- `package.json` — add isomorphic-dompurify

### Insertion Point
After filter bar closing tag (~line 378 in DashboardClient.tsx), before Tong Quan section.
Receives `committedFilters` prop (committed state, not pending UI state).

---

## 2. Data Flow

DashboardClient mounts -> AIAnalysisBoard renders in 'waiting' state -> silent 10s timer starts.

After 10 seconds (or immediately if gateOpen=true and filters changed):

POST /api/ai-analysis
  1. requireAdmin() check — 403 if not admin
  2. rpc('dashboard_door_monthly', empty_filters) -> monthly sales all-NPP
  3. rpc('dashboard_dpur_monthly', empty_filters) -> monthly purchases all-NPP
  4. aggregateForGemini() in JS -> compact JSON (36 rows max)
  5. POST to Gemini API (GEMINI_API_KEY server-side only)
  6. Strip markdown wrapper from response
  7. Return { html: string }

Client receives html:
  1. isomorphic-dompurify.sanitize() with allowlist [b, strong, em, ul, ol, li, p, br]
  2. Render via innerHTML into board content area

NOTE: All RPCs use empty filter params — AI always sees company-wide data regardless of user filters.

---

## 3. UX State Machine

States: 'waiting' | 'loading' | 'ready' | 'error'

- waiting: pulsing skeleton + "AI dang chuan bi phan tich du lieu..." (silent timer running)
- loading: spinner + "AI dang phan tich du lieu..." (API call in flight)  
- ready: rendered HTML with 4 analysis sections
- error: Vietnamese error message + retry button

Gate logic:
- gateOpen=false on every mount
- One-shot setTimeout(10_000) starts on mount, does NOT reset on filter changes
- filtersRef tracks current committedFilters via sync useEffect (no timer restart)
- After first success: gateOpen=true, subsequent filter changes trigger immediate fetch

Cache logic:
- In-memory Map<string, string> (component state, resets on re-mount)
- Key: JSON.stringify(committedFilters)
- Cache hit on mount -> ready instantly, gateOpen=true
- Cache miss on mount -> 10s timer
- Cache miss post-gate -> immediate fetch

---

## 4. Security

- GEMINI_API_KEY: server-side only (.env.local, no NEXT_PUBLIC_ prefix)
- HTML sanitization: isomorphic-dompurify with allowlist before innerHTML render
- Auth: requireAdmin() in API route, 403 for non-admin
- Markdown stripping: API route removes backtick-html wrappers from Gemini response

---

## 5. Performance Impact

- Zero impact on dashboard initial load (board renders as skeleton, no API call for 10s)
- Zero impact on fast/slow data paths (separate API route)
- 2 RPC calls per AI request, at most once per 10s per user
- Board state changes isolated — no parent re-renders

---

## 6. Token Estimate

- Input: ~750 tokens (350 system prompt + 400 data payload)
- Output: ~700 tokens
- Cost: ~$0.00035/request (Gemini 2.0 Flash pricing)

---

## 7. Visual Design

- bg-amber-50 border border-amber-200 rounded-lg
- Left accent: border-l-4 border-l-amber-500
- Sparkles icon (amber) + "AI phan tich" title
- Collapse chevron on right (expanded by default, not persisted)

---

## 8. Implementation Batches

- Batch 1: API route + Gemini integration + data aggregation + unit tests
- Batch 2: AIAnalysisBoard component + loading states + timer logic
- Batch 3: Gate logic + caching + HTML rendering + DashboardClient integration
- Batch 4: Edge cases + error states + collapse toggle + Playwright E2E
