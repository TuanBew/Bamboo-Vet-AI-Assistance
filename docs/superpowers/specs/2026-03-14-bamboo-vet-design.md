# Bamboo Vet AI Assistance — Design Specification

**Date:** 2026-03-14
**Status:** Approved (v2 — post spec-review)
**Stack:** Next.js 15 (App Router) · Tailwind CSS · shadcn/ui · Supabase · Vercel · RAGflow · Upstash Redis

---

## Understanding Summary

- **What:** Bilingual (Vietnamese + English) AI chatbot SaaS for veterinarians and clinics
- **Why:** Provides fast, knowledge-base-grounded answers on drug dosages, contraindications, interactions, and treatment protocols — powered by a locally running RAGflow instance
- **Who:** Veterinarians and clinic staff in Vietnam; public users can try for free without login
- **Key constraints:** RAGflow API key must never leave the server; Supabase RLS enforces per-user data isolation; Upstash Redis for distributed rate limiting on Vercel
- **Non-goals (MVP):** 2FA, audit logs, HTTPS for RAGflow, mobile app, multi-user clinic accounts, voice input, email notifications, admin dashboard, payments

---

## Assumptions

1. Google OAuth configured in Supabase dashboard before first deploy
2. Email confirmation is **disabled** in Supabase Auth for MVP — users log in immediately after signup
3. Upstash Redis free tier (~10k req/day) is acceptable for MVP traffic
4. `RAGFLOW_CHAT_ID` filled in by developer from RAGflow dashboard before first use
5. Conversation title = first 50 chars of first user message (no AI title generation API call)
6. RAGflow runs locally at `http://127.0.0.1` for MVP; env var configurable for future scaling
7. All Supabase DB writes from API routes use the **service role client** (bypasses RLS); RLS policies protect direct/anon client access only
8. No automated tests required for MVP — manual verification sufficient
9. Context window truncation: send last 20 message pairs (40 messages) max to RAGflow per request
10. Conversation rename does **not** update `updated_at` — only new messages bump the sort order

---

## Decision Log

| # | Decision | Alternatives Considered | Reason |
|---|----------|------------------------|--------|
| 1 | App shell: teal sidebar + white chat | Dark navy sidebar (A), Top nav (C) | Matches "trustworthy, approachable, clinic-friendly" aesthetic; teal accent consistent throughout |
| 2 | Landing page: centered hero + 3-col features | Split hero with chat preview (B) | Simpler, faster to build; sufficient for MVP |
| 3 | RAGflow URL: env-var configurable | Hardcode localhost | Enables future VPS/tunnel/ngrok migration with one env var change |
| 4 | i18n: simple JSON dictionary + useT() hook | next-intl library | No URL routing needed; fixed set of UI strings; zero extra dependencies |
| 5 | Rate limiting: Upstash Redis sliding window | In-memory Map (broken on Vercel), skip for now | Proper distributed rate limiting; free tier sufficient; 15-min setup |
| 6 | Auth strategy: Supabase SSR + middleware | Client-side auth hooks, Pages Router | Server-side auth check before render; no flash of protected content; Supabase-recommended for Next.js 15 |
| 7 | Streaming: ReadableStream relay in /api/chat | Fetch + accumulate then respond, WebSocket | Native SSE relay with no buffering; token-by-token UX like ChatGPT |
| 8 | Guest chat: useState only | SessionStorage, anonymous Supabase user | Simplest; matches spec; no cleanup needed |
| 9 | New conversation creation: client calls POST /api/conversations before first POST /api/chat | /api/chat creates conversation implicitly | Cleaner separation of concerns; conversationId always present in /api/chat |
| 10 | CSRF mitigation: rely on Supabase HttpOnly SameSite=Lax cookies + server-side session check | Custom CSRF tokens | Supabase SSR cookies are SameSite=Lax/Strict by default, preventing cross-site form submissions; all routes verify session server-side |
| 11 | i18n language storage: cookie (not localStorage) | localStorage | Cookie readable on server-side to avoid SSR hydration mismatch; accessible in middleware |
| 12 | CSP: no unsafe-inline | Keep unsafe-inline | App Router builds do not require inline scripts; remove to preserve XSS protection |
| 13 | Context window: last 20 message pairs sent to RAGflow | All history, last N tokens | Simple, deterministic; avoids 400/413 errors from RAGflow |

