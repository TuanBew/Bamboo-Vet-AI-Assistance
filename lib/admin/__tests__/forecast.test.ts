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

  it('forecasts from currentMonth+1 (May) through December — 8 months', () => {
    // Current month is April 2026 → forecast May through December = 8 months
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

    // April is current month → skipped. Forecast: May (5) through December (12) = 8 months
    expect(forecasted).toHaveLength(8)
    expect(forecasted[0]).toMatchObject({ year: 2026, month: 5 })
    expect(forecasted[forecasted.length - 1]).toMatchObject({ year: 2026, month: 12 })
  })

  it('generates no forecast when current month is December', () => {
    vi.setSystemTime(new Date('2026-12-15'))
    const data = [
      makeMonth(2026, 9, 80),
      makeMonth(2026, 10, 90),
      makeMonth(2026, 11, 100),
    ]
    const result = computeMovingAverageForecast(data)
    expect(result.filter(d => d.is_forecast)).toHaveLength(0)
  })

  it('April (current month) stays as real data — forecast starts from May', () => {
    const data = [
      makeMonth(2026, 2, 85),
      makeMonth(2026, 3, 88),
      makeMonth(2026, 4, 50), // partial April data from DB
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)

    // No forecast point for April
    expect(forecasted.some(f => f.year === 2026 && f.month === 4)).toBe(false)

    // April appears as real data (is_forecast: false)
    const aprilReal = result.find(d => d.year === 2026 && d.month === 4 && !d.is_forecast)
    expect(aprilReal).toBeDefined()
    expect(aprilReal!.value).toBe(50)

    // Forecast starts at May
    expect(forecasted[0]).toMatchObject({ year: 2026, month: 5 })
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

  // SMA rolling behaviour
  it('2-month SMA: May forecast = Math.round((Feb + Mar) / 2)', () => {
    const data = [
      makeMonth(2026, 2, 70),
      makeMonth(2026, 3, 85),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    // May = (70 + 85) / 2 = 77.5 → Math.round → 78
    expect(forecasted[0]).toMatchObject({ year: 2026, month: 5, value: 78 })
  })

  it('rolls forward: Jun uses [Mar_actual, May_forecast], not [Feb, Mar] repeated', () => {
    const data = [
      makeMonth(2026, 2, 70),
      makeMonth(2026, 3, 85),
    ]
    const result = computeMovingAverageForecast(data)
    const forecasted = result.filter(d => d.is_forecast)

    const mayForecast = 78  // Math.round((70 + 85) / 2) = Math.round(77.5) = 78
    const junForecast = 82  // Math.round((85 + 78) / 2) = Math.round(81.5) = 82

    expect(forecasted[0]).toMatchObject({ month: 5, value: mayForecast })
    expect(forecasted[1]).toMatchObject({ month: 6, value: junForecast })

    // If NOT rolling (flat-line bug): Jun would also be 78 (same as May)
    // Rolling produces a different value: 82 ≠ 78
    expect(forecasted[1].value).not.toBe(mayForecast)
  })

})
