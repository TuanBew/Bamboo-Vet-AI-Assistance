# Bamboo Vet AI Assistance — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bamboo Vet AI Assistance — a bilingual (VI/EN) veterinary AI chatbot SaaS with public guest chat, authenticated conversation history, RAGflow SSE streaming, and a professional teal-themed UI.

**Architecture:** Next.js 15 App Router + SSR-first Supabase auth via `@supabase/ssr`. RAGflow responses are proxied server-side through `/api/chat` using `ReadableStream` relay. Upstash Redis rate limits guest users. All DB writes use the service role client.

**Tech Stack:** Next.js 15 · TypeScript · Tailwind CSS · shadcn/ui · Supabase (@supabase/ssr) · Upstash (@upstash/ratelimit + @upstash/redis) · lucide-react · react-textarea-autosize · string-strip-html

**Spec:** `docs/superpowers/specs/2026-03-14-bamboo-vet-design.md`

---

## File Map

```
.env.example                              # Committed placeholder
.env.local                                # Real secrets — git-ignored
next.config.js                            # Security headers
tailwind.config.ts                        # Custom teal palette
middleware.ts                             # Supabase auth route guard
supabase/schema.sql                       # DB schema (run in Supabase dashboard)

app/layout.tsx                            # Root layout: Inter, LanguageProvider
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx
app/auth/callback/route.ts               # OAuth callback
app/(public)/page.tsx                     # Landing page
app/(public)/chat/page.tsx               # Guest chat
app/app/layout.tsx                        # Authenticated shell: SidebarProvider
app/app/page.tsx                          # /app empty state
app/app/conversation/[id]/page.tsx       # Load specific conversation
app/api/chat/route.ts                     # RAGflow proxy + SSE streaming
app/api/conversations/route.ts           # GET list, POST create
app/api/conversations/[id]/route.ts      # GET, PATCH, DELETE

components/layout/LandingNav.tsx          # Public navbar
components/layout/Header.tsx             # Lang toggle + auth buttons
components/chat/MessageBubble.tsx        # User / AI message bubble
components/chat/TypingIndicator.tsx      # 3-dot pulse while streaming
components/chat/MessageInput.tsx         # react-textarea-autosize input
components/chat/ChatInterface.tsx        # Full chat area + streaming state
components/sidebar/ConversationItem.tsx  # Sidebar list item: rename/delete
components/sidebar/AppSidebar.tsx        # shadcn Sidebar wrapper

lib/supabase/client.ts                   # Browser Supabase client
lib/supabase/server.ts                   # Server + service role clients
lib/supabase/middleware.ts               # updateSession helper
lib/i18n/translations.ts                 # Full VI/EN dictionary
lib/i18n/LanguageContext.tsx             # useT() hook + LanguageProvider
lib/ragflow.ts                           # RAGflow SSE streaming call
```

---

## Chunk 1: Project Foundation

### Task 1: Scaffold Next.js 15 + install dependencies

**Files:** `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js 15 in project directory**

```bash
# Run from: D:/importantProjects/WorkSpace_Personal Project_ Agents/Bamboo Vet
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-git --import-alias "@/*"
```
When prompted: no `src/` directory, accept other defaults.
If prompted about existing files (prompt.txt, docs/) — keep existing files.

- [ ] **Step 2: Rename config file if needed**

```bash
# If create-next-app created next.config.ts, rename it:
ls next.config.*
# If next.config.ts exists:
mv next.config.ts next.config.js
```

- [ ] **Step 3: Install all production dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  @upstash/ratelimit @upstash/redis \
  react-textarea-autosize \
  string-strip-html \
  lucide-react
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted: Style → **Default**, Base color → **Slate**, CSS variables → **Yes**

- [ ] **Step 5: Add required shadcn components**

```bash
npx shadcn@latest add button input textarea label card separator scroll-area sidebar dialog alert badge
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Open http://localhost:3000 — expect the default Next.js page. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 + shadcn/ui + all dependencies"
```

---

### Task 2: Environment files + .gitignore

**Files:** `.env.example`, `.env.local`, `.gitignore`

- [ ] **Step 1: Verify .gitignore covers secrets**

Open `.gitignore`. Confirm these lines exist (add if missing):
```
.env
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 2: Create `.env.example`**

```bash
# .env.example — commit this file
RAGFLOW_BASE_URL=http://127.0.0.1
RAGFLOW_API_KEY=your_ragflow_api_key_here
RAGFLOW_CHAT_ID=your_chat_assistant_id_here

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
```

- [ ] **Step 3: Create `.env.local` with real values**

Copy `.env.example` → `.env.local` and fill in real credentials:
- RAGflow: your dashboard → API Keys + Chat Assistant ID
- Supabase: Project Settings → API → URL + anon key + service_role key
- Upstash: create free Redis at console.upstash.com → REST API credentials