---

## Project Structure

```
bamboo-vet/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (public)/
│   │   ├── page.tsx                    # Landing /
│   │   └── chat/page.tsx               # Public chat (guest)
│   ├── app/
│   │   ├── layout.tsx                  # Sidebar layout (SidebarProvider)
│   │   ├── page.tsx                    # /app — new chat empty state
│   │   └── conversation/[id]/page.tsx  # Load specific conversation
│   ├── api/
│   │   ├── chat/route.ts               # RAGflow proxy + SSE streaming
│   │   ├── conversations/route.ts      # GET list, POST create
│   │   └── conversations/[id]/route.ts # GET, PATCH rename, DELETE
│   └── layout.tsx                      # Root layout (fonts, metadata, LanguageProvider)
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx           # Main chat area + streaming state
│   │   ├── MessageBubble.tsx           # User/AI message rendering
│   │   ├── MessageInput.tsx            # Pinned input (react-textarea-autosize) + send
│   │   └── TypingIndicator.tsx         # 3-dot pulse while streaming
│   ├── sidebar/
│   │   ├── AppSidebar.tsx              # shadcn Sidebar wrapper
│   │   └── ConversationItem.tsx        # List item: rename/delete
│   ├── layout/
│   │   ├── Header.tsx                  # Lang toggle (VI/EN) + auth buttons
│   │   └── LandingNav.tsx
│   └── ui/                             # shadcn generated components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client (anon key)
│   │   ├── server.ts                   # Server Supabase client (service role, SSR)
│   │   └── middleware.ts               # Auth session refresh helper
│   ├── i18n/
│   │   ├── translations.ts             # Full { vi: {...}, en: {...} dictionary
│   │   └── LanguageContext.tsx         # useT() hook + LanguageProvider (client component)
│   └── ragflow.ts                      # RAGflow SSE call + stream relay logic
├── middleware.ts                        # Next.js route guard (/app/*)
├── .env.local                           # Secrets — git-ignored
├── .env.example                         # Placeholder template — committed
└── next.config.js                       # Security headers
```

**Layer responsibilities:**
- `middleware.ts` — intercepts every `/app/*` request, refreshes Supabase session cookie, redirects to `/login` if unauthenticated
- `app/api/chat` — only server-side route that knows the RAGflow API key; browsers never talk to RAGflow directly
- `lib/i18n/LanguageContext.tsx` — client component; reads `lang` cookie on mount (fallback `'vi'`), exposes `useT('key')` hook; SSR renders default `'vi'`, no hydration mismatch
- `lib/ragflow.ts` — isolated RAGflow call logic, easy to swap base URL via env var

---

## Design System (ui-ux-pro-max: AI-Native UI)

### Style
AI-Native UI — minimal chrome, streaming text, typing indicators, smooth reveals. No dark mode for MVP.

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#3D9A7A` | Buttons, active states, CTA, send button |
| Primary Light | `#E8F5F0` | User message bubbles, hover bg |
| Primary Subtle | `#F0FAF6` | Sidebar bg, input bg |
| Dark Text | `#1A2E25` | Headings |
| Body Text | `#374151` | Paragraph text |
| Muted Text | `#6B7280` | Timestamps, placeholders |
| Border | `#D4EDE5` | Card borders, dividers |
| White | `#FFFFFF` | AI message bg, main chat area |
| Danger | `#EF4444` | Error states |
| Warning | `#F59E0B` | Partial stream warning badge |

