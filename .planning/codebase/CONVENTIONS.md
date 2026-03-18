# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `ChatInterface.tsx`, `MessageBubble.tsx`, `ConversationItem.tsx`)
- Pages: kebab-case in directory names with PascalCase component export (e.g., `app/(auth)/login/page.tsx`)
- Utilities and hooks: camelCase (e.g., `use-mobile.ts`, `utils.ts`)
- Configuration files: camelCase with extensions (e.g., `next.config.js`, `postcss.config.mjs`)
- Directories: kebab-case (e.g., `components/chat/`, `lib/i18n/`, `lib/supabase/`)

**Functions:**
- camelCase for all function declarations and exports
- Examples: `sendMessage()`, `handleKeyDown()`, `createClient()`, `callRagflow()`, `parseSseLine()`
- Event handlers prefixed with `handle`: `handleEmailLogin()`, `handleGoogleLogin()`, `handleDelete()`
- Getter functions prefixed with `use` for hooks: `useT()`, `useLang()`, `useIsMobile()`

**Variables:**
- camelCase for local and state variables
- Examples: `messages`, `conversationId`, `isUser`, `streamInterrupted`, `textareaRef`
- Boolean variables often use `is`, `has`, or verbs: `isUser`, `isMobile`, `hasError`, `disabled`
- Ref names end with `Ref`: `inputRef`, `textareaRef`, `bottomRef`
- State setters follow React convention: `setMessages()`, `setInput()`, `setError()`, `setLoading()`

**Types:**
- Interface and type names: PascalCase
- Examples: `ChatMessage`, `Message`, `Language`, `TranslationKey`, `Props`, `LanguageContextValue`
- Exported types are type-safe literals: `type Language = 'vi' | 'en'`
- Union types use discriminating properties: `role: 'user' | 'assistant'`

**Constants:**
- UPPER_SNAKE_CASE for module-level constants
- Examples: `MOBILE_BREAKPOINT`, `RAGFLOW_CHAT_ID`, `RAGFLOW_API_KEY`

## Code Style

**Formatting:**
- No explicit formatter configuration (ESLint ^9 only)
- Semicolons: Always included at end of statements
- Quotes: Single quotes for strings in TypeScript/JS, double quotes acceptable in JSX attributes
- Indentation: 2 spaces (observed throughout codebase)
- Line length: No strict limit observed, but lines generally kept under 120 characters

**Linting:**
- Tool: ESLint ^9 with `eslint-config-next` for Next.js
- Configuration: Uses Next.js ESLint rules (check `package.json` lint script)
- Run: `npm run lint` or `pnpm lint`
- No separate Prettier config; relies on ESLint's built-in formatting rules

**Whitespace:**
- Consistent spacing around operators: `const x = a + b`
- One space after commas: `({ id, title, active })`
- Aligned variable declarations in some cases: `const redis = ...; const guestLimit = ...; const authLimit = ...;`
- Blank lines separate logical sections within functions

## Import Organization

**Order:**
1. External libraries (React, Next.js, third-party packages)
   - `import type { Metadata } from 'next'`
   - `import { useState, useRef, useEffect, useCallback } from 'react'`
   - `import { AlertCircle } from 'lucide-react'`

2. Internal imports with path aliases
   - `import { useT } from '@/lib/i18n/LanguageContext'`
   - `import MessageBubble from './MessageBubble'`
   - Relative imports within same directory use `./` (e.g., `./MessageBubble`)

3. CSS/style imports (at end)
   - `import './globals.css'`

**Path Aliases:**
- `@/*` maps to project root (configured in `tsconfig.json`)
- Used extensively: `@/lib/*`, `@/components/*`, `@/hooks/*`
- Allows clean imports regardless of nesting depth

## Error Handling

**Patterns:**
- Try-catch blocks for async operations and JSON parsing
- Examples: `try { body = await request.json() } catch { ... }`
- Silent catches with empty block: `catch {}` when error is expected/handled elsewhere
- HTTP status codes returned explicitly in API routes: `Response.json({ error: ... }, { status: 400 })`
- Error logging to console in server-side code: `console.error('[chat] Failed to save messages:', msgError)`
- String-based error codes for API responses: `{ error: 'rate_limited' }`, `{ error: 'too_long' }`
- User-facing error messages retrieved via `t()` translation function for internationalization

**Error types:**
- API errors categorized: `invalid_body`, `missing_user_message`, `empty_message`, `too_long`, `rate_limited`, `ragflow_unavailable`
- State errors handled with nullable types: `error: string | null`

## Logging

**Framework:** Built-in `console` methods (no logging library)

