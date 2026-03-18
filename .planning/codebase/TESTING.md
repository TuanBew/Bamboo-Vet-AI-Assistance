# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework Status

**Current Status:** No testing framework configured

- No Jest, Vitest, or other test runner installed
- No test files present in codebase (checked: `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`)
- `package.json` contains no testing dependencies
- No test configuration files: `jest.config.*`, `vitest.config.*`, or similar

**Development Environment:**
- ESLint ^9 with Next.js config for static analysis only
- TypeScript strict mode enabled for type safety
- No automated test suite coverage

## Recommended Testing Setup (Future)

### Framework Choice
**Recommended: Vitest** for Next.js projects with TypeScript:
- Faster than Jest with ES modules
- Lower memory footprint
- Better TypeScript support
- Modern async/await patterns

**Installation (when needed):**
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
```

### Configuration Template
Create `vitest.config.ts` in project root:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

## Test File Organization

**Recommended Location:** Co-locate with source files

**Structure:**
```
components/
├── chat/
│   ├── ChatInterface.tsx
│   ├── ChatInterface.test.tsx
│   ├── MessageBubble.tsx
│   └── MessageBubble.test.tsx
lib/
├── i18n/
│   ├── LanguageContext.tsx
│   ├── LanguageContext.test.tsx
│   └── translations.ts
```

**Naming Convention:**
- Test files: `[ComponentName].test.tsx` (same name as source)
- For utilities: `[functionName].test.ts`

## Test Structure Pattern

**Recommended Test Suite Organization:**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ChatInterface from './ChatInterface'

describe('ChatInterface', () => {
  beforeEach(() => {
    // Setup: mock dependencies, create fixtures
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup: unmount components, reset state
    vi.restoreAllMocks()
  })

  describe('message sending', () => {
    it('should send message on button click', async () => {
      render(<ChatInterface />)
      // Arrange
      const input = screen.getByPlaceholderText(/ask your question/i)
      const sendButton = screen.getByLabelText(/send message/i)

      // Act
      fireEvent.change(input, { target: { value: 'test message' } })
      fireEvent.click(sendButton)

      // Assert
      await waitFor(() => {
        expect(screen.getByText('test message')).toBeInTheDocument()
      })
    })

    it('should send message with Enter key', () => {
      // Test keyboard interaction
    })

    it('should trim whitespace before sending', () => {
      // Test input validation
    })
  })

  describe('error handling', () => {
    it('should display rate limit error', async () => {
      // Mock fetch to return rate limit error
    })

    it('should display stream interrupted warning', async () => {
      // Test interrupted flag display
    })
  })

  describe('streaming', () => {
    it('should accumulate tokens from SSE stream', async () => {
      // Test streaming parser
    })
  })
})
```

## Mocking Patterns

**Framework:** Vitest's `vi` mock utilities

### Fetching/HTTP Mocking
```typescript
import { vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

it('should handle fetch errors', async () => {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failed'))

  // Test code that calls fetch

  expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
})

it('should parse SSE stream responses', async () => {
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n'))
      controller.close()
    }
  })

  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    body: mockStream
  })
})
```

### Context/Hook Mocking
```typescript
import { vi } from 'vitest'
import { useT } from '@/lib/i18n/LanguageContext'

vi.mock('@/lib/i18n/LanguageContext', () => ({
  useT: vi.fn(() => (key: string) => key),
  useLang: vi.fn(() => ({ lang: 'en', toggleLang: vi.fn() }))
}))
```

### Router Mocking
```typescript
import { useRouter } from 'next/navigation'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn()
  }))
}))
```

### Supabase Client Mocking
```typescript
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {} })
    }))
  }))
}))
```

## What to Mock

**Mock these:**
- External API calls (`fetch`, HTTP requests)
- Navigation (`useRouter`, `router.push`, `router.refresh`)
- Authentication (`supabase.auth.*`)
- Database operations (`supabase.from().select/insert/update`)
- Environment variables accessed at runtime
- Third-party libraries (Upstash Redis, RAGflow)
- `window` object methods (`window.matchMedia`, `document.cookie`)

**Do NOT mock these:**
- React hooks themselves (`useState`, `useEffect`, `useCallback`)
- UI components from the same codebase
- Translation function (`useT`) behavior — mock the context, test `useT` separately
- Tailwind CSS classes

## Fixtures and Test Data

**Test Data Location:** `__fixtures__` or `test/fixtures/` directory