### Typography
- **Font:** Inter (Google Fonts, weights 300/400/500/600/700)
- **H1:** 36px / 700 / line-height 1.2
- **H2:** 24px / 600 / line-height 1.3
- **Body:** 16px / 400 / line-height 1.6 (minimum WCAG for mobile)
- **Meta/small:** 13px / 400 / muted color
- **Drug values/code:** monospace, teal color — for dosage numbers like `10–20mg/kg`

### Component Specs
| Component | Spec |
|-----------|------|
| Sidebar | 260px, `bg #F0FAF6`, `border-right #D4EDE5`, shadcn `<SidebarProvider>` + `<Sidebar>` |
| User bubble | `bg #E8F5F0`, `border-radius 18px 18px 4px 18px`, right-aligned, max-width 70%, px-4 py-3 |
| AI bubble | `bg #FFFFFF`, `border 1px #D4EDE5`, `shadow-sm`, `border-radius 18px 18px 18px 4px`, left-aligned, max-width 80%, px-4 py-3 |
| Typing indicator | 3-dot `animate-pulse`, teal, left-aligned, shown while stream open, replaced on completion |
| Input bar | Fixed bottom, `react-textarea-autosize` (max 5 rows, min 1), teal circle send button, Enter=send, Shift+Enter=newline |
| Touch targets | Minimum 44×44px (WCAG) |
| Focus states | `ring-2 ring-teal-500 ring-offset-2` |
| Transitions | `transition-colors duration-200` on all interactive elements |
| Icons | Lucide React only — no emoji icons |
| Sign-up nudge banner | Amber/yellow `bg-amber-50 border border-amber-200`, shown immediately on `/chat`, dismissible (X button), VI: "Lưu lịch sử trò chuyện — Đăng ký miễn phí" / EN: "Save your history — Sign up free" |

### Pre-delivery Checklist (ui-ux-pro-max)
- [ ] No emojis as icons (Lucide React throughout)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150–300ms)
- [ ] Light mode text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] `prefers-reduced-motion` respected via `motion-reduce:` Tailwind variants
- [ ] Responsive: 375px, 768px, 1024px, 1440px

---

## Pages & Routing

| Route | Auth | Description |
|-------|------|-------------|
| `/` | Public | Landing: centered hero, 3-col features, Header with VI/EN toggle + login CTA |
| `/chat` | Public | Guest chat, useState only (no DB), amber sign-up nudge banner (dismissible) |
| `/login` | Public | Email/password form + Google OAuth button, bilingual labels |
| `/signup` | Public | Name/email/password + Google OAuth, bilingual labels. Email confirmation disabled. |
| `/app` | Protected | Empty state — "Start a new conversation" prompt, New Chat button |
| `/app/conversation/[id]` | Protected | Server Component loads full history from Supabase, renders in ChatInterface |

**Route protection:** `middleware.ts` intercepts all `/app/*` requests, refreshes Supabase session cookie, redirects to `/login` if unauthenticated. Already-logged-in users visiting `/login` or `/signup` redirect to `/app`.

**Sidebar conversation list:**
- Ordered by `updated_at DESC` (bumped on new message only, not on rename)
- Grouped: Today / Yesterday / Older
- Rename: click title → inline `<input>` → blur/Enter → `PATCH /api/conversations/[id]`
- Delete: hover → Trash2 icon → confirm dialog → `DELETE /api/conversations/[id]` → navigate to `/app`
- Conversation title: auto-set to first 50 chars of first user message

**Auth page details:**
- Email/password auth enabled in Supabase (no email confirmation for MVP)
- Signup error "Email already in use" → inline bilingual error message
- Login error "Invalid credentials" → inline bilingual error message
- Both pages use Supabase `signInWithPassword` / `signUp` / `signInWithOAuth`
- After success: `router.push('/app')`

---

## Data Flow — Chat (Full Detail)

