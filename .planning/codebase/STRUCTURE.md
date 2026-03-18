# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
Bamboo Vet/
├── app/                        # Next.js App Router pages and API routes
│   ├── (auth)/                 # Route group for login/signup pages (public)
│   │   ├── login/
│   │   │   └── page.tsx        # Email/password + Google OAuth login form
│   │   └── signup/
│   │       └── page.tsx        # Email/password + Google OAuth signup form
│   ├── (public)/               # Route group for public landing + guest chat
│   │   ├── chat/
│   │   │   └── page.tsx        # Guest chat interface (no persistence)
│   │   └── page.tsx            # Landing page with hero and features
│   ├── app/                    # Route group for authenticated dashboard (protected)
│   │   ├── conversation/
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Single conversation view with history
│   │   ├── layout.tsx          # Protected layout with sidebar + header
│   │   └── page.tsx            # App index (empty state for new chat)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts        # OAuth callback handler (exchangeCodeForSession)
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts        # POST endpoint for chat submission (SSE streaming)
│   │   └── conversations/
│   │       ├── route.ts        # GET/POST for listing + creating conversations
│   │       └── [id]/
│   │           └── route.ts    # Individual conversation operations
│   ├── layout.tsx              # Root layout (LanguageProvider, fonts, metadata)
│   └── globals.css             # Global Tailwind + custom utility classes
│
├── components/                 # Reusable React components
│   ├── chat/                   # Chat feature components
│   │   ├── ChatInterface.tsx   # Main chat UI container (client component, streaming logic)
│   │   ├── MessageBubble.tsx   # Single message display (user/assistant roles)
│   │   ├── MessageInput.tsx    # Text input with send button (autosize textarea)
│   │   └── TypingIndicator.tsx # Animated loading indicator while streaming
│   ├── layout/                 # Layout structural components
│   │   ├── Header.tsx          # Top bar with language toggle + logout
│   │   └── LandingNav.tsx      # Navigation bar for public pages
│   ├── sidebar/                # Sidebar navigation components
│   │   ├── AppSidebar.tsx      # Sidebar container with conversation grouping by date
│   │   └── ConversationItem.tsx # Clickable conversation entry
│   └── ui/                     # shadcn/ui primitive components (buttons, inputs, etc.)
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── alert.tsx
│       ├── sidebar.tsx         # Complex sidebar primitive (with triggers, providers)
│       ├── dialog.tsx
│       ├── sheet.tsx           # Mobile-friendly sidebar drawer
│       ├── scroll-area.tsx
│       ├── skeleton.tsx        # Loading placeholder
│       ├── textarea.tsx        # Base textarea (used in MessageInput)
│       └── [other primitives]
│
├── hooks/                      # Custom React hooks
│   └── use-mobile.ts           # Media query hook for responsive behavior
│
├── lib/                        # Business logic and utilities
│   ├── supabase/
│   │   ├── server.ts           # Server-side Supabase client factories (createClient, createServiceClient)
│   │   ├── client.ts           # Client-side Supabase client factory
│   │   └── middleware.ts       # Session refresh + route guards (used by proxy.ts)
│   ├── i18n/
│   │   ├── LanguageContext.tsx # React Context for language + translation function
│   │   └── translations.ts     # Typed translation object (English/Vietnamese)
│   ├── ragflow.ts              # RAGflow API integration (callRagflow, parseSseLine)
│   └── utils.ts                # Shared utility functions (likely Tailwind helpers)
│
├── supabase/                   # Supabase local development config
│   └── [config files]          # Migration templates, seed scripts
│
├── docs/                       # Planning and specification documents
│   └── superpowers/
│       ├── plans/              # Implementation plans from GSD
│       └── specs/              # Design specs and requirements
│
├── .next/                      # Build output (generated, ignored in git)
├── node_modules/               # Dependencies
│
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration (ES2017, strict mode, path alias @/*)
├── next.config.js              # Next.js config (CSP headers, security headers)
├── proxy.ts                    # Middleware entry point (calls updateSession)
├── postcss.config.mjs          # PostCSS/Tailwind config
├── components.json             # shadcn/ui configuration
├── .env.example                # Template for environment variables
├── .env.local                  # Local env vars (not committed)
└── .gitignore                  # Excludes node_modules, .env, .next
```

## Directory Purposes

**app/**
Purpose: Next.js App Router structure. All pages, layouts, and API routes.
Contains: Server components (pages, layouts), client components (interactive pages), API route handlers
Key files: `layout.tsx` (root), `globals.css` (global styles), API routes in `app/api/`

**components/**
Purpose: Reusable React components organized by feature and UI primitives.
Contains: Feature components (chat, sidebar, layout), shadcn/ui primitives
Key files: `ChatInterface.tsx` (core chat logic), `AppSidebar.tsx` (conversation list), `ui/*` (primitives)

**lib/**
Purpose: Business logic, integrations, and utilities.
Contains: Supabase clients, i18n context, RAGflow integration, utils
Key files: `lib/supabase/server.ts` (client factories), `lib/i18n/LanguageContext.tsx` (i18n), `lib/ragflow.ts` (LLM)

**hooks/**
Purpose: Custom React hooks.
Contains: Reusable logic for components
Key files: `use-mobile.ts` (responsive breakpoint)

**supabase/**
Purpose: Local Supabase development configuration.
Contains: Migration SQL, seed data templates
Generated: Yes (by `supabase init`)
Committed: Yes (for team dev parity)

**docs/**
Purpose: Specification and planning documents.
Contains: GSD plans, design specs
Generated: Partially (by GSD tools)
Committed: Yes

**.planning/codebase/**
Purpose: Generated codebase analysis documents.
Contains: STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
Generated: Yes (by GSD mapper)
Committed: Yes

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout wrapping all pages with LanguageProvider
- `app/(public)/page.tsx`: Landing page (/)
- `app/(public)/chat/page.tsx`: Public guest chat (/chat)
- `app/app/layout.tsx`: Protected dashboard layout (/app/*)
- `app/app/page.tsx`: App home (/app)
- `app/app/conversation/[id]/page.tsx`: Conversation view (/app/conversation/[id])

**Configuration:**
- `next.config.js`: CSP headers, security headers
- `tsconfig.json`: TypeScript paths, strict mode
- `postcss.config.mjs`: Tailwind PostCSS
- `components.json`: shadcn/ui aliases

**Core Logic:**
- `app/api/chat/route.ts`: Chat submission with SSE streaming
- `app/api/conversations/route.ts`: Conversation CRUD
- `lib/ragflow.ts`: RAGflow API integration
- `lib/supabase/server.ts`: Supabase client factories
- `lib/i18n/LanguageContext.tsx`: i18n provider

**Authentication & Middleware:**
- `lib/supabase/middleware.ts`: Session refresh, route guards
- `proxy.ts`: Middleware entry point
- `app/auth/callback/route.ts`: OAuth callback

**Styling:**
- `app/globals.css`: Global styles, Tailwind directives, custom utilities
- `components/ui/*`: shadcn/ui components (Tailwind-based)
- `tailwind.config.ts`: Tailwind theme (auto-generated by shadcn)

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase + `.tsx` (e.g., `ChatInterface.tsx`)
- Hooks: kebab-case with `use-` prefix (e.g., `use-mobile.ts`)
- Utilities: camelCase + `.ts` (e.g., `ragflow.ts`)
- Config: Dot-separated names (e.g., `.env.local`)

**Directories:**
- Feature groups: PascalCase or kebab-case (e.g., `components/chat`, `lib/supabase`)
- Next.js route groups: Parentheses (e.g., `(auth)`, `(public)`)
- Dynamic routes: Brackets (e.g., `[id]`, `[slug]`)

**Component Props:**
- Interface naming: Component name + "Props" (e.g., `ChatInterfaceProps`)
- Prop destructuring in function signature

**Types:**
- TypeScript interfaces/types: PascalCase (e.g., `Message`, `ChatMessage`, `Language`)
- Enums: PascalCase (if any)

## Where to Add New Code

**New Chat Feature (e.g., message reactions):**
- Primary code: `components/chat/` (new component or extend `MessageBubble.tsx`)
- API logic: `app/api/chat/route.ts` (extend POST handler) or new `app/api/reactions/route.ts`
- Database schema: `supabase/migrations/` (new migration SQL)
- Tests: Co-located with components (if testing added)

**New Component/UI Element:**
- Implementation: `components/[feature]/Component.tsx` (or `components/ui/` if reusable primitive)
- Export: If in subdirectory, consider barrel file (`components/chat/index.ts` exporting all)
- Usage: Import via `@/components/chat/Component`

**New Route/Page:**
- Implementation: `app/path/page.tsx` (server component by default)
- Protected route: Place under `app/app/` (auto-guarded by middleware)
- Public route: Place under `app/(public)/`
- Dynamic segments: Use `[param]` or `[[...slug]]` for catch-all

**New API Endpoint:**
- Implementation: `app/api/endpoint/route.ts` (with `GET`, `POST`, etc. exports)
- Authentication: Validate session via `createClient().auth.getUser()`
- Database access: Use `createServiceClient()` for admin operations
- Rate limiting: Add to Upstash setup in `app/api/chat/route.ts` as template

**New Hook:**
- Implementation: `hooks/use-feature-name.ts`
- Naming: Lowercase, dash-separated with `use-` prefix
- Export: Default export or named export

**Utilities & Helpers:**
- Shared helpers: `lib/utils.ts` or feature-specific `lib/feature/utils.ts`
- Supabase logic: Extend `lib/supabase/` (new file per concern)
- I18n: Add keys to `lib/i18n/translations.ts` and use via `useT()` or `t()` function

**New Middleware/Guard:**
- Implementation: `lib/supabase/middleware.ts` (extend `updateSession`) or `proxy.ts` (change config)
- Testing: No test files (manual verification with dev server)

## Special Directories

**node_modules/**
Purpose: npm dependencies
Generated: Yes (by `npm install`)
Committed: No

**.next/**
Purpose: Build cache and output
Generated: Yes (by `next build` or `next dev`)
Committed: No

**.planning/codebase/**
Purpose: Codebase analysis documents (generated by GSD mapper)
Generated: Yes (by `/gsd:map-codebase`)
Committed: Yes

**supabase/**
Purpose: Local Supabase configuration and migrations
Generated: Partially (migrations generated by migrations, seed by user)
Committed: Yes

**docs/superpowers/**
Purpose: GSD-generated plans and specifications
Generated: Yes (by GSD planner/executor)
Committed: Yes
