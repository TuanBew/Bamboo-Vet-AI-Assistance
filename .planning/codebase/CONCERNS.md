# Codebase Concerns

**Analysis Date:** 2026-03-18

## Tech Debt

**SSE Stream Error Handling in Chat Route:**
- Issue: The SSE stream in `app/api/chat/route.ts` catches all exceptions silently with empty catch blocks, masking real failures in RAGflow parsing and database operations.
- Files: `app/api/chat/route.ts` (lines 90-107, 119, 133), `components/chat/ChatInterface.tsx` (line 96)
- Impact: Errors during message parsing (line 103) or database saves (lines 115-133) are logged to console but not exposed to the user. Failed chat saves are indistinguishable from successful ones, leading to data loss without user awareness.
- Fix approach: Replace silent catch blocks with explicit error tracking. Consider wrapping database operations in a separate try-catch that saves errors to a failed_saves table or sends structured logs to monitoring. For RAGflow parse errors, enqueue error events in the SSE stream.

**Unvalidated Supabase Query Results:**
- Issue: Multiple API routes query Supabase without validating the shape or type of returned data before use.
- Files: `app/api/conversations/[id]/route.ts` (lines 24-27), `app/app/conversation/[id]/page.tsx` (lines 29-33)
- Impact: If a database schema changes or a migration partially fails, the code will silently return malformed data or crash at runtime. No schema validation layer exists.
- Fix approach: Add Zod or TypeScript runtime validators for all Supabase responses. Define explicit response schemas at the API boundary.

**Hardcoded Rate Limit Values:**
- Issue: Rate limit thresholds (30 requests/60s for guests, 60/60s for authenticated) are hardcoded in `app/api/chat/route.ts` (lines 8-9) with no configuration mechanism.
- Files: `app/api/chat/route.ts` (lines 8-9)
- Impact: Changing rate limits requires code modification and redeployment. No A/B testing or gradual rollout of changes possible.
- Fix approach: Move limits to environment variables or a feature-flag service.

**IP Extraction for Rate Limiting:**
- Issue: IP extraction in `app/api/chat/route.ts` (line 17) uses `x-forwarded-for?.split(',')[0]` without trimming or validation.
- Files: `app/api/chat/route.ts` (line 17)
- Impact: Malformed headers with spaces (e.g., ` 1.2.3.4`) will create incorrect rate limit keys, allowing bypass.
- Fix approach: Trim the extracted IP: `split(',')[0].trim()`

## Known Bugs

**Conversation Title Update Race Condition:**
- Symptoms: If two concurrent requests hit the same conversation before the first has set the title, both might attempt to set the title simultaneously, causing unnecessary database writes.
- Files: `app/api/chat/route.ts` (lines 121-134)
- Trigger: Create a new conversation and send two messages rapidly in parallel.
- Workaround: None. The code relies on Supabase RLS and happens to work most of the time due to timing, but is not atomic.

**Message History Truncation Applied Client-Side:**
- Symptoms: Chat history is truncated to 40 messages client-side (line 43 in `components/chat/ChatInterface.tsx`) and server-side (line 55 in `app/api/chat/route.ts`), but the server does not enforce this limit on initial load. Large conversations load all messages into memory.
- Files: `app/app/conversation/[id]/page.tsx` (lines 29-33), `components/chat/ChatInterface.tsx` (line 43)
- Trigger: Load a conversation with 1000+ messages.
- Workaround: Manually delete old messages via database.

**Interrupt Flag Not Persisted:**
- Symptoms: The `interrupted` flag added to a message when the stream closes unexpectedly (line 107 in `components/chat/ChatInterface.tsx`) is only in client state and never saved to the database. On refresh, the message appears complete.
- Files: `components/chat/ChatInterface.tsx` (lines 104-110), `app/api/chat/route.ts` (lines 112-136)
- Trigger: Send a message, interrupt the browser stream mid-response, refresh the page.
- Workaround: Manual database edit to mark messages as incomplete.

## Security Considerations

**CSP Header Allows Unsafe Inline Scripts:**
- Risk: The Content-Security-Policy header in `next.config.js` (line 15) includes `'unsafe-inline'` and `'unsafe-eval'`, which defeats much of CSP's protection against XSS attacks.
- Files: `next.config.js` (line 15)
- Current mitigation: None. The app likely requires inline styles or scripts that prevent stricter CSP enforcement.
- Recommendations: Audit the codebase to eliminate inline event handlers and scripts. Migrate inline styles to Tailwind classes. Once cleaned up, remove `'unsafe-inline'` and `'unsafe-eval'`.

**Service Role Key Exposure Risk:**
- Risk: `SUPABASE_SERVICE_ROLE_KEY` is used in server-side code (`lib/supabase/server.ts`, `app/api/*/route.ts`). If the deployment environment is compromised, this key grants admin access to all data.
- Files: `lib/supabase/server.ts` (line 30), `app/api/chat/route.ts` (not visible in code, but service client is created), all API routes
- Current mitigation: Key is only available server-side (not exposed to client bundle). Environment variable isolation in deployment.
- Recommendations: Implement row-level security (RLS) policies on all tables to reduce the blast radius. Rotate the service role key regularly. Log and monitor service role usage.