### Step 1: Start a new conversation (authenticated users)

Before the first message is sent, the client calls:
```
POST /api/conversations
→ INSERT INTO conversations (user_id, title='New conversation')
→ Returns { id: uuid }
→ Client navigates to /app/conversation/[id]
```

Guest users skip this step — no DB interaction.

### Step 2: Send a message

```
User types → Enter/Send button
    │
    ▼
[Browser] POST /api/chat
  {
    messages: Message[],       // last 20 pairs max (client-side truncation)
    conversationId: string     // always present for auth users; absent for guests
  }
    │
    ▼
[/api/chat — server]
  1. Parse Supabase session (server-side via createServerClient)
  2. Sanitize: strip all HTML tags (strip-tags or DOMPurify server-side),
     enforce content ≤ 2000 chars → return 400 if exceeded
  3. Upstash rate limit:
       guest (no session):  30 req / 60s per IP  (sliding window)
       authenticated user:  60 req / 60s per user_id
     → return 429 if exceeded
  4. Call RAGflow:
       POST {RAGFLOW_BASE_URL}/api/v1/chats_openai/{RAGFLOW_CHAT_ID}/chat/completions
       Headers:
         Content-Type: application/json
         Authorization: Bearer {RAGFLOW_API_KEY}
       Body:
         { "model": "model", "messages": [...truncatedHistory], "stream": true }
  5. Relay SSE stream to browser via ReadableStream:
       - Read RAGflow response body as ReadableStream
       - For each chunk: parse SSE lines (split on \n\n)
         - If line starts with "data: ": extract JSON, get choices[0].delta.content
         - If line is "data: [DONE]": signal end of stream
         - Forward raw SSE chunk to browser (transparent relay)
       - If RAGflow unreachable (fetch throws): return 502
       - If stream closes before [DONE]: browser detects via stream closure
    │
    ▼
[Browser] reads stream via fetch + ReadableStream reader
  - For each chunk: parse SSE data lines, append delta.content to AI bubble
  - TypingIndicator shown while reader.read() returns { done: false }
  - On done: finalize message in React state
  - On fetch error (502, 429, 400): show bilingual error + Retry button
  - On stream close without [DONE]: show partial text + amber warning badge
    │
    ▼ (authenticated users only — after stream fully consumed)
[/api/chat — post-stream save]
  - Use service role client to bypass RLS:
    INSERT INTO messages (conversation_id, role='user', content=userMessage)
    INSERT INTO messages (conversation_id, role='assistant', content=fullAccumulatedText)
  - If first message in conversation:
    UPDATE conversations SET title = LEFT(userMessage, 50) WHERE id = conversationId
  - (Trigger auto-updates conversations.updated_at)
```

### Context window truncation
Client sends last 20 message pairs (40 messages). If history > 40, slice from the end:
```ts
const truncated = messages.slice(-40);
```
This prevents RAGflow 400/413 errors on long conversations.

### Error handling
| Scenario | Server response | Browser behavior |
|----------|----------------|-----------------|
| RAGflow unreachable | 502 JSON `{ error: 'ragflow_unavailable' }` | Bilingual error + Retry button |
| Stream interrupted (no [DONE]) | Stream closes early | Partial text shown + amber warning badge on bubble |
| Input > 2000 chars | 400 JSON `{ error: 'too_long' }` | Inline validation error in input bar |
| Rate limit hit | 429 JSON `{ error: 'rate_limited' }` | "Vui lòng thử lại sau / Please wait and retry" |
| Auth expired mid-session | Middleware refreshes token | Silent; no user action needed |

---

## Conversation Loading (`/app/conversation/[id]`)

