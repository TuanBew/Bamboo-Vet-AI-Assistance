# AI Analysis Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered analysis board to the dashboard that waits 10 seconds after page load before fetching Gemini insights, preventing token waste from casual visitors.

**Architecture:** Client component with in-memory state machine (waiting/loading/ready/error). A one-shot 10s timer on mount gates the first API call. After gate opens (first success), filter changes trigger immediate re-fetch. All Gemini calls go through a Next.js API route — the API key never reaches the browser. HTML response is sanitized with isomorphic-dompurify before rendering.

**Tech Stack:** Next.js 15 App Router, isomorphic-dompurify, Gemini 2.0 Flash API, existing Supabase RPCs (dashboard_door_monthly, dashboard_dpur_monthly), Playwright, Vitest

---

## BATCH 1: API Route + Data Aggregation

### Task AI-001: Install isomorphic-dompurify

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `npm install isomorphic-dompurify && npm install --save-dev @types/dompurify`

- [ ] **Step 2: Verify installation**

Run: `node -e "const dp = require('isomorphic-dompurify'); console.log('DOMPurify loaded OK')"`
Expected: prints "DOMPurify loaded OK" without error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install isomorphic-dompurify for AI board HTML sanitization"
```

---

### Task AI-002: Add Vietnamese strings for AI board

**Files:**
- Modify: `lib/i18n/vietnamese.ts`
- Create: `lib/admin/__tests__/ai-analysis-strings.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/admin/__tests__/ai-analysis-strings.test.ts`:

```typescript
import { VI } from '@/lib/i18n/vietnamese'

describe('VI.aiAnalysis strings', () => {
  it('has all required keys', () => {
    expect(VI.aiAnalysis.title).toBe('AI phân tích')
    expect(VI.aiAnalysis.waiting).toContain('AI đang chuẩn bị')
    expect(VI.aiAnalysis.loading).toContain('AI đang phân tích')
    expect(VI.aiAnalysis.error).toContain('Không thể tải phân tích AI')
    expect(VI.aiAnalysis.retry).toBe('Thử lại')
  })
})
```

- [ ] **Step 2: Run test — confirm failure**

Run: `npm test -- --reporter=verbose 2>&1 | grep -A5 "ai-analysis-strings"`
Expected: FAIL — `VI.aiAnalysis is undefined`

- [ ] **Step 3: Add strings to VI**

In `lib/i18n/vietnamese.ts`, add inside the VI export object:

```typescript
aiAnalysis: {
  title: 'AI phân tích',
  waiting: '🤖 AI đang chuẩn bị phân tích dữ liệu...',
  loading: '🤖 AI đang phân tích dữ liệu...',
  error: 'Không thể tải phân tích AI. Vui lòng thử lại sau.',
  retry: 'Thử lại',
},
```

- [ ] **Step 4: Run test — confirm pass**

Run: `npm test`
Expected: 22 passed (21 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/vietnamese.ts lib/admin/__tests__/ai-analysis-strings.test.ts
git commit -m "feat(i18n): add Vietnamese strings for AI analysis board"
```

---

### Task AI-003: Data aggregation service

**Files:**
- Create: `lib/admin/services/ai-analysis.ts`
- Create: `lib/admin/__tests__/ai-analysis.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/admin/__tests__/ai-analysis.test.ts`:

