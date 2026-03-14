# Bamboo Vet AI Assistance — Design Specification

**Date:** 2026-03-14
**Status:** Approved
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
2. Upstash Redis free tier (~10k req/day) is acceptable for MVP traffic
3. `RAGFLOW_CHAT_ID` filled in by developer from RAGflow dashboard before first use
4. Conversation title = first 50 chars of first user message (no AI title generation API call)
5. RAGflow runs locally at `http://127.0.0.1` for MVP; env var configurable for future scaling
6. No automated tests required for MVP — manual verification sufficient

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
│   └── layout.tsx                      # Root layout (fonts, metadata)
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx           # Main chat area
│   │   ├── MessageBubble.tsx           # User/AI message rendering
│   │   ├── MessageInput.tsx            # Pinned input + send button
│   │   └── TypingIndicator.tsx         # 3-dot pulse while streaming
│   ├── sidebar/
│   │   ├── AppSidebar.tsx              # shadcn Sidebar wrapper
│   │   └── ConversationItem.tsx        # List item: rename/delete
│   ├── layout/
│   │   ├── Header.tsx                  # Lang toggle + auth buttons
│   │   └── LandingNav.tsx
│   └── ui/                             # shadcn generated components
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client
│   │   ├── server.ts                   # Server Supabase client (SSR)
│   │   └── middleware.ts               # Auth session refresh helper
│   ├── i18n/
│   │   ├── translations.ts             # { vi: {...}, en: {...} }
│   │   └── LanguageContext.tsx         # useT() hook + LanguageProvider
│   └── ragflow.ts                      # RAGflow call + stream relay logic
├── middleware.ts                        # Next.js route guard (/app/*)
├── .env.local                           # Secrets — git-ignored
├── .env.example                         # Placeholder template — committed
└── next.config.js                       # Security headers
```

---

## Design System (ui-ux-pro-max: AI-Native UI)

### Style
AI-Native UI — minimal chrome, streaming text, typing indicators, smooth reveals. No dark mode for MVP.

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#3D9A7A` | Buttons, active states, CTA |
| Primary Light | `#E8F5F0` | User message bubbles, hover bg |
| Primary Subtle | `#F0FAF6` | Sidebar bg, input bg |
| Dark Text | `#1A2E25` | Headings |
| Body Text | `#374151` | Paragraph text |
| Muted Text | `#6B7280` | Timestamps, placeholders |
| Border | `#D4EDE5` | Card borders, dividers |
| White | `#FFFFFF` | AI message bg, main area |
| Danger | `#EF4444` | Error states |
| Warning | `#F59E0B` | Partial stream warning |

### Typography
- **Font:** Inter (Google Fonts, weights 300/400/500/600/700)
- **H1:** 36px / 700 / line-height 1.2
- **H2:** 24px / 600 / line-height 1.3
- **Body:** 16px / 400 / line-height 1.6 (WCAG minimum for mobile)
- **Meta/small:** 13px / 400 / muted color
- **Drug values/code:** monospace, teal color — for dosage numbers

### Component Specs
| Component | Spec |
|-----------|------|
| Sidebar | 260px, `bg #F0FAF6`, `border-right #D4EDE5`, shadcn `<SidebarProvider>` + `<Sidebar>` |
| User bubble | `bg #E8F5F0`, `border-radius 18px 18px 4px 18px`, right-aligned, max-width 70% |
| AI bubble | `bg #FFFFFF`, `border 1px #D4EDE5`, `shadow-sm`, `border-radius 18px 18px 18px 4px`, left-aligned, max-width 80% |
| Typing indicator | 3-dot `animate-pulse`, teal, left-aligned, shown while stream open |
| Input bar | Fixed bottom, auto-resize textarea (max 5 rows), teal send button (circle), Enter=send, Shift+Enter=newline |
| Touch targets | Minimum 44×44px (WCAG) |
| Focus states | `ring-2 ring-teal-500 ring-offset-2` |
| Transitions | `transition-colors duration-200` on all interactive elements |
| Icons | Lucide React only — no emoji icons |

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
| `/` | Public | Landing: centered hero, 3-col features, Header with VI/EN + login CTA |
| `/chat` | Public | Guest chat, useState only, soft sign-up nudge banner |
| `/login` | Public | Email/password + Google OAuth, bilingual labels |
| `/signup` | Public | Name/email/password + Google OAuth, bilingual labels |
| `/app` | Protected | Empty state — prompts to start new chat |
| `/app/conversation/[id]` | Protected | Loads full message history from Supabase |

**Route protection:** `middleware.ts` intercepts all `/app/*` requests, refreshes Supabase session cookie, redirects to `/login` if unauthenticated. Already-logged-in users visiting `/login` or `/signup` redirect to `/app`.

