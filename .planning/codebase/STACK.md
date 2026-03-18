# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.x - All source code, configuration, and type-safe development
- JSX/TSX - React component definitions in `app/` and `components/`

**Secondary:**
- SQL - Supabase database schema in `supabase/schema.sql`
- JavaScript - Next.js configuration files, PostCSS config

## Runtime

**Environment:**
- Node.js (version not explicitly pinned in package.json)
- Next.js 16.1.6 as the framework runtime

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (version-locked dependencies)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with server components, API routes, and middleware
- React 19.2.3 - UI component framework (with React DOM 19.2.3)

**UI Components:**
- Base UI React 1.3.0 - Headless component library (primary UI foundation)
- shadcn 4.0.6 - Component registry system with Tailwind integration
- Lucide React 0.577.0 - Icon library for UI components

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework via `@tailwindcss/postcss` plugin
- PostCSS 4 - CSS processing pipeline configured in `postcss.config.mjs`
- Class Variance Authority 0.7.1 - Type-safe className composition for styled components
- Tailwind Merge 3.5.0 - Merge Tailwind classes without conflicts
- tw-animate-css 1.4.0 - Animation library for Tailwind

**Form/Input:**
- react-textarea-autosize 8.5.9 - Auto-expanding textarea component for chat messages

**Text Processing:**
- string-strip-html 13.5.3 - HTML stripping and sanitization for message content

**Utilities:**
- clsx 2.1.1 - Conditional className combination utility

## Key Dependencies

**Critical:**
- @supabase/ssr 0.9.0 - Server-side Supabase client with cookie management for SSR
- @supabase/supabase-js 2.99.1 - Browser/client Supabase SDK for auth and database queries
- @upstash/ratelimit 2.0.8 - Rate limiting library with sliding window implementation
- @upstash/redis 1.37.0 - Redis client for Upstash serverless Redis service

**Infrastructure:**
- None explicitly listed beyond the above

## Configuration

**Environment:**
- Configuration via environment variables loaded from `.env.local` (development) and deployment platform (production)
- `.env.example` provided as template with three integration categories:
  - RAGFlow AI API configuration
  - Supabase PostgreSQL and authentication
  - Upstash Redis for rate limiting
- No `.env` in git (listed in `.gitignore`)

**Build:**
- `next.config.js` - Configures security headers (CSP, X-Frame-Options, etc.)
- `tsconfig.json` - TypeScript configuration with ES2017 target, strict mode enabled
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS 4
- `components.json` - shadcn component registry configuration with Base Nova style

**Security:**
- Next.js security headers configured in `next.config.js`:
  - Content-Security-Policy allows self, unsafe-inline scripts, Google Fonts, and Supabase domains
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin

## Platform Requirements

**Development:**
- Node.js LTS recommended
- npm for dependency management
- Text editor with TypeScript support (VS Code recommended, configured in `.gitignore` with `.vscode/` excluded)

**Production:**
- Deployment to Vercel (Next.js native hosting) or any Node.js-compatible platform
- Node.js runtime for API routes
- Environment variables for RAGFLOW_*, SUPABASE_*, UPSTASH_* must be set at deployment time

---

*Stack analysis: 2026-03-18*