**OAuth Redirect Validation:**
- Risk: The OAuth callback route in `app/auth/callback/route.ts` (lines 8-9) validates the `next` parameter but the validation regex `!rawNext.includes('//')` is insufficient. An attacker could use Unicode escapes or newline characters to bypass it.
- Files: `app/auth/callback/route.ts` (lines 8-9)
- Current mitigation: Basic string check prevents `//` redirects.
- Recommendations: Replace with a URL parser and explicit allowlist of safe paths: `const safeNexts = ['/app', '/chat']; const next = safeNexts.includes(rawNext) ? rawNext : '/app'`

**Message Sanitization Limited to HTML:**
- Risk: The `stripHtml` function in `app/api/chat/route.ts` (line 40) removes HTML but does not sanitize for SQL injection, prompt injection, or stored XSS payloads. A user could send JSON-like content that, if reflected in error messages or logs without escaping, could cause issues.
- Files: `app/api/chat/route.ts` (line 40), `components/chat/ChatInterface.tsx` (entire message rendering)
- Current mitigation: HTML stripping prevents basic XSS. Supabase client-side encoding provides some protection.
- Recommendations: Use a DOMPurify or similar library for comprehensive sanitization. Escape all user content when rendering in MessageBubble component.

## Performance Bottlenecks

**Entire Conversation Loaded on Page Load:**
- Problem: The conversation page (`app/app/conversation/[id]/page.tsx`) loads all messages for a conversation without pagination or lazy loading.
- Files: `app/app/conversation/[id]/page.tsx` (lines 29-33)
- Cause: `select('id, role, content').eq('conversation_id', id)` fetches all rows. No `limit()` or `offset()` applied.
- Improvement path: Implement cursor-based pagination. Load 50 messages initially, fetch older messages on scroll. Cache with `React.lazy` or SWR.

**No Message Caching or Deduplication:**
- Problem: Every page load or router refresh in `components/chat/ChatInterface.tsx` (line 114) refetches the entire conversation.
- Files: `components/chat/ChatInterface.tsx` (line 114)
- Cause: `router.refresh()` triggers a full server re-render without caching.
- Improvement path: Use SWR or React Query to cache conversation data client-side with a configurable stale time. Only refetch on focus or after mutations.

**Rate Limit Redis Calls on Every Request:**
- Problem: Each chat request makes a call to Upstash Redis to check rate limits, adding ~100-200ms latency per request.
- Files: `app/api/chat/route.ts` (lines 7-20)
- Cause: Ratelimit is not cached; every request hits Redis.
- Improvement path: Use local in-memory rate limiting for the first N requests, with a fallback to Redis. Consider implementing a token-bucket algorithm with automatic refills instead of sliding windows.

## Fragile Areas

**RAGflow Integration Dependency:**
- Files: `lib/ragflow.ts`, `app/api/chat/route.ts` (lines 58-63)
- Why fragile: The chat feature is entirely dependent on RAGflow being available. No fallback, circuit breaker, or graceful degradation. If RAGflow is down, users get a 502 error with no context.
- Safe modification: Implement a health check endpoint. Add retry logic with exponential backoff. Store the last successful RAGflow response and offer a "cached answer" fallback.
- Test coverage: No tests for RAGflow timeouts or error responses. No tests for SSE stream closure.

**Database Schema Assumptions:**
- Files: All API routes in `app/api/`, conversation page in `app/app/conversation/[id]/page.tsx`
- Why fragile: The code assumes table schemas (e.g., `conversations.title`, `messages.role`, `messages.content`) but has no validation. A schema migration without updating code will cause silent failures.
- Safe modification: Add a database validation layer or ORM (e.g., Drizzle, Prisma) to enforce schema consistency.
- Test coverage: No integration tests against actual Supabase schema.

**Auth Middleware Matching Pattern:**
- Files: `proxy.ts` (line 10)
- Why fragile: The middleware matcher regex in `proxy.ts` is complex and easy to misconfigure. A single typo could expose authenticated routes or block public ones.
- Safe modification: Test the matcher pattern thoroughly with unit tests. Document each clause with examples.
- Test coverage: No tests for middleware routing.

**Bilingual Context Provider:**
- Files: `lib/i18n/LanguageContext.tsx`
- Why fragile: Language is stored in a cookie. If the cookie is deleted or corrupted, the provider might default unexpectedly. No error boundary or fallback language mechanism.
- Safe modification: Add validation to the cookie value. Implement an error boundary that catches language provider errors.
- Test coverage: No tests for missing or invalid language cookies.

## Scaling Limits

**Upstash Redis Rate Limit Throughput:**
- Current capacity: Upstash Redis typically handles 100-1000 requests/second depending on plan.
- Limit: If the app scales to thousands of concurrent users, Redis rate-limit checks become a bottleneck.
- Scaling path: Implement local in-memory rate limiting with a background sync to Redis. Use a distributed rate-limiting service with higher throughput (e.g., AWS API Gateway throttling). Consider switching to a session-based rate limiter.

