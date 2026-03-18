# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Next.js App Router with Server Components, Client Components, API Routes, and Real-time Streaming

**Key Characteristics:**
- Server-side rendering for layout and authentication-gated pages
- Client-side components for interactive chat and real-time UI updates
- Streaming API responses for long-running AI operations
- Database-backed conversation persistence via Supabase
- Middleware-based session management with row-level security
- Language context provider for i18n at the React level
- SSE (Server-Sent Events) for real-time streaming from RAGflow LLM

## Layers

**Presentation Layer (Client):**
- Purpose: Render UI, handle user interactions, stream responses in real-time
- Location: `components/` (feature-specific subdirectories)
- Contains: React functional components (`.tsx` files), UI primitives, feature-specific logic
- Depends on: `lib/i18n/LanguageContext`, `lib/supabase/client`, hooks
- Used by: Pages (`app/**/*page.tsx`)

**Page/Layout Layer (Server & Client):**
- Purpose: Orchestrate page composition, guard routes, fetch initial data
- Location: `app/` (using Next.js App Router convention)
- Contains: Page components, layout components, server components fetching data
- Depends on: Supabase server clients, components
- Used by: Next.js router, browser requests

**API Layer (Backend):**
- Purpose: Handle authenticated requests, coordinate external services, persist data
- Location: `app/api/`
- Contains: Route handlers (`route.ts` files), business logic
- Depends on: Supabase server/service clients, RAGflow, Upstash Redis (rate limiting)
- Used by: Client-side fetch calls

**Business Logic Layer:**
- Purpose: Encapsulate external service integrations and utilities
- Location: `lib/` subdirectories
- Contains: Supabase client factories (`lib/supabase/`), RAGflow integration (`lib/ragflow.ts`), i18n logic (`lib/i18n/`)
- Depends on: External SDKs (@supabase/ssr, @supabase/supabase-js, fetch API)
- Used by: API routes, pages, components

**Cross-Cutting Concerns:**
- Purpose: Apply to all requests, manage authentication state, update session cookies
- Location: `lib/supabase/middleware.ts`, `proxy.ts`
- Contains: Middleware logic for session refresh and route guards
- Depends on: Supabase SDK
- Used by: Next.js request pipeline (via proxy.ts config)

## Data Flow

**Chat Submission (Authenticated User):**

1. User types message in `components/chat/ChatInterface.tsx` (client component)
2. `sendMessage()` handler calls `POST /api/chat` with message history
3. API route validates session, rate limits, sanitizes input
4. API resolves service client and calls `callRagflow()` (`lib/ragflow.ts`)
5. RAGflow returns SSE stream, API relays directly to browser via ReadableStream
6. Client parses SSE chunks in real-time, updates message state
7. API simultaneously accumulates full text in background
8. When stream completes, API saves messages to `messages` table (Supabase)
9. If first message in conversation, API updates `conversations.title`
10. Client refreshes sidebar via `router.refresh()` to sync conversation list

**Chat Submission (Guest User):**

1. Same flow as authenticated, except:
   - No verification of conversation ownership
   - Messages NOT saved to database
   - Stream ends and nothing is persisted
   - No conversation title update

**Conversation Load (Authenticated User):**

1. User navigates to `/app/conversation/[id]` (server component)
2. Route handler verifies user owns conversation (row-level security)
3. Fetches all messages for this conversation from DB via service client
4. Renders `ChatInterface` with `initialMessages` prop
5. User can continue chatting from loaded history

**Landing & Auth Flow:**

1. `/` (landing): Renders via server component, shows feature list
2. User clicks "Get Started" → `/chat` (public guest chat)
3. User creates account → `/signup` → Supabase email/password or Google OAuth
4. On successful OAuth: Redirects to `auth/callback` route
5. `auth/callback` exchanges authorization code for session
6. Middleware auto-redirects logged-in users from `/login` and `/signup` to `/app`
7. Middleware guards `/app/*` routes, redirects unauthenticated to `/login`

**State Management:**

- Session state: Managed by Supabase SDK (stored in cookies, refreshed by middleware)
- UI state: React hooks (useState) in client components
- Language state: React Context (`LanguageContext`) with cookie persistence
- Conversation list state: Fetched server-side in layout, revalidated via `router.refresh()`
- Chat message state: Local React state, no persistence for guests, saved to DB for authenticated users