Server Component:
```ts
const supabase = createServerClient() // service role
const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', id)
  .order('created_at', { ascending: true })
// Verify ownership: check conversations.user_id = auth.uid() before query
// Pass as initialMessages prop to ChatInterface (client component)
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/chat` | Optional | Proxy to RAGflow (Bearer token in header), stream response, save to DB if authenticated |
| GET | `/api/conversations` | Required | List all conversations ordered by `updated_at DESC` |
| POST | `/api/conversations` | Required | Create new conversation row, return `{ id }` |
| GET | `/api/conversations/[id]` | Required | Get conversation + all messages (verify ownership) |
| PATCH | `/api/conversations/[id]` | Required | Rename conversation title (does not update `updated_at`) |
| DELETE | `/api/conversations/[id]` | Required | Delete conversation + cascade messages |

**Auth guard pattern (all /api/conversations/*):**
```ts
const supabase = createServerClient(/* service role */)
const { data: { user } } = await supabase.auth.getUser()
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

**CSRF:** Supabase SSR sets auth cookies with `HttpOnly; SameSite=Lax` — cross-site POST requests cannot include these cookies, providing CSRF protection without custom tokens. All routes additionally verify the session server-side.

---

## Database Schema

```sql
-- conversations
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New conversation',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
-- Composite index: filter by user, sort by updated_at
CREATE INDEX idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- SELECT / UPDATE / DELETE policy (anon client reads)
CREATE POLICY "own_conversations_select" ON conversations
  FOR SELECT USING (user_id = auth.uid());
-- INSERT policy (anon client writes — service role bypasses RLS anyway)
CREATE POLICY "own_conversations_insert" ON conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- messages
CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX idx_messages_conversation_id
  ON messages(conversation_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_messages_select" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "own_messages_insert" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Auto-update conversations.updated_at on new message (not on rename)
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
```

**Note:** All API route writes use the **service role client** which bypasses RLS. RLS policies above protect against direct database access from anon/user clients.

---

## Security Implementation

### Environment Variables

```bash
# .env.local — git-ignored. See .env.example for required keys.

# Server-only (NO NEXT_PUBLIC_ prefix — never sent to browser)
RAGFLOW_BASE_URL=http://127.0.0.1
RAGFLOW_API_KEY=<your_ragflow_api_key>         # used as Bearer token in Authorization header
RAGFLOW_CHAT_ID=<your_chat_assistant_id>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Public (browser + Edge Runtime safe)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Vercel deployment note:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set in Vercel Project Settings → Environment Variables. They are also required in the **Edge Runtime** (used by `middleware.ts`) — Vercel exposes `NEXT_PUBLIC_` vars to Edge automatically.

### RAGflow API Key Usage
```ts
// lib/ragflow.ts
const response = await fetch(
  `${process.env.RAGFLOW_BASE_URL}/api/v1/chats_openai/${process.env.RAGFLOW_CHAT_ID}/chat/completions`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RAGFLOW_API_KEY}`,  // ← key injected here
    },
    body: JSON.stringify({ model: 'model', messages, stream: true }),
  }
)
```

### Rate Limiting (Upstash)
```ts
// app/api/chat/route.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const guestLimit   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s') })
const authLimit    = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s') })

const identifier = user ? `user_${user.id}` : `ip_${ip}`
const limiter    = user ? authLimit : guestLimit
const { success } = await limiter.limit(identifier)
if (!success) return Response.json({ error: 'rate_limited' }, { status: 429 })
```

### Input Sanitization
```ts
import { stripHtml } from 'string-strip-html' // or 'strip-tags'
const clean = stripHtml(raw).result.trim()
if (clean.length === 0) return Response.json({ error: 'empty' }, { status: 400 })
if (clean.length > 2000) return Response.json({ error: 'too_long' }, { status: 400 })
```

### Security Headers (`next.config.js`)
```js
{
  key: 'X-Frame-Options', value: 'DENY'
  key: 'X-Content-Type-Options', value: 'nosniff'
  key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'
  key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
  // Note: unsafe-inline removed from script-src. style-src keeps it for Tailwind inline styles.
}
```