- [ ] **Step 4: Commit .env.example only**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example and secure .gitignore"
```

---

### Task 3: Tailwind + security headers + globals

**Files:** `tailwind.config.ts`, `next.config.js`, `app/globals.css`

- [ ] **Step 1: Update `tailwind.config.ts`**

Replace the contents:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  '#F0FAF6',
          100: '#E8F5F0',
          200: '#D4EDE5',
          300: '#A8D9C6',
          400: '#6BBFA3',
          500: '#3D9A7A',
          600: '#2D7A5E',
          700: '#1A2E25',
        },
        brand: {
          primary:  '#3D9A7A',
          light:    '#E8F5F0',
          subtle:   '#F0FAF6',
          border:   '#D4EDE5',
          darkText: '#1A2E25',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

- [ ] **Step 2: Update `app/globals.css`**

Replace with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 158 25% 15%;
    --card: 0 0% 100%;
    --card-foreground: 158 25% 15%;
    --popover: 0 0% 100%;
    --popover-foreground: 158 25% 15%;
    --primary: 161 44% 42%;
    --primary-foreground: 0 0% 100%;
    --secondary: 158 40% 95%;
    --secondary-foreground: 158 25% 15%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 158 40% 95%;
    --accent-foreground: 158 25% 15%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 158 35% 85%;
    --input: 158 35% 85%;
    --ring: 161 44% 42%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

- [ ] **Step 3: Update `next.config.js` with security headers**

Replace the contents:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

- [ ] **Step 4: Verify TypeScript + dev server**

```bash
npx tsc --noEmit
npm run dev
```
Expected: no TypeScript errors, page loads at http://localhost:3000.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts app/globals.css next.config.js
git commit -m "chore: teal design system, security headers, custom CSS vars"
```

---

## Chunk 2: Supabase & Database

### Task 4: Supabase client utilities

**Files:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Service role client — bypasses RLS. Use ONLY in API routes.
// Uses a no-op cookie adapter: service role auth relies on the API key, not cookies.
// This also makes it safe to call from inside ReadableStream callbacks.
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}
```

- [ ] **Step 3: Create `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value, options)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove
  const { data: { user } } = await supabase.auth.getUser()

  // Guard /app/* routes
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'
  )) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 4: Create root `middleware.ts`**

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: Supabase SSR clients and auth middleware"
```

---

### Task 5: Database schema

**Files:** `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/schema.sql`**

```sql
-- Run this in Supabase dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New conversation',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_conversations_select" ON conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "own_conversations_insert" ON conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
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

CREATE POLICY "own_messages_delete" ON messages
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER messages_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
```

- [ ] **Step 2: Run schema in Supabase**

1. Open Supabase dashboard → SQL Editor → New query
2. Paste `supabase/schema.sql` content
3. Click Run
Expected: "Success. No rows returned."

- [ ] **Step 3: Disable email confirmation**

Supabase dashboard → Authentication → Email → disable "Confirm email"

- [ ] **Step 4: Enable Google OAuth (optional for MVP)**

Supabase dashboard → Authentication → Providers → Google → fill in Client ID + Secret

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: database schema with RLS policies and timestamp trigger"
```

---

## Chunk 3: i18n System

### Task 6: Translations dictionary + LanguageContext

**Files:** `lib/i18n/translations.ts`, `lib/i18n/LanguageContext.tsx`, `app/layout.tsx`

- [ ] **Step 1: Create `lib/i18n/translations.ts`**