```typescript
import {
  aggregateForGemini,
  buildGeminiPrompt,
  stripMarkdownWrapper,
  type MonthlyRow,
} from '@/lib/admin/services/ai-analysis'

describe('aggregateForGemini', () => {
  const salesRows: MonthlyRow[] = [
    { year: 2024, month: 1, value: 1_000_000_000 },
    { year: 2025, month: 1, value: 1_500_000_000 },
  ]
  const purchaseRows: MonthlyRow[] = [
    { year: 2024, month: 1, value: 500_000_000 },
  ]

  it('builds compact payload with sales and purchases', () => {
    const result = aggregateForGemini(salesRows, purchaseRows, '2026-04-12')
    expect(result.sales_by_month).toHaveLength(2)
    expect(result.purchases_by_month).toHaveLength(1)
    expect(result.current_date).toBe('2026-04-12')
    expect(result.current_month_complete).toBe(false)
  })

  it('marks last day of month as complete', () => {
    const result = aggregateForGemini(salesRows, purchaseRows, '2025-01-31')
    expect(result.current_month_complete).toBe(true)
  })
})

describe('stripMarkdownWrapper', () => {
  it('strips backtick html wrapper', () => {
    const input = '```html\n<b>Hello</b>\n```'
    expect(stripMarkdownWrapper(input)).toBe('<b>Hello</b>')
  })

  it('returns plain HTML unchanged', () => {
    const input = '<b>Hello</b><ul><li>item</li></ul>'
    expect(stripMarkdownWrapper(input)).toBe(input)
  })

  it('strips backtick wrapper without language tag', () => {
    const input = '```\n<b>Hello</b>\n```'
    expect(stripMarkdownWrapper(input)).toBe('<b>Hello</b>')
  })
})

describe('buildGeminiPrompt', () => {
  it('returns system_instruction and user_message', () => {
    const payload = {
      sales_by_month: [{ year: 2025, month: 1, revenue: 1_000_000_000 }],
      purchases_by_month: [{ year: 2025, month: 1, receiving: 500_000_000, returns: 0 }],
      current_date: '2026-04-12',
      current_month_complete: false,
    }
    const prompt = buildGeminiPrompt(payload)
    expect(prompt.system_instruction).toContain('chuyên gia phân tích')
    expect(prompt.system_instruction).toContain('2026-04-12')
    expect(prompt.user_message).toContain('sales_by_month')
  })
})
```

- [ ] **Step 2: Run tests — confirm failure**

Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|ai-analysis)"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service**

Create `lib/admin/services/ai-analysis.ts`:

```typescript
export interface MonthlyRow {
  year: number
  month: number
  value: number
}

export interface GeminiPayload {
  sales_by_month: Array<{ year: number; month: number; revenue: number }>
  purchases_by_month: Array<{ year: number; month: number; receiving: number; returns: number }>
  current_date: string
  current_month_complete: boolean
}

export interface GeminiPrompt {
  system_instruction: string
  user_message: string
}

export function aggregateForGemini(
  salesRows: MonthlyRow[],
  purchaseRows: MonthlyRow[],
  currentDate: string
): GeminiPayload {
  const [yearStr, monthStr, dayStr] = currentDate.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const day = parseInt(dayStr)
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const current_month_complete = day >= lastDayOfMonth

  return {
    sales_by_month: salesRows.map(r => ({
      year: r.year,
      month: r.month,
      revenue: Math.round(r.value),
    })),
    purchases_by_month: purchaseRows.map(r => ({
      year: r.year,
      month: r.month,
      receiving: Math.round(r.value),
      returns: 0,
    })),
    current_date: currentDate,
    current_month_complete,
  }
}

export function stripMarkdownWrapper(html: string): string {
  return html.replace(/^```(?:html)?\n?([\s\S]*?)\n?```$/m, '$1').trim()
}

export function buildGeminiPrompt(payload: GeminiPayload): GeminiPrompt {
  const currentDay = payload.current_date.split('-')[2]

  const system_instruction = `Bạn là một chuyên gia phân tích và dự báo dữ liệu kinh doanh ngành thú y.