**Sidebar conversation list:**
- Ordered by `updated_at DESC`
- Grouped: Today / Yesterday / Older
- Rename: click title → inline input → blur/Enter → `PATCH /api/conversations/[id]`
- Delete: hover → Trash2 icon → `DELETE /api/conversations/[id]` → navigate to `/app`
- Conversation title: auto-set from first 50 chars of first user message

---

## Data Flow — Chat Streaming

```
User types → Enter/Send button
    │
    ▼
[Browser] POST /api/chat
  { messages: Message[], conversationId?: string }
    │
    ▼
[/api/chat — server]
  1. Get Supabase session (server-side)
  2. Sanitize: strip HTML tags, enforce ≤2000 chars
  3. Upstash rate limit check (IP-based for guests, relaxed for auth users)
  4. Forward to RAGflow as SSE stream:
       POST {RAGFLOW_BASE_URL}/api/v1/chats_openai/{RAGFLOW_CHAT_ID}/chat/completions
       { model: "model", messages: [...fullHistory], stream: true }
  5. Relay via ReadableStream (TransformStream) → browser
    │
    ▼
[Browser] reads stream
  - Appends delta.content token by token to AI message bubble
  - Shows TypingIndicator while stream open
  - On data: [DONE] → finalize message in state
    │
    ▼ (authenticated users only)
[/api/chat — after stream completes]
  - INSERT messages (user)
  - INSERT messages (assistant, full accumulated text)
  - If new conversation: UPDATE conversations SET title = first_50_chars
```

### Error Handling
| Scenario | Behavior |
|----------|----------|
| RAGflow unreachable | 502 → bilingual error message + Retry button |
| Stream interrupted mid-response | Partial text shown + amber warning badge on message |
| Input >2000 chars | 400 → inline validation error before send |
| Rate limit hit (429) | "Vui lòng thử lại sau / Please wait and retry" |
| Auth expired | Supabase middleware silently refreshes token |

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/chat` | Optional | Proxy to RAGflow, stream response, save to DB if authenticated |
| GET | `/api/conversations` | Required | List all conversations, ordered by `updated_at DESC` |
| POST | `/api/conversations` | Required | Create new conversation, return `{ id }` |
| GET | `/api/conversations/[id]` | Required | Get conversation + all messages |
| PATCH | `/api/conversations/[id]` | Required | Rename conversation title |
| DELETE | `/api/conversations/[id]` | Required | Delete conversation + cascade messages |

All `/api/conversations/*` routes verify session server-side and return 401 if unauthenticated.

---

## Database Schema

```sql
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New conversation',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_conversations" ON conversations
  USING (user_id = auth.uid());

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_messages" ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Auto-update conversations.updated_at on new message
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

---

## Security Implementation

### Environment Variables
```bash
# Server-only (never NEXT_PUBLIC_)
RAGFLOW_BASE_URL=http://127.0.0.1
RAGFLOW_API_KEY=<your_ragflow_api_key>
RAGFLOW_CHAT_ID=<your_chat_assistant_id>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Public (safe for browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Rate Limiting (Upstash)
- Guest users: 30 requests / 60 seconds per IP (sliding window)
- Authenticated users: 60 requests / 60 seconds per user ID
- Library: `@upstash/ratelimit` + `@upstash/redis`

### Input Sanitization
- Strip all HTML tags server-side before forwarding to RAGflow
- Enforce maximum 2000 character limit
- Return 400 with bilingual error if exceeded

### Security Headers (`next.config.js`)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

---

## i18n — Simple JSON Dictionary

```ts
// lib/i18n/translations.ts
export const translations = {
  vi: { 'nav.login': 'Đăng nhập', 'chat.placeholder': 'Nhập câu hỏi...', ... },
  en: { 'nav.login': 'Login', 'chat.placeholder': 'Ask your question...', ... }
}
// lib/i18n/LanguageContext.tsx
// - LanguageProvider in root layout
// - useT() hook: const t = useT(); t('chat.placeholder')
// - Default: 'vi'; toggle stored in localStorage
```

---

## Future Network Scaling — RAGflow Connectivity

> **Current MVP:** `RAGFLOW_BASE_URL=http://127.0.0.1` — works when Next.js and RAGflow run on the same machine.

When deploying to Vercel (cloud serverless), choose one option and update `RAGFLOW_BASE_URL` in Vercel environment variables:

| Option | Setup | Effort | Cost |
|--------|-------|--------|------|
| **A — Tunnel** | Cloudflare Tunnel or ngrok exposes RAGflow at a public HTTPS URL | Low | Free (Cloudflare Tunnel) |
| **B — VPS** | RAGflow on a VPS; firewall to allow only Vercel IPs | Medium | ~$6–20/mo |
| **C — Self-hosted stack** | Next.js + RAGflow on same VPS via Docker Compose; internal URL `http://ragflow:80` | Medium-High | ~$20/mo |

**Only one change needed:** update `RAGFLOW_BASE_URL` env var. No code changes required.