```ts
export type Language = 'vi' | 'en'

export type TranslationKey =
  | 'nav.brand' | 'nav.login' | 'nav.signup' | 'nav.logout' | 'nav.newChat' | 'nav.lang'
  | 'landing.badge' | 'landing.headline' | 'landing.subheadline' | 'landing.subheadline.en'
  | 'landing.cta' | 'landing.feature1.title' | 'landing.feature1.desc'
  | 'landing.feature2.title' | 'landing.feature2.desc'
  | 'landing.feature3.title' | 'landing.feature3.desc'
  | 'chat.placeholder' | 'chat.send' | 'chat.newChat' | 'chat.emptyState'
  | 'chat.nudge' | 'chat.nudge.dismiss'
  | 'sidebar.today' | 'sidebar.yesterday' | 'sidebar.older'
  | 'sidebar.rename' | 'sidebar.delete' | 'sidebar.deleteConfirm'
  | 'sidebar.deleteConfirmYes' | 'sidebar.deleteConfirmNo'
  | 'auth.email' | 'auth.password' | 'auth.name'
  | 'auth.login' | 'auth.signup' | 'auth.loginWithGoogle' | 'auth.signupWithGoogle'
  | 'auth.noAccount' | 'auth.hasAccount'
  | 'auth.error.invalidCredentials' | 'auth.error.emailExists'
  | 'error.generic' | 'error.retry' | 'error.rateLimit'
  | 'error.tooLong' | 'error.streamInterrupted'

export const translations: Record<Language, Record<TranslationKey, string>> = {
  vi: {
    'nav.brand': 'Bamboo Vet',
    'nav.login': 'Đăng nhập',
    'nav.signup': 'Đăng ký',
    'nav.logout': 'Đăng xuất',
    'nav.newChat': 'Cuộc trò chuyện mới',
    'nav.lang': 'VI / EN',
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
    'chat.placeholder': 'Nhập câu hỏi của bạn...',
    'chat.send': 'Gửi',
    'chat.newChat': 'Cuộc trò chuyện mới',
    'chat.emptyState': 'Hỏi bất kỳ điều gì về thuốc thú y',
    'chat.nudge': 'Lưu lịch sử trò chuyện — Đăng ký miễn phí',
    'chat.nudge.dismiss': 'Đóng',
    'sidebar.today': 'Hôm nay',
    'sidebar.yesterday': 'Hôm qua',
    'sidebar.older': 'Cũ hơn',
    'sidebar.rename': 'Đổi tên',
    'sidebar.delete': 'Xóa',
    'sidebar.deleteConfirm': 'Xóa cuộc trò chuyện này?',
    'sidebar.deleteConfirmYes': 'Xóa',
    'sidebar.deleteConfirmNo': 'Hủy',
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
  },
}
```

- [ ] **Step 2: Create `lib/i18n/LanguageContext.tsx`**

```tsx
'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { translations, type Language, type TranslationKey } from './translations'

interface LanguageContextValue {
  lang: Language
  t: (key: TranslationKey) => string
  toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
  initialLang = 'vi',
}: {
  children: ReactNode
  initialLang?: Language
}) {
  const [lang, setLang] = useState<Language>(initialLang)

  const t = useCallback(
    (key: TranslationKey): string => translations[lang][key] ?? key,
    [lang]
  )

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'vi' ? 'en' : 'vi'
      document.cookie = `lang=${next};path=/;max-age=${60 * 60 * 24 * 365}`
      return next
    })
  }, [])

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used within LanguageProvider')
  return ctx.t
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return { lang: ctx.lang, toggleLang: ctx.toggleLang }
}
```

