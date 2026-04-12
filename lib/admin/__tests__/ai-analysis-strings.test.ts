import { describe, it, expect } from 'vitest'
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