**Patterns:**
- Server-side: `console.error('[context] message', data)` with bracket-prefixed context tag
- Examples: `console.error('[chat] Failed to save messages:', msgError)`
- Error logging includes context and relevant data for debugging
- No logging on client-side (browser console not used for app logs)
- Conditional logging can be wrapped in try-catch for silent failures

## Comments

**When to Comment:**
- JSDoc-style comments on exported functions and types (observed in `lib/ragflow.ts`)
- Inline comments for non-obvious logic, especially state management
- Examples: `// Mark interrupted if: exception thrown OR stream closed cleanly without [DONE]`
- Section comments in component render: `{/* Messages area */}`, `{/* Input bar */}`

**JSDoc/TSDoc:**
- Function documentation above export:
  ```typescript
  // Parse delta content from an SSE data line.
  // Returns the text token or null if not a content chunk.
  export function parseSseLine(line: string): string | null
  ```
- Parameter descriptions rarely detailed; types and names are self-documenting
- Return type documented when non-obvious

## Function Design

**Size:** Functions kept under 100 lines with clear single responsibility
- `sendMessage()`: ~50 lines, handles message submission and streaming
- `ChatInterface()`: ~45 lines, manages chat state and rendering
- API routes: 15-50 lines with numbered comment sections

**Parameters:**
- Destructured props interface in React components: `function ChatInterface({ conversationId, initialMessages }: Props)`
- Optional parameters use default values: `initialMessages = []`
- Type parameters explicitly defined via `Props` interface
- Async functions use async/await, no promise chains

**Return Values:**
- Components return JSX
- Hooks return typed values: `useCallback()` returns function, `useState()` returns [value, setter]
- API routes return `Response.json()` or `new Response()`
- Utility functions return typed values matching type signatures

## Module Design

**Exports:**
- Named exports for types: `export type Language = 'vi' | 'en'`
- Named exports for utilities: `export function cn(...inputs: ClassValue[])`
- Default exports for React components: `export default function ChatInterface(...)`
- Mixed exports (type + component): `export { Button, buttonVariants }` in UI components
- Interface exports for props: `export interface ChatMessage { ... }`

**Barrel Files:**
- Not used extensively; imports are typically direct paths
- Example: `import { Button } from '@/components/ui/button'` (not from barrel index)
- `export { Button, buttonVariants }` in button component exports both component and style variants

## TypeScript Usage

**Strict Mode:** Enabled in `tsconfig.json` (`"strict": true`)

**Type Definitions:**
- Comprehensive prop interfaces: `interface Props { ... }`
- Union types for limited sets: `role: 'user' | 'assistant'`, `Language = 'vi' | 'en'`
- Type literals for translation keys: `type TranslationKey = '...' | '...' | ...`
- Generic types used in React hooks: `useState<ChatMessage[]>`, `useRef<HTMLDivElement>`

**Optional/Nullable:**
- Nullable types explicitly marked: `error: string | null`, `interrupted?: boolean`
- Optional properties in interfaces: `conversationId?: string`
- Non-null assertion used sparingly: `redis!`, `apiKey!` for environment variables known at runtime

## React Patterns

**Component Structure:**
- Functional components with hooks (no class components)
- 'use client' directive for client components at top of file
- Inline prop types via `Props` interface
- Default export pattern: `export default function ComponentName(props) { ... }`

**State Management:**
- `useState()` for local component state
- Context API for global state (`LanguageProvider`)
- No external state management library (Redux, Zustand)

**Event Handlers:**
- Inline arrow functions in JSX: `onChange={e => setInput(e.target.value)}`
- Wrapped in `useCallback()` when passed to child components or used in effects
- Named functions for complex handlers: `async function handleEmailLogin(e) { ... }`

**Side Effects:**
- `useEffect()` for setup/teardown logic
- `useCallback()` for memoized functions passed to children
- Dependency arrays properly specified: `useEffect(() => { ... }, [messages, streaming])`

## CSS/Styling

**Framework:** Tailwind CSS v4

**Pattern:**
- Utility classes applied directly to elements
- `cn()` helper (clsx + tailwind-merge) for conditional class composition
- Example: `className={cn('flex items-center gap-2', isUser ? 'justify-end' : 'justify-start')}`

**Component Styling:**
- shadcn/ui components with Base UI primitives
- Class Variance Authority (CVA) for variant components: `const buttonVariants = cva(...)`
- Theme variables in `globals.css`: `--color-teal-500`, `--color-brand-primary`
- Color palette: Teal-based with brand aliases

**Responsive Classes:**
- Standard Tailwind breakpoints: `max-w-3xl`, `px-4 py-3`, `text-sm`
- Motion reduction: `motion-reduce:transition-none` for accessibility
- Focus rings: `focus-visible:ring-2 focus-visible:ring-teal-500`

---

*Convention analysis: 2026-03-18*
