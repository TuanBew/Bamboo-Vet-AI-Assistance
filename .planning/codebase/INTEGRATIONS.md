# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**RAGFlow AI:**
- RAGFlow Document RAG Engine - Powers the vet chatbot AI responses via OpenAI-compatible `/chat/completions` endpoint
  - SDK/Client: Native HTTP fetch (no SDK, direct API calls in `lib/ragflow.ts`)
  - Auth: Bearer token via `RAGFLOW_API_KEY` environment variable
  - Endpoint: `RAGFLOW_BASE_URL/api/v1/chats_openai/{chatId}/chat/completions`
  - Protocol: HTTP POST with streaming (Server-Sent Events)
  - Used in: `app/api/chat/route.ts` for chat message processing

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Provider: Supabase (managed PostgreSQL with Auth layer)
  - Connection: Via Supabase JavaScript SDK using `NEXT_PUBLIC_SUPABASE_URL`
  - Client: `@supabase/supabase-js` (browser) and `@supabase/ssr` (server)
  - Schema: `supabase/schema.sql`
  - Tables:
    - `conversations` - User chat sessions with title and timestamps
    - `messages` - Chat messages (user/assistant) linked to conversations
  - Auth: Supabase built-in authentication with JWT sessions
  - RLS: Row-level security enabled on both tables; users can only access their own conversations/messages
  - Used in:
    - `lib/supabase/client.ts` - Browser-side client creation
    - `lib/supabase/server.ts` - Server-side client with service role for privileged operations
    - `app/api/chat/route.ts` - Saves conversation and message records
    - `app/api/conversations/route.ts` - Lists and creates user conversations

**File Storage:**
- Local filesystem only - No external file storage (S3, GCS, etc.)

**Caching:**
- Upstash Redis (serverless Redis)
  - Service: Upstash managed Redis with REST API
  - Connection: REST API via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - Client: `@upstash/redis` package
  - Usage: Rate limiting state storage
  - Used in: `app/api/chat/route.ts` for chat endpoint rate limiting

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in)
  - Implementation: Supabase built-in authentication service with email/password and OAuth support
  - Session flow:
    1. User submits email/password on `/login` or `/signup`
    2. Supabase returns JWT and refresh token (stored in secure cookies)
    3. Middleware (`lib/supabase/middleware.ts`) refreshes session on every request
    4. Protected routes verify user existence via `supabase.auth.getUser()`
  - Cookie management: Handled by `@supabase/ssr` with automatic refresh
  - Auth callback: `app/auth/callback/route.ts` exchanges OAuth code for session
  - Protected routes: `/app/*` guarded in middleware; unauthenticated users redirected to `/login`
  - Client creation:
    - Browser: `lib/supabase/client.ts` uses anon key (respects RLS)
    - Server: `lib/supabase/server.ts` with anon key (RLS-enforced) or service role key (bypass RLS, API routes only)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar integration

**Logs:**
- Console logging only (`console.error` in `app/api/chat/route.ts` for database save failures)
- No structured logging framework or external aggregation service

## CI/CD & Deployment

**Hosting:**
- Not specified in codebase, but Next.js optimized for Vercel (implied by framework choice)
- Compatible with: Vercel, Netlify, any Node.js hosting (AWS Lambda, Google Cloud Run, Docker)

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or similar workflow files

## Environment Configuration

**Required env vars:**

**RAGFlow Configuration (Production/Development):**
- `RAGFLOW_BASE_URL` - Base URL of RAGFlow API (e.g., `http://127.0.0.1` for local dev or `https://ragflow.example.com` for production)
- `RAGFLOW_API_KEY` - Bearer token for RAGFlow API authentication
- `RAGFLOW_CHAT_ID` - Chat assistant ID in RAGFlow (identifies which knowledge base/assistant to use)

**Supabase Configuration:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (safe to expose, public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe to expose, scoped to RLS policies)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (PRIVATE, bypass RLS, server-only)

**Upstash Configuration:**
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API endpoint (e.g., `https://your-redis.upstash.io`)
- `UPSTASH_REDIS_REST_TOKEN` - Token for Upstash Redis REST API (PRIVATE, server-only)

**Secrets location:**
- Development: `.env.local` (not committed, template provided in `.env.example`)
- Production: Environment variables set in deployment platform (Vercel Environment Variables, AWS Secrets Manager, etc.)
- `.env*` files explicitly in `.gitignore` to prevent secret leakage

## Webhooks & Callbacks

**Incoming:**
- `app/auth/callback/route.ts` - OAuth callback endpoint (receives `code` and `next` query params from Supabase Auth)

**Outgoing:**
- None detected - No webhooks sent to external services

## Rate Limiting

**Implementation:**
- Upstash Ratelimit with sliding window (Redis-backed)
- Guest (unauthenticated) limit: 30 requests per 60 seconds
- Authenticated user limit: 60 requests per 60 seconds
- Identifier: IP address for guests, user ID for authenticated users
- Applied to: `app/api/chat/route.ts` chat endpoint only

---

*Integration audit: 2026-03-18*