### CSRF
Supabase SSR auth cookies are set with `HttpOnly; SameSite=Lax`. Cross-origin POST requests cannot include these cookies, preventing CSRF. All mutation routes additionally verify the session server-side via `supabase.auth.getUser()`.

---

## i18n — Simple JSON Dictionary

**Language cookie:** `lang` cookie (`vi` | `en`), set client-side via `document.cookie`, read on server via `cookies()` in Server Components or `request.cookies` in middleware. Default: `'vi'`.

**SSR hydration:** `LanguageContext` is a client component (`'use client'`). On first render it reads the `lang` cookie via `document.cookie` (or a prop passed from the server layout). SSR renders with `'vi'` default. No hydration mismatch because the provider reads the cookie synchronously.

### Complete Translation Key Namespaces

```ts
// lib/i18n/translations.ts
{
  vi: {
    // Navigation
    'nav.brand': 'Bamboo Vet',
    'nav.login': 'Đăng nhập',
    'nav.signup': 'Đăng ký',
    'nav.logout': 'Đăng xuất',
    'nav.newChat': 'Cuộc trò chuyện mới',
    'nav.lang': 'VI / EN',

    // Landing page
    'landing.badge': 'TRỢ LÝ THÚ Y AI',
    'landing.headline': 'Bamboo Vet AI Assistance',
    'landing.subheadline': 'Tra cứu thuốc, liều lượng & hướng dẫn điều trị tức thì',
    'landing.subheadline.en': 'Drug lookup, dosages & treatment guidance for vets',
    'landing.cta': 'Dùng thử ngay',
    'landing.feature1.title': 'Tra cứu thuốc',
    'landing.feature1.desc': 'Liều lượng theo loài & cân nặng',
    'landing.feature2.title': 'Chống chỉ định',
    'landing.feature2.desc': 'Tương tác thuốc & cảnh báo',
    'landing.feature3.title': 'Phác đồ điều trị',
    'landing.feature3.desc': 'Hướng dẫn điều trị chuẩn',

    // Chat
    'chat.placeholder': 'Nhập câu hỏi của bạn...',
    'chat.send': 'Gửi',
    'chat.newChat': 'Cuộc trò chuyện mới',
    'chat.emptyState': 'Hỏi bất kỳ điều gì về thuốc thú y',
    'chat.nudge': 'Lưu lịch sử trò chuyện — Đăng ký miễn phí',
    'chat.nudge.dismiss': 'Đóng',

    // Conversation sidebar
    'sidebar.today': 'Hôm nay',
    'sidebar.yesterday': 'Hôm qua',
    'sidebar.older': 'Cũ hơn',
    'sidebar.rename': 'Đổi tên',
    'sidebar.delete': 'Xóa',
    'sidebar.deleteConfirm': 'Xóa cuộc trò chuyện này?',
    'sidebar.deleteConfirmYes': 'Xóa',
    'sidebar.deleteConfirmNo': 'Hủy',

    // Auth
    'auth.email': 'Email',
    'auth.password': 'Mật khẩu',
    'auth.name': 'Họ và tên',
    'auth.login': 'Đăng nhập',
    'auth.signup': 'Đăng ký',
    'auth.loginWithGoogle': 'Đăng nhập với Google',
    'auth.signupWithGoogle': 'Đăng ký với Google',
    'auth.noAccount': 'Chưa có tài khoản?',
    'auth.hasAccount': 'Đã có tài khoản?',
    'auth.error.invalidCredentials': 'Email hoặc mật khẩu không đúng.',
    'auth.error.emailExists': 'Email này đã được sử dụng.',

    // Errors
    'error.generic': 'Đã xảy ra lỗi. Vui lòng thử lại.',
    'error.retry': 'Thử lại',
    'error.rateLimit': 'Vui lòng thử lại sau.',
    'error.tooLong': 'Tin nhắn quá dài (tối đa 2000 ký tự).',
    'error.streamInterrupted': 'Phản hồi bị gián đoạn.',
  },
  en: {
    'nav.brand': 'Bamboo Vet',
    'nav.login': 'Login',
    'nav.signup': 'Sign up',
    'nav.logout': 'Log out',
    'nav.newChat': 'New conversation',
    'nav.lang': 'EN / VI',
    'landing.badge': 'VETERINARY AI ASSISTANT',
    'landing.headline': 'Bamboo Vet AI Assistance',
    'landing.subheadline': 'Drug lookup, dosages & treatment guidance',
    'landing.subheadline.en': 'Tra cứu thuốc thú y nhanh chóng & chính xác',
    'landing.cta': 'Try Now',
    'landing.feature1.title': 'Drug Lookup',
    'landing.feature1.desc': 'Dosages by species & weight',
    'landing.feature2.title': 'Contraindications',
    'landing.feature2.desc': 'Drug interactions & warnings',
    'landing.feature3.title': 'Treatment Protocols',
    'landing.feature3.desc': 'Standard treatment guidance',
    'chat.placeholder': 'Ask your question...',
    'chat.send': 'Send',
    'chat.newChat': 'New conversation',
    'chat.emptyState': 'Ask anything about veterinary medicine',
    'chat.nudge': 'Save your history — Sign up free',
    'chat.nudge.dismiss': 'Dismiss',
    'sidebar.today': 'Today',
    'sidebar.yesterday': 'Yesterday',
    'sidebar.older': 'Older',
    'sidebar.rename': 'Rename',
    'sidebar.delete': 'Delete',
    'sidebar.deleteConfirm': 'Delete this conversation?',
    'sidebar.deleteConfirmYes': 'Delete',
    'sidebar.deleteConfirmNo': 'Cancel',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full name',
    'auth.login': 'Login',
    'auth.signup': 'Sign up',
    'auth.loginWithGoogle': 'Login with Google',
    'auth.signupWithGoogle': 'Sign up with Google',
    'auth.noAccount': 'No account yet?',
    'auth.hasAccount': 'Already have an account?',
    'auth.error.invalidCredentials': 'Incorrect email or password.',
    'auth.error.emailExists': 'This email is already in use.',
    'error.generic': 'Something went wrong. Please try again.',
    'error.retry': 'Retry',
    'error.rateLimit': 'Please wait and retry.',
    'error.tooLong': 'Message too long (max 2000 characters).',
    'error.streamInterrupted': 'Response was interrupted.',
  }
}
```