**Supabase Connection Pooling:**
- Current capacity: Supabase enforces connection limits (usually 100-200 per project).
- Limit: If the app makes many concurrent database queries (e.g., loading conversations for many users simultaneously), connections will saturate.
- Scaling path: Use Supabase's built-in connection pooling (PgBouncer). Batch queries where possible. Implement a queue system for heavy operations.

**Message History Memory Usage:**
- Current capacity: Storing 40 messages client-side in React state is acceptable.
- Limit: If conversations grow to 10,000+ messages, loading all into memory will cause browser slowdown.
- Scaling path: Implement virtual scrolling (windowing) for the message list. Use IndexedDB for local persistence of old messages. Implement server-side pagination.

## Dependencies at Risk

**@supabase/ssr@0.9.0:**
- Risk: The package is actively maintained, but Supabase is a young ecosystem. A breaking change in `@supabase/ssr` or its dependencies could cause auth to fail.
- Impact: Authentication would break for all users.
- Migration plan: Monitor Supabase release notes. Test major updates in a staging environment. Consider pinning to a specific version for production stability.

**Next.js@16.1.6:**
- Risk: Next.js updates are frequent and sometimes introduce subtle behavioral changes. The app uses experimental features like App Router and Server Components.
- Impact: A major version bump could require significant refactoring.
- Migration plan: Schedule quarterly Next.js updates. Test thoroughly after each update. Follow Next.js upgrade guides.

**Tailwind CSS@4:**
- Risk: Version 4 introduced breaking changes in @apply syntax. If this is not handled correctly in globals.css, styles could break.
- Impact: Visual regression across the app.
- Migration plan: Review the migration guide. Test the app in development. Run visual regression tests after updates.

**RAGflow (External Service):**
- Risk: RAGflow is a third-party AI service with no guaranteed SLA. The local instance depends on Docker and Python dependencies that could fail.
- Impact: If RAGflow goes down, the entire chat feature is unavailable.
- Migration plan: Add monitoring and alerting for RAGflow health. Implement a fallback to a different AI provider (e.g., OpenAI, Anthropic). Document the RAGflow setup process thoroughly.

## Missing Critical Features

**No Database Backup/Disaster Recovery:**
- Problem: The app stores user conversations and messages in Supabase but has no backup or disaster recovery plan. If the database is compromised or deleted, all user data is lost.
- Blocks: Cannot guarantee data durability to users. Cannot comply with GDPR right-to-restore requests.

**No Audit Logging:**
- Problem: No logs of who accessed which conversation, when, or what was deleted. Critical for compliance and debugging.
- Blocks: Cannot investigate data breaches or unauthorized access. Cannot meet healthcare/veterinary compliance requirements.

**No Admin Dashboard:**
- Problem: Admins have no interface to manage users, view platform metrics, or moderate conversations. All operations are manual via Supabase SQL editor.
- Blocks: Platform cannot scale to support multiple admins or clinics.

**No Email Notifications:**
- Problem: Users receive no notifications for password resets, login alerts, or conversation-related events.
- Blocks: Users cannot recover lost passwords or stay informed about their data.

## Test Coverage Gaps

**API Route Error Paths:**
- What's not tested: Error responses from RAGflow timeouts, malformed requests, rate-limit boundaries, database constraint violations.
- Files: `app/api/chat/route.ts`, `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`
- Risk: Critical code paths for error handling are untested and could behave unexpectedly in production.
- Priority: High

**Supabase RLS Policy Enforcement:**
- What's not tested: Whether RLS policies correctly prevent unauthorized data access. No tests verify that a user cannot access another user's conversations.
- Files: All API routes and server components that query Supabase
- Risk: Authorization bypasses could expose sensitive veterinary data.
- Priority: High

**Message Sanitization:**
- What's not tested: Whether stripHtml correctly handles edge cases (nested HTML, encoded entities, Unicode). Whether XSS payloads are prevented in message rendering.
- Files: `app/api/chat/route.ts` (line 40), `components/chat/MessageBubble.tsx`
- Risk: Stored XSS attacks could compromise user accounts.
- Priority: High

**Language Context Switching:**
- What's not tested: Switching languages mid-session. Missing or corrupted language cookies. Language context fallback behavior.
- Files: `lib/i18n/LanguageContext.tsx`
- Risk: Users could see untranslated content or broken UI.
- Priority: Medium

**SSE Stream Parsing:**
- What's not tested: Malformed SSE lines, incomplete JSON, network interruptions, duplicate tokens.
- Files: `lib/ragflow.ts` (parseSseLine), `components/chat/ChatInterface.tsx` (lines 72-98)
- Risk: Stream parsing errors could display garbage or incomplete responses to users.
- Priority: Medium

**OAuth Callback Validation:**
- What's not tested: Open redirect attempts with various payloads. Unicode/percent-encoded bypasses. Malformed code/state parameters.
- Files: `app/auth/callback/route.ts`
- Risk: Phishing attacks via redirect.
- Priority: Medium

---

*Concerns audit: 2026-03-18*