- [ ] **Step 3: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import type { Language } from '@/lib/i18n/translations'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Bamboo Vet AI Assistance',
  description: 'Trợ lý AI cho bác sĩ thú y — Drug lookup, dosages & treatment guidance',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language

  return (
    <html lang={lang} className={inter.variable}>
      <body className="font-sans antialiased">
        <LanguageProvider initialLang={lang}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/ app/layout.tsx
git commit -m "feat: bilingual i18n system with useT hook and cookie-based SSR"
```

---

## Chunk 4: Auth Pages

### Task 7: OAuth callback + Login + Signup

**Files:** `app/auth/callback/route.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

- [ ] **Step 2: Create `app/(auth)/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/LanguageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function LoginPage() {
  const t = useT()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(t('auth.error.invalidCredentials'))
      setLoading(false)
      return
    }
    router.push('/app')
    router.refresh()
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <Card className="w-full max-w-md border-teal-200 shadow-sm">
        <CardHeader className="text-center pb-2">
          <p className="text-2xl font-bold text-teal-600 mb-1">{t('nav.brand')}</p>
          <CardTitle className="text-xl text-brand-darkText">{t('auth.login')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="border-teal-200 focus-visible:ring-teal-500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="border-teal-200 focus-visible:ring-teal-500" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-600 cursor-pointer">
              {loading ? '...' : t('auth.login')}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-teal-200" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">hoặc / or</span></div>
          </div>
          <Button variant="outline" onClick={handleGoogleLogin} className="w-full border-teal-200 hover:bg-teal-50 cursor-pointer">
            <GoogleIcon />{t('auth.loginWithGoogle')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link href="/signup" className="text-teal-600 hover:underline font-medium">{t('auth.signup')}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(auth)/signup/page.tsx`**

Same structure as login. Replace the form fields with name/email/password and call `supabase.auth.signUp()`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/LanguageContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function SignupPage() {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) {
      setError(error.message.includes('already') ? t('auth.error.emailExists') : t('error.generic'))
      setLoading(false)
      return
    }
    router.push('/app')
    router.refresh()
  }

  async function handleGoogleSignup() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <Card className="w-full max-w-md border-teal-200 shadow-sm">
        <CardHeader className="text-center pb-2">
          <p className="text-2xl font-bold text-teal-600 mb-1">{t('nav.brand')}</p>
          <CardTitle className="text-xl text-brand-darkText">{t('auth.signup')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required className="border-teal-200 focus-visible:ring-teal-500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="border-teal-200 focus-visible:ring-teal-500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="border-teal-200 focus-visible:ring-teal-500" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-600 cursor-pointer">
              {loading ? '...' : t('auth.signup')}
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-teal-200" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">hoặc / or</span></div>
          </div>
          <Button variant="outline" onClick={handleGoogleSignup} className="w-full border-teal-200 hover:bg-teal-50 cursor-pointer">
            <GoogleIcon />{t('auth.signupWithGoogle')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link href="/login" className="text-teal-600 hover:underline font-medium">{t('auth.login')}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Verify pages render**

```bash
npm run dev
```
- http://localhost:3000/login → expect login card with email/password fields + Google button
- http://localhost:3000/signup → expect signup card with name/email/password + Google button
- http://localhost:3000/app → expect redirect to /login (middleware working)

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: login, signup, and OAuth callback pages"
```

---

## Chunk 5: Landing Page

### Task 8: LandingNav + Landing page

**Files:** `components/layout/LandingNav.tsx`, `app/(public)/page.tsx`

- [ ] **Step 1: Create `components/layout/LandingNav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT, useLang } from '@/lib/i18n/LanguageContext'

export default function LandingNav() {
  const t = useT()
  const { lang, toggleLang } = useLang()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-teal-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-teal-600">{t('nav.brand')}</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="text-sm text-muted-foreground hover:text-teal-600 transition-colors cursor-pointer font-medium"
            aria-label="Toggle language"
          >
            {t('nav.lang')}
          </button>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-teal-700 hover:bg-teal-50 cursor-pointer">
              {t('nav.login')}
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 cursor-pointer">
              {t('nav.signup')}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create `app/(public)/page.tsx`**

```tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Pill, AlertTriangle, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LandingNav from '@/components/layout/LandingNav'
import { translations } from '@/lib/i18n/translations'
import type { Language } from '@/lib/i18n/translations'

const features = [
  { icon: Pill,          key: 'feature1' as const },
  { icon: AlertTriangle, key: 'feature2' as const },
  { icon: ClipboardList, key: 'feature3' as const },
]

export default async function LandingPage() {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language
  const t = (key: string) => (translations[lang] as Record<string, string>)[key] ?? key

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-teal-50 to-white">
        <span className="text-xs font-semibold tracking-widest text-teal-500 uppercase mb-4">
          {t('landing.badge')}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-brand-darkText leading-tight mb-4">
          {t('landing.headline')}
        </h1>
        <p className="text-lg text-gray-600 mb-2 max-w-xl">
          {t('landing.subheadline')}
        </p>
        <p className="text-sm text-gray-400 mb-10 max-w-xl italic">
          {t('landing.subheadline.en')}
        </p>
        <Link href="/chat">
          <Button size="lg" className="bg-teal-500 hover:bg-teal-600 rounded-full px-8 text-base font-semibold cursor-pointer">
            {t('landing.cta')} →
          </Button>
        </Link>
      </main>

      {/* Features */}
      <section className="max-w-4xl mx-auto w-full px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="text-center p-6 rounded-xl border border-teal-200 bg-white shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-teal-100 rounded-xl">
                  <Icon className="w-6 h-6 text-teal-600" aria-hidden="true" />
                </div>
              </div>
              <h3 className="font-semibold text-brand-darkText mb-1">
                {t(`landing.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`landing.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-teal-100">
        © 2026 Bamboo Vet AI Assistance
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: Verify landing page**

```bash
npm run dev
```
http://localhost:3000 → centered hero with headline, CTA button, 3 feature cards below.

- [ ] **Step 4: Commit**

```bash
git add components/layout/LandingNav.tsx app/(public)/page.tsx
git commit -m "feat: landing page with hero and 3-column features"
```

---

## Chunk 6: RAGflow Proxy + /api/chat

### Task 9: RAGflow streaming library

**Files:** `lib/ragflow.ts`

- [ ] **Step 1: Create `lib/ragflow.ts`**

```ts
export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Call RAGflow and return a ReadableStream of SSE chunks.
// Throws if the request fails.
export async function callRagflow(messages: Message[]): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = process.env.RAGFLOW_BASE_URL!
  const apiKey  = process.env.RAGFLOW_API_KEY!
  const chatId  = process.env.RAGFLOW_CHAT_ID!

  const response = await fetch(
    `${baseUrl}/api/v1/chats_openai/${chatId}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,  // API key as Bearer token
      },
      body: JSON.stringify({
        model: 'model',
        messages,
        stream: true,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`RAGflow ${response.status}: ${await response.text()}`)
  }

  if (!response.body) {
    throw new Error('RAGflow returned empty response body')
  }

  return response.body
}

// Parse delta content from an SSE data line.
// Returns the text token or null if not a content chunk.
export function parseSseLine(line: string): string | null {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    return json?.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}
```

---

### Task 10: /api/chat route with rate limiting + sanitization

**Files:** `app/api/chat/route.ts`

- [ ] **Step 1: Create `app/api/chat/route.ts`**

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { stripHtml } from 'string-strip-html'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { callRagflow, type Message } from '@/lib/ragflow'

const redis      = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
const guestLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'bv:guest' })
const authLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'bv:auth' })

