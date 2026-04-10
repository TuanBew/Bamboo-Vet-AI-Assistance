import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeMovingAverageForecast, MonthlyDataPoint } from '../forecast'

// ---------------------------------------------------------------------------
// Helper to build a month series
// ---------------------------------------------------------------------------

function makeMonth(year: number, month: number, value: number): MonthlyDataPoint {
  return { year, month, value }
}

// ---------------------------------------------------------------------------
// Tests: basic structure
// ---------------------------------------------------------------------------

describe('computeMovingAverageForecast', () => {
  // Pin "now" to 2026-04 so tests are deterministic
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array when given no data', () => {
    expect(computeMovingAverageForecast([])).toHaveLength(0)
  })

  it('returns only real points (no forecast) when < 2 complete data points', () => {
    const data = [makeMonth(2026, 3, 100)]
    const result = computeMovingAverageForecast(data)
    expect(result.filter(d => d.is_forecast)).toHaveLength(0)
    expect(result).toHaveLength(1)
    expect(result[0].is_forecast).toBe(false)
  })

  it('marks all real points as is_forecast: false', () => {
    const data = [
      makeMonth(2025, 10, 80),
      makeMonth(2025, 11, 90),
      makeMonth(2025, 12, 100),
      makeMonth(2026, 1, 95),
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
    ]
    const result = computeMovingAverageForecast(data)
    result.filter(d => !d.is_forecast).forEach(p => expect(p.is_forecast).toBe(false))
  })

  it('marks all forecast points as is_forecast: true', () => {
    const data = [
      makeMonth(2025, 10, 80),
      makeMonth(2025, 11, 90),
      makeMonth(2025, 12, 100),
      makeMonth(2026, 1, 95),
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
    ]
    const result = computeMovingAverageForecast(data)
    result.filter(d => d.is_forecast).forEach(p => expect(p.is_forecast).toBe(true))
  })

  // ---------------------------------------------------------------------------
  // Tests: current month exclusion
  // ---------------------------------------------------------------------------

  it('excludes current month (April 2026) from WMA window', () => {
    // April 2026 is "now" (fake timer) — it should be excluded from calculation
    const dataWithCurrentMonth = [
      makeMonth(2025, 10, 80),
      makeMonth(2025, 11, 90),
      makeMonth(2025, 12, 100),
      makeMonth(2026, 1, 95),
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
      makeMonth(2026, 4, 999), // current month — must not influence forecast
    ]
    const dataWithout = [
      makeMonth(2025, 10, 80),
      makeMonth(2025, 11, 90),
      makeMonth(2025, 12, 100),
      makeMonth(2026, 1, 95),
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
    ]
    const withCurrent = computeMovingAverageForecast(dataWithCurrentMonth)
    const without = computeMovingAverageForecast(dataWithout)

    const forecastWith = withCurrent.filter(d => d.is_forecast)
    const forecastWithout = without.filter(d => d.is_forecast)

    // Forecast values should be identical — current month is excluded from WMA
    forecastWith.forEach((fp, i) => {
      expect(fp.value).toBe(forecastWithout[i].value)
    })
  })

  // ---------------------------------------------------------------------------
  // Tests: forecast extent (to December of last data year)
  // ---------------------------------------------------------------------------

  it('forecasts from last complete month + 1 through December of that year', () => {
    // Last complete data: March 2026 → should forecast April–December 2026 (9 months)
    const data = [
      makeMonth(2025, 10, 80),
      makeMonth(2025, 11, 90),
      makeMonth(2025, 12, 100),
      makeMonth(2026, 1, 95),
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)

    // March 2026 is last → forecast Apr, May, …, Dec 2026 = 9 months
    expect(forecasted).toHaveLength(9)
    expect(forecasted[0]).toMatchObject({ year: 2026, month: 4 })
    expect(forecasted[forecasted.length - 1]).toMatchObject({ year: 2026, month: 12 })
  })

  it('generates no forecast when last data point is December', () => {
    const data = [
      makeMonth(2025, 7, 80),
      makeMonth(2025, 8, 90),
      makeMonth(2025, 9, 100),
      makeMonth(2025, 10, 95),
      makeMonth(2025, 11, 85),
      makeMonth(2025, 12, 88), // last point is December
    ]
    const result = computeMovingAverageForecast(data)
    expect(result.filter(d => d.is_forecast)).toHaveLength(0)
  })

  it('forecasts to December of the year containing the last data point', () => {
    // Data through November 2025 → forecast only December 2025
    const data = [
      makeMonth(2025, 6, 80),
      makeMonth(2025, 7, 90),
      makeMonth(2025, 8, 100),
      makeMonth(2025, 9, 95),
      makeMonth(2025, 10, 85),
      makeMonth(2025, 11, 88),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    expect(forecasted).toHaveLength(1)
    expect(forecasted[0]).toMatchObject({ year: 2025, month: 12 })
  })

  // ---------------------------------------------------------------------------
  // Tests: WMA produces a STABLE forecast (not trend-following)
  // ---------------------------------------------------------------------------

  it('WMA forecast value is stable (not extrapolating trend)', () => {
    // Strongly increasing data — WMA should NOT keep increasing into forecasts
    const data = [
      makeMonth(2025, 10, 100),
      makeMonth(2025, 11, 200),
      makeMonth(2025, 12, 300),
      makeMonth(2026, 1, 400),
      makeMonth(2026, 2, 500),
      makeMonth(2026, 3, 600),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)

    // All forecast months must have the same value (stable WMA)
    const allSameValue = forecasted.every(f => f.value === forecasted[0].value)
    expect(allSameValue).toBe(true)

    // Forecast value should be less than the last real value (WMA averages, not extrapolates)
    expect(forecasted[0].value).toBeLessThan(600)
  })

  it('WMA forecast is a weighted average — heavier weight on recent months', () => {
    // 6 months: weights 1,2,3,4,5,6 → WMA = (100+2*100+3*200+4*200+5*200+6*300) / 21
    // = (100 + 200 + 600 + 800 + 1000 + 1800) / 21 = 4500 / 21 ≈ 214
    const data = [
      makeMonth(2025, 10, 100),
      makeMonth(2025, 11, 100),
      makeMonth(2025, 12, 200),
      makeMonth(2026, 1, 200),
      makeMonth(2026, 2, 200),
      makeMonth(2026, 3, 300),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    // Expected WMA: (1*100+2*100+3*200+4*200+5*200+6*300) / 21 = 4500/21 ≈ 214
    expect(forecasted[0].value).toBe(Math.round(4500 / 21))
  })

  it('forecast value is never negative', () => {
    const data = [
      makeMonth(2025, 10, 0),
      makeMonth(2025, 11, 0),
      makeMonth(2025, 12, 0),
      makeMonth(2026, 1, 0),
      makeMonth(2026, 2, 0),
      makeMonth(2026, 3, 0),
    ]
    const result = computeMovingAverageForecast(data)
    result.filter(d => d.is_forecast).forEach(f => expect(f.value).toBeGreaterThanOrEqual(0))
  })

  // ---------------------------------------------------------------------------
  // Tests: sorting
  // ---------------------------------------------------------------------------

  it('handles unsorted input correctly', () => {
    const data = [
      makeMonth(2026, 3, 88),
      makeMonth(2025, 11, 90),
      makeMonth(2026, 1, 95),
      makeMonth(2025, 10, 80),
      makeMonth(2026, 2, 85),
      makeMonth(2025, 12, 100),
    ]
    const result = computeMovingAverageForecast(data)
    // Output should be sorted ascending
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1].year * 12 + result[i - 1].month
      const curr = result[i].year * 12 + result[i].month
      expect(curr).toBeGreaterThan(prev)
    }
  })
})