---

## Future Network Scaling — RAGflow Connectivity

> **Current MVP:** `RAGFLOW_BASE_URL=http://127.0.0.1` — works when Next.js and RAGflow run on the same machine (`next dev` or `next start` locally).

When deploying to Vercel (cloud serverless), update `RAGFLOW_BASE_URL` in Vercel env vars:

| Option | Setup | Effort | Cost | TLS |
|--------|-------|--------|------|-----|
| **A — Tunnel** | Cloudflare Tunnel or ngrok; set `RAGFLOW_BASE_URL=https://your-tunnel.trycloudflare.com` | Low | Free (CF Tunnel) | Yes — required |
| **B — VPS** | RAGflow on VPS; add firewall rule for Vercel IPs; set `RAGFLOW_BASE_URL=https://your-vps-ip` | Medium | ~$6–20/mo | Yes — use reverse proxy (nginx + cert) |
| **C — Self-hosted stack** | Next.js + RAGflow on same VPS via Docker Compose; internal URL `http://ragflow:80` | Medium-High | ~$20/mo | Internal only (no TLS needed) |

**Security note:** For Options A and B, the connection from Vercel to RAGflow traverses the public internet — **TLS is mandatory** to protect the API key in transit. Option C uses an internal Docker network and does not require TLS.

**Only one change needed in all cases:** update `RAGFLOW_BASE_URL` env var. No code changes required.