export async function POST(request: Request) {
  // 1. Parse session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1'
  const identifier = user ? `user_${user.id}` : `ip_${ip}`
  const limiter    = user ? authLimit : guestLimit
  const { success } = await limiter.limit(identifier)
  if (!success) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  // 3. Parse body
  let body: { messages: Message[]; conversationId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { messages, conversationId } = body

  // 4. Sanitize last user message
  const lastMsg = messages[messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'user') {
    return Response.json({ error: 'missing_user_message' }, { status: 400 })
  }
  const cleanContent = stripHtml(lastMsg.content).result.trim()
  if (cleanContent.length === 0) {
    return Response.json({ error: 'empty_message' }, { status: 400 })
  }
  if (cleanContent.length > 2000) {
    return Response.json({ error: 'too_long' }, { status: 400 })
  }

  // Sanitize ALL messages (not just the last), replace last with cleanContent, truncate to 40
  const sanitizedMessages: Message[] = [
    ...messages.slice(0, -1).map(m => ({
      role: m.role,
      content: stripHtml(m.content).result.trim() || m.content,
    })),
    { role: 'user', content: cleanContent },
  ].slice(-40)

  // 5. Call RAGflow + relay SSE stream
  let ragflowStream: ReadableStream<Uint8Array>
  try {
    ragflowStream = await callRagflow(sanitizedMessages)
  } catch {
    return Response.json({ error: 'ragflow_unavailable' }, { status: 502 })
  }

  // 6. Accumulate full text while relaying to browser
  let fullText = ''

  // Resolve service client before streaming — createServiceClient is synchronous
  // (no-op cookies) and must not be called after the response has started streaming.
  const svc = (user && conversationId) ? createServiceClient() : null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = ragflowStream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Forward raw chunk to browser
          controller.enqueue(value)

          // Also accumulate decoded text for DB save
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const token = parseSseLineLocal(line)
            if (token) fullText += token
          }
        }
      } finally {
        controller.close()
        reader.releaseLock()

        // 7. Save to DB if authenticated
        if (svc && user && conversationId && fullText) {
          const userMessage = sanitizedMessages[sanitizedMessages.length - 1]

          await svc.from('messages').insert([
            { conversation_id: conversationId, role: 'user',      content: userMessage.content },
            { conversation_id: conversationId, role: 'assistant', content: fullText },
          ])

          // Set title from first user message if not yet set
          const { data: conv } = await svc
            .from('conversations')
            .select('title')
            .eq('id', conversationId)
            .single()

          if (conv?.title === 'New conversation') {
            await svc
              .from('conversations')
              .update({ title: userMessage.content.slice(0, 50) })
              .eq('id', conversationId)
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function parseSseLineLocal(line: string): string | null {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    return json?.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/ragflow.ts app/api/chat/
git commit -m "feat: RAGflow SSE proxy with rate limiting and input sanitization"
```

---

## Chunk 7: Conversation API

### Task 11: Conversation CRUD endpoints

**Files:** `app/api/conversations/route.ts`, `app/api/conversations/[id]/route.ts`

- [ ] **Step 1: Create `app/api/conversations/route.ts`**

```ts
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('conversations')
    .insert({ user_id: user.id, title: 'New conversation' })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/conversations/[id]/route.ts`**

```ts
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyOwnership(userId: string, convId: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('conversations')
    .select('id')
    .eq('id', convId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const svc = createServiceClient()
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    svc.from('conversations').select('*').eq('id', id).single(),
    svc.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
  ])

  return Response.json({ conversation, messages })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const { title } = await request.json()
  if (!title || typeof title !== 'string') {
    return Response.json({ error: 'title required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('conversations')
    .update({ title: title.slice(0, 100) })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(user.id, id)
  if (!owns) return Response.json({ error: 'Not found' }, { status: 404 })

  const svc = createServiceClient()
  // Messages cascade-deleted by FK constraint
  const { error } = await svc.from('conversations').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/conversations/
git commit -m "feat: conversation CRUD API endpoints with ownership verification"
```

---

## Chunk 8: Chat Components

### Task 12: MessageBubble + TypingIndicator

**Files:** `components/chat/MessageBubble.tsx`, `components/chat/TypingIndicator.tsx`

- [ ] **Step 1: Create `components/chat/MessageBubble.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  interrupted?: boolean
}

interface Props {
  message: ChatMessage
  streamInterruptedLabel?: string
}

export default function MessageBubble({ message, streamInterruptedLabel }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-teal-100 text-brand-darkText rounded-[18px_18px_4px_18px]'
            : 'bg-white border border-teal-200 shadow-sm text-gray-700 rounded-[18px_18px_18px_4px]'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.interrupted && (
          <p className="flex items-center gap-1 text-amber-500 text-xs mt-1 font-medium">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {streamInterruptedLabel ?? 'Response was interrupted.'}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/chat/TypingIndicator.tsx`**

```tsx
export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-teal-200 shadow-sm rounded-[18px_18px_18px_4px] px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/chat/MessageBubble.tsx components/chat/TypingIndicator.tsx
git commit -m "feat: MessageBubble and TypingIndicator components"
```

---

### Task 13: MessageInput component

**Files:** `components/chat/MessageInput.tsx`

- [ ] **Step 1: Create `components/chat/MessageInput.tsx`**

```tsx
'use client'

import { useRef, type KeyboardEvent } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
}

export default function MessageInput({ value, onChange, onSend, disabled, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <TextareaAutosize
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          minRows={1}
          maxRows={5}
          className={cn(
            'flex-1 resize-none rounded-xl border border-teal-200 bg-teal-50',
            'px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
            'transition-colors disabled:opacity-50',
            'motion-reduce:transition-none'
          )}
          aria-label={placeholder}
        />
        <button
          onClick={() => { if (!disabled && value.trim()) onSend() }}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            'bg-teal-500 hover:bg-teal-600 text-white',
            'transition-colors duration-200 cursor-pointer',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
            'motion-reduce:transition-none'
          )}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/MessageInput.tsx
git commit -m "feat: MessageInput with react-textarea-autosize and Enter-to-send"
```

---

### Task 14: ChatInterface — the core streaming component

**Files:** `components/chat/ChatInterface.tsx`

- [ ] **Step 1: Create `components/chat/ChatInterface.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'
import MessageBubble, { type ChatMessage } from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import MessageInput from './MessageInput'

interface Props {
  conversationId?: string        // undefined for guest chat
  initialMessages?: ChatMessage[]
}

export default function ChatInterface({ conversationId, initialMessages = [] }: Props) {
  const t = useT()
  const router = useRouter()
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, asstMsg])
    setStreaming(true)

    const history = [...messages, userMsg].slice(-40).map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, conversationId }),
      })

      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: 'unknown' }))
        if (apiError === 'too_long')       setError(t('error.tooLong'))
        else if (apiError === 'rate_limited') setError(t('error.rateLimit'))
        else                               setError(t('error.generic'))
        setMessages(prev => prev.slice(0, -1)) // remove empty assistant msg
        setStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let doneReceived = false
      let interrupted = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { doneReceived = true; continue }
            try {
              const json = JSON.parse(data)
              const token = json?.choices?.[0]?.delta?.content
              if (token) {
                fullText += token
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = { ...next[next.length - 1], content: fullText }
                  return next
                })
              }
            } catch {}
          }
        }
      } catch {
        interrupted = true
      }

      // Mark interrupted if: exception thrown OR stream closed cleanly without [DONE]
      if ((interrupted || !doneReceived) && fullText) {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], interrupted: true }
          return next
        })
      }

      // If this was a new authenticated conversation, update URL
      if (conversationId) {
        router.refresh() // refresh sidebar conversation list
      }
    } catch {
      setError(t('error.generic'))
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, messages, conversationId, t, router])

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-20 text-sm">
              {t('chat.emptyState')}
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              streamInterruptedLabel={t('error.streamInterrupted')}
            />
          ))}
          {streaming && messages[messages.length - 1]?.content === '' && (
            <TypingIndicator />
          )}
          {error && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
                <button
                  onClick={() => { setError(null); setInput(messages[messages.length - 2]?.content ?? '') }}
                  className="ml-1 underline cursor-pointer hover:no-underline"
                >
                  {t('error.retry')}
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <MessageInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={streaming}
        placeholder={t('chat.placeholder')}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatInterface.tsx
git commit -m "feat: ChatInterface with SSE streaming, error handling, and auto-scroll"
```

---

## Chunk 9: Authenticated App Shell

### Task 15: ConversationItem + AppSidebar

**Files:** `components/sidebar/ConversationItem.tsx`, `components/sidebar/AppSidebar.tsx`

- [ ] **Step 1: Create `components/sidebar/ConversationItem.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/LanguageContext'

interface Props {
  id: string
  title: string
  active: boolean
}

export default function ConversationItem({ id, title, active }: Props) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing]   = useState(false)
  const [newTitle, setNewTitle] = useState(title)
  const [hovered, setHovered]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function saveRename() {
    if (!newTitle.trim() || newTitle === title) { setEditing(false); return }
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(t('sidebar.deleteConfirm'))) return
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (active) router.push('/app')
    router.refresh()
  }

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer',
        'transition-colors duration-150',
        active ? 'bg-teal-200 text-brand-darkText' : 'hover:bg-teal-100 text-gray-700'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) router.push(`/app/conversation/${id}`) }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onBlur={saveRename}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 bg-transparent border-b border-teal-400 outline-none text-sm"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{title}</span>
      )}

      {(hovered || active) && !editing && (
        <div className="flex gap-1 ml-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setEditing(true)}
            aria-label={t('sidebar.rename')}
            className="p-1 rounded hover:bg-teal-200 cursor-pointer transition-colors"
          >
            <Pencil className="w-3 h-3 text-gray-500" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            aria-label={t('sidebar.delete')}
            className="p-1 rounded hover:bg-red-100 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3 h-3 text-red-400" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/sidebar/AppSidebar.tsx`**

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import ConversationItem from './ConversationItem'
import { useT } from '@/lib/i18n/LanguageContext'

interface Conversation {
  id: string
  title: string
  updated_at: string
}

interface Props {
  conversations: Conversation[]
}

function groupByDate(convs: Conversation[]) {
  const now = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: Record<'today' | 'yesterday' | 'older', Conversation[]> = {
    today: [], yesterday: [], older: [],
  }

  for (const c of convs) {
    const d = new Date(c.updated_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today)     groups.today.push(c)
    else if (day >= yesterday) groups.yesterday.push(c)
    else                  groups.older.push(c)
  }

  return groups
}

export default function AppSidebar({ conversations }: Props) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  // Derive active conversation from URL — no prop needed from layout
  const activeId = pathname.startsWith('/app/conversation/')
    ? pathname.split('/').pop()
    : undefined

  async function handleNewChat() {
    const res  = await fetch('/api/conversations', { method: 'POST' })
    const { id } = await res.json()
    router.push(`/app/conversation/${id}`)
    router.refresh()
  }

  const groups = groupByDate(conversations)

  return (
    <Sidebar className="border-r border-teal-200 bg-teal-50">
      <SidebarHeader className="p-3 border-b border-teal-200">
        <div className="text-lg font-bold text-teal-700 mb-2">Bamboo Vet</div>
        <Button
          onClick={handleNewChat}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white cursor-pointer"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
          {t('nav.newChat')}
        </Button>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {(['today', 'yesterday', 'older'] as const).map(period => {
          const items = groups[period]
          if (items.length === 0) return null
          return (
            <SidebarGroup key={period}>
              <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-1">
                {t(`sidebar.${period}` as any)}
              </SidebarGroupLabel>
              <div className="px-2 space-y-0.5">
                {items.map(c => (
                  <ConversationItem
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    active={c.id === activeId}
                  />
                ))}
              </div>
            </SidebarGroup>
          )
        })}
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            {t('chat.emptyState')}
          </p>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/sidebar/
git commit -m "feat: ConversationItem (rename/delete) and AppSidebar with date grouping"
```

---

### Task 16: Authenticated app layout + /app pages

**Files:** `components/layout/Header.tsx`, `app/app/layout.tsx`, `app/app/page.tsx`

- [ ] **Step 1: Create `components/layout/Header.tsx`**

```tsx
'use client'

import { LogOut } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useT, useLang } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header() {
  const t = useT()
  const { toggleLang, lang } = useLang()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="h-12 border-b border-teal-200 bg-white flex items-center justify-between px-3 flex-shrink-0">
      <SidebarTrigger className="text-gray-500 hover:text-teal-600 cursor-pointer" />
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="text-xs text-muted-foreground hover:text-teal-600 transition-colors cursor-pointer font-medium"
          aria-label="Toggle language"
        >
          {lang === 'vi' ? 'VI / EN' : 'EN / VI'}
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label={t('nav.logout')}
          className="cursor-pointer hover:bg-teal-50 h-8 w-8"
        >
          <LogOut className="w-4 h-4 text-gray-500" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create `app/app/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/sidebar/AppSidebar'
import Header from '@/components/layout/Header'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: conversations } = await svc
    .from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar conversations={conversations ?? []} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
```

- [ ] **Step 3: Create `app/app/page.tsx`**

```tsx
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { translations } from '@/lib/i18n/translations'
import type { Language } from '@/lib/i18n/translations'

export default async function AppPage() {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language
  const t = (key: string) => (translations[lang] as Record<string, string>)[key] ?? key

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="mb-6 p-4 bg-teal-100 rounded-2xl">
        <Plus className="w-8 h-8 text-teal-600" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-brand-darkText mb-2">
        {t('chat.emptyState')}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {t('nav.newChat')}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verify authenticated shell**

```bash
npm run dev
```
- http://localhost:3000/app → expect redirect to /login (not logged in)
- Log in → expect /app with sidebar on left, header on top, empty state in main area

- [ ] **Step 5: Commit**

```bash
git add components/layout/Header.tsx app/app/
git commit -m "feat: authenticated app shell with sidebar layout and empty state"
```

---

## Chunk 10: Final Pages + Verification

### Task 17: /app/conversation/[id] page

**Files:** `app/app/conversation/[id]/page.tsx`

- [ ] **Step 1: Create `app/app/conversation/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat/ChatInterface'
import type { ChatMessage } from '@/components/chat/MessageBubble'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const svc = createServiceClient()

  // Verify ownership
  const { data: conv } = await svc
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) notFound()

  const { data: messages } = await svc
    .from('messages')
    .select('id, role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const initialMessages: ChatMessage[] = (messages ?? []).map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return (
    <ChatInterface
      conversationId={id}
      initialMessages={initialMessages}
    />
  )
}
```

---

### Task 18: Public /chat guest page

**Files:** `app/(public)/chat/page.tsx`

- [ ] **Step 1: Create `app/(public)/chat/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import ChatInterface from '@/components/chat/ChatInterface'
import LandingNav from '@/components/layout/LandingNav'
import { useT } from '@/lib/i18n/LanguageContext'

export default function PublicChatPage() {
  const t = useT()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <LandingNav />

      {/* Sign-up nudge banner */}
      {!nudgeDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-800">
            {t('chat.nudge')}{' '}
            <Link href="/signup" className="font-semibold underline hover:no-underline text-amber-900">
              {t('nav.signup')}
            </Link>
          </span>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label={t('chat.nudge.dismiss')}
            className="ml-4 text-amber-600 hover:text-amber-800 cursor-pointer p-1 rounded"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify guest chat works end-to-end**

```bash
npm run dev
```
1. Open http://localhost:3000/chat
2. Confirm amber nudge banner appears with dismiss button
3. Type a test message (e.g., "Liều amoxicillin cho chó 10kg?")
4. Confirm message sends and streaming response appears token-by-token
5. Dismiss nudge banner — confirm it disappears
6. Confirm page reload clears history (useState only)

- [ ] **Step 3: Commit**

```bash
git add app/app/conversation/ app/(public)/chat/
git commit -m "feat: conversation page and public guest chat page"
```

---

### Task 19: Final end-to-end verification

- [ ] **Step 1: Full auth flow**

```bash
npm run dev
```
1. Go to http://localhost:3000 → landing page with hero + features
2. Click "Dùng thử ngay" → /chat (public chat works)
3. Click "Đăng ký" → /signup → create test account
4. Expect redirect to /app → sidebar visible, empty state shown
5. Click "Cuộc trò chuyện mới" → /app/conversation/[new-id]
6. Send a message → RAGflow streams response token-by-token
7. Refresh page → conversation history loads from Supabase
8. Rename conversation in sidebar → title updates
9. Delete conversation → navigate back to /app
10. Click VI/EN toggle → UI switches language

- [ ] **Step 2: Verify security headers**

```bash
curl -I http://localhost:3000 | grep -E "X-Frame|X-Content|Referrer|Content-Security"
```
Expected output:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
```

- [ ] **Step 3: Verify rate limiting (guest)**

Send 31 rapid requests to /api/chat without auth:
```bash
for i in $(seq 1 31); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}]}'
done
```
Expected: first 30 return 200 (or stream), 31st returns 429.

- [ ] **Step 4: Verify TypeScript final check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: ui-ux-pro-max pre-delivery checklist**

```
[ ] No emojis as icons — all icons from Lucide React
[ ] cursor-pointer on all clickable elements
[ ] Hover states with smooth transitions (150-300ms)
[ ] Light mode text contrast 4.5:1 minimum
[ ] Focus states visible (ring-2 ring-teal-500)
[ ] prefers-reduced-motion respected (motion-reduce: variants)
[ ] Responsive at 375px, 768px, 1024px, 1440px — test in browser devtools
[ ] No horizontal scroll on mobile
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Bamboo Vet MVP — all pages, chat streaming, auth, i18n"
```

---

## Future: Vercel Deployment Checklist

When ready to deploy to Vercel:

1. Push to GitHub: `git remote add origin <your-repo-url> && git push -u origin master`
2. Connect repo in Vercel dashboard
3. Add all env vars from `.env.example` in Vercel → Project Settings → Environment Variables
4. Update `RAGFLOW_BASE_URL` to your tunnel/VPS URL (see spec for options A/B/C)
5. Add Vercel deployment URL to Supabase → Authentication → URL Configuration → Site URL
6. Add Vercel URL to Google OAuth authorized redirect URIs (if using Google login)
7. Deploy — first build may take 2–3 minutes