**Example message fixture:**
```typescript
// lib/__fixtures__/messages.ts
export const mockChatMessage = {
  id: 'msg-1',
  role: 'user' as const,
  content: 'What is the dosage for Amoxicillin in dogs?'
}

export const mockAssistantMessage = {
  id: 'msg-2',
  role: 'assistant' as const,
  content: 'For dogs: 10-20 mg/kg every 8-12 hours...',
  interrupted: false
}

export const mockMessages = [mockChatMessage, mockAssistantMessage]
```

**Example Supabase response fixture:**
```typescript
// lib/supabase/__fixtures__/responses.ts
export const mockUser = {
  id: 'user-123',
  email: 'vet@example.com',
  created_at: '2024-01-01T00:00:00Z'
}

export const mockConversation = {
  id: 'conv-1',
  user_id: 'user-123',
  title: 'Dosage Questions',
  created_at: '2024-03-18T00:00:00Z'
}
```

## Coverage

**Target Coverage:** Not currently enforced, but recommended for future:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**View Coverage (when tests added):**
```bash
npm run test:coverage
vitest --coverage
```

**Priority Areas for Testing:**
1. API routes (`app/api/chat/route.ts`, `app/api/conversations/route.ts`)
2. Utility functions (`lib/ragflow.ts`, `lib/utils.ts`, `lib/supabase/`)
3. Context providers (`lib/i18n/LanguageContext.tsx`)
4. Components with state (`ChatInterface.tsx`, `ConversationItem.tsx`)

## Test Types

### Unit Tests
**Scope:** Individual functions and components in isolation

**Examples:**
- `parseSseLine()` function with various SSE formats
- `cn()` utility with class composition
- `useIsMobile()` hook with window resize
- Button component rendering with variants
- MessageBubble with different message types

### Integration Tests
**Scope:** Component interactions and data flow

**Examples:**
- ChatInterface sending messages and receiving SSE stream
- ConversationItem rename/delete operations with API calls
- Login form with Supabase auth
- Language context switching and cookie updates
- Message history loading and display

### E2E Tests
**Framework:** Not yet configured; consider Playwright or Cypress when needed

**Recommended setup:**
```bash
npm install --save-dev @playwright/test
```

**Example E2E test:**
```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test('user can chat end-to-end', async ({ page }) => {
  await page.goto('http://localhost:3000/app/chat')
  await page.fill('textarea', 'What is the dosage for Amoxicillin?')
  await page.click('button[aria-label="Send message"]')
  await page.waitForSelector('text=mg/kg', { timeout: 10000 })
  expect(page.locator('text=mg/kg')).toBeVisible()
})
```

## Common Patterns

### Async Testing
```typescript
it('should handle async messages', async () => {
  const { rerender } = render(<ChatInterface />)

  const input = screen.getByPlaceholderText(/ask your question/i)
  fireEvent.change(input, { target: { value: 'test' } })
  fireEvent.click(screen.getByLabelText(/send/i))

  // Wait for async streaming to complete
  await waitFor(() => {
    expect(screen.getByText(/response text/i)).toBeInTheDocument()
  }, { timeout: 5000 })
})
```

### Error Testing
```typescript
it('should handle rate limiting error', async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'rate_limited' })
  })

  render(<ChatInterface />)
  // ... trigger send

  await waitFor(() => {
    expect(screen.getByText(/please try again/i)).toBeInTheDocument()
  })
})

it('should display generic error on unknown error', async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: 'unknown_code' })
  })

  render(<ChatInterface />)
  // ... trigger send

  await waitFor(() => {
    expect(screen.getByText(/error occurred/i)).toBeInTheDocument()
  })
})
```

### Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react'

it('should toggle language', () => {
  const { result } = renderHook(() => useLang())

  expect(result.current.lang).toBe('vi')

  act(() => {
    result.current.toggleLang()
  })

  expect(result.current.lang).toBe('en')
  expect(document.cookie).toContain('lang=en')
})
```

## Run Commands (When Tests Added)

```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
npm run test:ui          # Vitest UI (optional)
```

## TypeScript in Tests

**Test file setup:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ChatMessage } from '@/components/chat/MessageBubble'

// Full type safety in test assertions
const message: ChatMessage = {
  id: 'test',
  role: 'user',
  content: 'test'
}
```

**Mock type safety:**
```typescript
vi.mocked(useRouter).mockReturnValueOnce({
  push: vi.fn(),
  refresh: vi.fn()
} as any) // Type assertion needed for incomplete mocks
```

---

*Testing analysis: 2026-03-18*

**Note:** Current codebase has no automated tests. These patterns and recommendations are for future implementation. Priority areas for test coverage: API routes, utility functions, and state management (LanguageContext).