1. Nhiệm vụ của bạn:

  1. Phân tích Tổng quan:
    - So sánh tổng doanh số 2 năm gần nhất, tăng hay giảm bao nhiêu %.
    - So sánh doanh số năm hiện tại với cùng kỳ năm trước (tính đến tháng hiện tại).

  2. Phân tích Xu hướng:
    - Phân tích doanh số bán hàng theo tháng trong 2 năm gần nhất.
    - Xác định xu hướng tăng trưởng hay giảm sút.

  3. Ước tính Doanh số 3 tháng tiếp theo:
    - Dựa trên công thức trung bình động của 6 tháng gần nhất, xu hướng hiện tại và các yếu tố mùa vụ.
    - Đưa ra khoảng ước tính (min - max).

  4. Đánh giá, Nhận xét:
    - Đưa ra nhận xét về hiệu suất bán hàng tổng thể trong năm gần nhất.
    - Đề xuất các điểm cần chú ý.

2. Câu trả lời của bạn:
  - Trả lời ngắn gọn, súc tích, dễ hiểu.
  - Có định dạng bằng HTML cơ bản (dùng <b>, <ul>, <li>, <p>).
  - KHÔNG bao bọc trong markdown code block. Trả về HTML thuần túy.
  - KHÔNG dùng <h1>-<h6>, <table>, <div>, hoặc bất kỳ CSS inline nào.

3. Lưu ý quan trọng:
  - Tất cả giá trị tiền tệ theo định dạng VNĐ (ví dụ: 1.234.567.890 VNĐ).
  - Thời gian hiện tại là ${payload.current_date}.
  - Dữ liệu tháng hiện tại chưa đủ, chỉ tính đến ngày ${currentDay} của tháng.`

  const user_message = `Dữ liệu để phân tích:\n${JSON.stringify(payload)}`

  return { system_instruction, user_message }
}
```

- [ ] **Step 4: Run tests — confirm pass**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/admin/services/ai-analysis.ts lib/admin/__tests__/ai-analysis.test.ts
git commit -m "feat(ai): add data aggregation service with Gemini prompt builder"
```

---

### Task AI-004: Create /api/ai-analysis API route

**Files:**
- Create: `app/api/ai-analysis/route.ts`
- Create: `app/api/ai-analysis/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/api/ai-analysis/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/ai-analysis/route'
import { NextRequest } from 'next/server'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockCreateServiceClient = vi.mocked(createServiceClient)