## Key Abstractions

**Supabase Client Factory Pattern:**
- Purpose: Separate authenticated client (with user session) from service client (admin bypass)
- Examples: `lib/supabase/server.ts`, `lib/supabase/client.ts`
- Pattern: Functions that encapsulate client creation, cookie adapter configuration. Service client uses no-op cookies for safety in streams.

**Language Context Provider:**
- Purpose: Provide translation function and language toggle across entire app
- Examples: `lib/i18n/LanguageContext.tsx`
- Pattern: React Context with memoized `t()` function, toggle persists to cookies

**Streaming Response Handler:**
- Purpose: Real-time relay of external API stream while accumulating for persistence
- Examples: `app/api/chat/route.ts` (ReadableStream with dual consumption)
- Pattern: ReadableStream controller reads from source, enqueues to browser, decodes and accumulates simultaneously

**Rate Limiting Abstraction:**
- Purpose: Enforce sliding-window rate limits per IP or user
- Examples: `app/api/chat/route.ts` (Upstash Redis with `guestLimit` / `authLimit`)
- Pattern: IP-based for guests (30 per 60s), user-based for authenticated (60 per 60s)

## Entry Points

**Landing Page:**
- Location: `app/(public)/page.tsx`
- Triggers: Direct navigation to `/`, landing from marketing
- Responsibilities: Display hero section, feature highlights, call-to-action to `/chat`

**Public Chat Page:**
- Location: `app/(public)/chat/page.tsx`
- Triggers: Unauthenticated users clicking "Get Started" or navigating directly
- Responsibilities: Render chat interface without persistence, show sign-up nudge banner

**App Authenticated Chat:**
- Location: `app/app/` (protected by middleware)
- Triggers: Authenticated users navigating `/app` or `/app/conversation/[id]`
- Responsibilities: Load conversation history, render sidebar with previous chats, protect with auth check

**Auth Callback:**
- Location: `app/auth/callback/route.ts`
- Triggers: OAuth provider redirects here after user grants permission
- Responsibilities: Exchange authorization code for session, redirect to `/app` or original path

**Login/Signup Pages:**
- Location: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
- Triggers: Unauthenticated users or explicit `/login` navigation
- Responsibilities: Handle email/password or Google OAuth sign-in

## Error Handling

**Strategy:** Multi-layered validation and user-friendly feedback

**Patterns:**

- **Input Validation:** HTML sanitization via `string-strip-html`, length limits (0-2000 chars), required checks
- **API Errors:** Returned as JSON with `{ error: string }` field, HTTP status codes (429 rate-limited, 400 bad request, 401 unauthorized, 500 server error, 502 downstream error)
- **Client-side Error Display:** Error state in `ChatInterface` component shows red alert with retry button, can restore input from history
- **Stream Interruption:** Marks message as `interrupted: true` if stream closes without `[DONE]` token, displays warning to user
- **Auth Failures:** Middleware redirects unauthenticated requests to `/login`, handles invalid sessions
- **Rate Limit Overages:** Returns 429 with `rate_limited` error code, client displays translated message
- **RAGflow Unavailable:** Returns 502 with `ragflow_unavailable`, client shows generic error

## Cross-Cutting Concerns

**Logging:** `console.error()` for backend failures (e.g., database save errors, RAGflow failures). No dedicated logging service.

**Validation:** Input sanitization in `app/api/chat/route.ts` (HTML stripping, length checks), ownership verification via row-level security + explicit checks in API routes.

**Authentication:** Supabase session cookies, refreshed by middleware on every request. Protected routes redirect to `/login`. Service client used for admin operations in API routes.

**Internationalization:** Two-language context at root layout. Language stored in cookies, read from cookies on server render. Translation keys typed and centralized in `lib/i18n/translations.ts`.

**Security Headers:** CSP, X-Frame-Options, X-Content-Type-Options configured in `next.config.js`. Allows Supabase and RAGflow URLs in CSP.

**Rate Limiting:** Upstash Redis with sliding window per IP or user ID, separate limits for guests (30/min) and authenticated (60/min).
