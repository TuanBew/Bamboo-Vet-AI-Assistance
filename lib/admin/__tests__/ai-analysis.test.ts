import { describe, it, expect } from 'vitest'
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

  it('marks mid-month as incomplete', () => {
    const result = aggregateForGemini(salesRows, purchaseRows, '2025-01-15')
    expect(result.current_month_complete).toBe(false)
  })

  it('maps revenue values correctly', () => {
    const result = aggregateForGemini(salesRows, purchaseRows, '2026-04-12')
    expect(result.sales_by_month[0]).toEqual({ year: 2024, month: 1, revenue: 1_000_000_000 })
    expect(result.sales_by_month[1]).toEqual({ year: 2025, month: 1, revenue: 1_500_000_000 })
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
    expect(prompt.user_message).toContain('1000000000')
  })

  it('includes current day in system instruction', () => {
    const payload = {
      sales_by_month: [],
      purchases_by_month: [],
      current_date: '2026-04-12',
      current_month_complete: false,
    }
    const prompt = buildGeminiPrompt(payload)
    expect(prompt.system_instruction).toContain('12')
  })
})