function makeRequest() {
  return new NextRequest('http://localhost/api/ai-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

describe('POST /api/ai-analysis', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('returns HTML from Gemini on success', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc } as never)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '<b>Analysis</b>' }] } }]
      }),
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { html: string }
    expect(body.html).toContain('<b>Analysis</b>')
  })

  it('strips markdown wrapper from Gemini response', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc } as never)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '```html\n<b>Wrapped</b>\n```' }] } }]
      }),
    })
    const res = await POST(makeRequest())
    const body = await res.json() as { html: string }
    expect(body.html).toBe('<b>Wrapped</b>')
    expect(body.html).not.toContain('```')
  })

  it('returns 500 when Gemini API fails', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'user-1' } as never)
    const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null })
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc } as never)
    mockFetch.mockResolvedValue({ ok: false, status: 429 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run test — confirm failure**

Run: `npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|ai-analysis/route)"`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the API route**

Create `app/api/ai-analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  aggregateForGemini,
  buildGeminiPrompt,
  stripMarkdownWrapper,
  type MonthlyRow,
} from '@/lib/admin/services/ai-analysis'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const db = createServiceClient()

    // Always query ALL data — no NPP or category filters for AI analysis
    const [salesResult, purchaseResult] = await Promise.all([
      db.rpc('dashboard_door_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '', p_kenh: '' }),
      db.rpc('dashboard_dpur_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '' }),
    ])

    const salesRows: MonthlyRow[] = (salesResult.data ?? []).map(
      (r: { year: number; month: number; ban_hang: number }) => ({
        year: r.year, month: r.month, value: r.ban_hang ?? 0,
      })
    )

    const purchaseRows: MonthlyRow[] = (purchaseResult.data ?? []).map(
      (r: { year: number; month: number; nhap_hang: number }) => ({
        year: r.year, month: r.month, value: r.nhap_hang ?? 0,
      })
    )

    const currentDate = new Date().toISOString().slice(0, 10)
    const payload = aggregateForGemini(salesRows, purchaseRows, currentDate)
    const { system_instruction, user_message } = buildGeminiPrompt(payload)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system_instruction }] },
        contents: [{ role: 'user', parts: [{ text: user_message }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!geminiRes.ok) {
      console.error('[ai-analysis] Gemini API error:', geminiRes.status)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const rawHtml = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const html = stripMarkdownWrapper(rawHtml)

    return NextResponse.json({ html })
  } catch (err) {
    console.error('[ai-analysis] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — confirm pass**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/api/ai-analysis/route.ts app/api/ai-analysis/__tests__/route.test.ts
git commit -m "feat(ai): add /api/ai-analysis route with Gemini proxy and auth guard"
```

## BATCH 2: Frontend Component

### Task AI-005: AIAnalysisBoard component

**Files:**
- Create: `components/admin/AIAnalysisBoard.tsx`
- Create: `tests/performance/ai-analysis.spec.ts`

- [ ] **Step 1: Write failing Playwright test**

Create `tests/performance/ai-analysis.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('AIAnalysisBoard — loading states', () => {
  test('board appears immediately with waiting state', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await new Promise(r => setTimeout(r, 30_000))
    })
    await page.goto('/admin/dashboard')
    await expect(page.locator('[data-testid="ai-analysis-board"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible({ timeout: 3000 })
  })

  test('no AI API call before 10 seconds', async ({ page }) => {
    let apiCallCount = 0
    await page.route('/api/ai-analysis', async route => {
      apiCallCount++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: '' }) })
    })
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(8_000)
    expect(apiCallCount).toBe(0)
  })

  test('no countdown or timer text visible', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await new Promise(r => setTimeout(r, 30_000))
    })
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(3_000)
    const boardText = await page.locator('[data-testid="ai-analysis-board"]').innerText()
    expect(boardText).not.toMatch(/\d+\s*(giây|seconds)/)
    expect(boardText).not.toMatch(/\d{1,2}:\d{2}/)
  })
})
```

- [ ] **Step 2: Run Playwright test — confirm failure**

Run: `npx playwright test tests/performance/ai-analysis.spec.ts --headed=false 2>&1 | tail -20`
Expected: FAIL — AIAnalysisBoard not found

- [ ] **Step 3: Implement the component**

Create `components/admin/AIAnalysisBoard.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { VI } from '@/lib/i18n/vietnamese'
import type { DashboardFilters } from '@/lib/admin/services/dashboard'

type AIBoardStatus = 'waiting' | 'loading' | 'ready' | 'error'

interface Props {
  committedFilters: DashboardFilters
}

const ALLOWED_TAGS = ['b', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br']

export function AIAnalysisBoard({ committedFilters }: Props) {
  const [status, setStatus] = useState<AIBoardStatus>('waiting')
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cache] = useState(() => new Map<string, string>())

  const filtersRef = useRef(committedFilters)
  useEffect(() => { filtersRef.current = committedFilters }, [committedFilters])

  const fetchAI = useCallback(async (filters: DashboardFilters) => {
    setStatus('loading')
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { html } = await res.json() as { html: string }
      const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
      cache.set(JSON.stringify(filters), clean)
      setHtmlContent(clean)
      setStatus('ready')
      setGateOpen(true)
    } catch {
      setStatus('error')
    }
  }, [cache])

  // One-shot 10s timer on mount — does NOT restart on filter changes
  useEffect(() => {
    const cacheKey = JSON.stringify(filtersRef.current)
    if (cache.has(cacheKey)) {
      setHtmlContent(cache.get(cacheKey)!)
      setStatus('ready')
      setGateOpen(true)
      return
    }
    setStatus('waiting')
    const timer = setTimeout(() => { void fetchAI(filtersRef.current) }, 10_000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After gate opens: immediate re-fetch on filter change
  useEffect(() => {
    if (!gateOpen) return
    const cacheKey = JSON.stringify(committedFilters)
    if (cache.has(cacheKey)) {
      setHtmlContent(cache.get(cacheKey)!)
      setStatus('ready')
      return
    }
    void fetchAI(committedFilters)
  }, [committedFilters, gateOpen, cache, fetchAI])

  return (
    <div
      data-testid="ai-analysis-board"
      className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-lg overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-amber-800 text-sm">{VI.aiAnalysis.title}</span>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label={collapsed ? 'Mo rong' : 'Thu gon'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          {status === 'waiting' && (
            <div data-testid="ai-analysis-status-waiting" className="flex items-center gap-2 text-amber-700 text-sm py-2">
              <span className="animate-pulse">{VI.aiAnalysis.waiting}</span>
            </div>
          )}
          {status === 'loading' && (
            <div data-testid="ai-analysis-status-loading" className="flex items-center gap-2 text-amber-700 text-sm py-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>{VI.aiAnalysis.loading}</span>
            </div>
          )}
          {status === 'ready' && htmlContent && (
            <div
              data-testid="ai-analysis-status-ready"
              className="text-sm text-gray-800 space-y-1"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
          {status === 'error' && (
            <div data-testid="ai-analysis-status-error" className="flex items-center gap-3 text-sm py-2">
              <span className="text-red-600">{VI.aiAnalysis.error}</span>
              <button
                onClick={() => { void fetchAI(filtersRef.current) }}
                className="text-amber-700 underline hover:text-amber-900 font-medium"
              >
                {VI.aiAnalysis.retry}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

NOTE: The dangerouslySetInnerHTML prop is safe here because:
1. The HTML comes from isomorphic-dompurify which sanitizes it with a strict allowlist
2. No user-provided content is rendered — only AI-generated content that was sanitized server-side
3. ALLOWED_TAGS restricts to: b, strong, em, ul, ol, li, p, br (no script, no iframe, no event handlers)

- [ ] **Step 4: Run Playwright tests — confirm pass**

Run: `npx playwright test tests/performance/ai-analysis.spec.ts --headed=false 2>&1 | tail -30`
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/admin/AIAnalysisBoard.tsx tests/performance/ai-analysis.spec.ts
git commit -m "feat(ai): add AIAnalysisBoard component with 10s gate, state machine, DOMPurify"
```

## BATCH 3: Dashboard Integration + Full Flow Tests

### Task AI-006: Wire AIAnalysisBoard into DashboardClient

**Files:**
- Modify: `app/admin/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add import to DashboardClient.tsx**

Add to the imports section at the top of the file:

```typescript
import { AIAnalysisBoard } from '@/components/admin/AIAnalysisBoard'
```

- [ ] **Step 2: Insert component after filter bar closing tag**

Find the section in DashboardClient.tsx where the filter bar ends and Tong Quan section begins.
Add the AIAnalysisBoard between them:

```typescript
      {/* AI Analysis Board */}
      <AIAnalysisBoard committedFilters={committedFilters} />

      {/* Tong Quan section starts here */}
```

- [ ] **Step 3: Run unit tests — confirm no regressions**

Run: `npm test`
Expected: all existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add app/admin/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): insert AIAnalysisBoard after filter bar"
```

---

### Task AI-007: Full flow and edge case Playwright tests

**Files:**
- Modify: `tests/performance/ai-analysis.spec.ts`

- [ ] **Step 1: Append full flow tests to the spec file**

Add these test blocks to `tests/performance/ai-analysis.spec.ts`:

```typescript
test.describe('AIAnalysisBoard — full flow', () => {
  test('API call fires after 10s and HTML renders with content', async ({ page }) => {
    let apiCallCount = 0
    await page.route('/api/ai-analysis', async route => {
      apiCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          html: '<b>1. Phan tich Tong quan:</b><ul><li>Result</li></ul><b>4. Danh gia:</b><p>Summary</p>'
        }),
      })
    })
    await page.goto('/admin/dashboard')
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible()
    expect(apiCallCount).toBe(0)
    await page.waitForSelector('[data-testid="ai-analysis-status-ready"]', { timeout: 15_000 })
    expect(apiCallCount).toBe(1)
    const html = await page.locator('[data-testid="ai-analysis-status-ready"]').innerHTML()
    expect(html).toContain('Phan tich Tong quan')
  })

  test('navigating away before 10s = zero API calls', async ({ page }) => {
    let apiCallCount = 0
    await page.route('/api/ai-analysis', async route => {
      apiCallCount++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: '' }) })
    })
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(3_000)
    await page.goto('/admin/nhap-hang')
    await page.waitForTimeout(8_000)
    expect(apiCallCount).toBe(0)
  })

  test('collapse toggle hides board content', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await new Promise(r => setTimeout(r, 30_000))
    })
    await page.goto('/admin/dashboard')
    await page.waitForSelector('[data-testid="ai-analysis-status-waiting"]', { timeout: 3000 })
    await page.locator('[data-testid="ai-analysis-board"] button[aria-label]').click()
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).not.toBeVisible()
  })

  test('error state shows Vietnamese error and retry button', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await route.fulfill({ status: 500, body: 'Server Error' })
    })
    await page.goto('/admin/dashboard')
    await page.waitForSelector('[data-testid="ai-analysis-status-error"]', { timeout: 15_000 })
    const text = await page.locator('[data-testid="ai-analysis-status-error"]').innerText()
    expect(text).toContain('Khong the tai phan tich AI')
    expect(text).toContain('Thu lai')
  })
})
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test:all 2>&1 | tail -30`
Expected: all unit tests and Playwright tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/performance/ai-analysis.spec.ts
git commit -m "test(ai): add full E2E Playwright tests for AI analysis board"
```

## BATCH 4: Security Verification + Build

### Task AI-008: Security check and environment setup

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add GEMINI_API_KEY to .env.local**

Append to `.env.local`:

```
# Gemini AI Analysis (server-side only — never use NEXT_PUBLIC_ prefix)
GEMINI_API_KEY=AIzaSyDLnikXhA9vXiXWZmCx60_00k5Njn-PLo8
```

- [ ] **Step 2: Verify key has no NEXT_PUBLIC prefix anywhere**

Run: `grep -r "NEXT_PUBLIC_GEMINI" . --include="*.ts" --include="*.tsx" 2>/dev/null`
Expected: zero matches

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build 2>&1 | tail -20`
Expected: build completes without errors

- [ ] **Step 4: Verify key not in client bundles**

Run: `grep -r "AIzaSyDLnikXhA9vXiXWZmCx60_00k5Njn-PLo8" .next --include="*.js" 2>/dev/null | wc -l`
Expected: 0

- [ ] **Step 5: Run final complete test suite**

Run: `npm run test:all 2>&1 | tail -20`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore(ai): configure GEMINI_API_KEY, verify security and build"
```

---

## Success Criteria

- [ ] Board appears immediately in waiting state on page load
- [ ] Zero API calls before 10s (Playwright verified)
- [ ] Filter changes during 10s do NOT reset timer
- [ ] Navigate away before 10s = zero API calls
- [ ] HTML renders with analysis sections
- [ ] DOMPurify sanitization applied before innerHTML
- [ ] GEMINI_API_KEY not in any client bundle
- [ ] After gate opens: filter changes trigger immediate re-fetch
- [ ] Collapse toggle works
- [ ] Error state shows Vietnamese message + retry
- [ ] All unit tests pass
- [ ] All Playwright tests pass
- [ ] Build succeeds
- [ ] Database: zero writes, zero schema changes
