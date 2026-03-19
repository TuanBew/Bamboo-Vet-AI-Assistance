import { describe, it, expect } from 'vitest'
import { computeForecast, MonthlyDataPoint } from '../forecast'

describe('computeForecast', () => {
  it('produces 3 forecast months from 6 real months', () => {
    const data: MonthlyDataPoint[] = [
      { year: 2025, month: 7, query_count: 100, session_count: 25 },
      { year: 2025, month: 8, query_count: 120, session_count: 30 },
      { year: 2025, month: 9, query_count: 140, session_count: 35 },
      { year: 2025, month: 10, query_count: 160, session_count: 40 },
      { year: 2025, month: 11, query_count: 180, session_count: 45 },
      { year: 2025, month: 12, query_count: 200, session_count: 50 },
    ]
    const result = computeForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    expect(forecasted).toHaveLength(3)
    // All forecast points must have is_forecast: true
    forecasted.forEach(fp => expect(fp.is_forecast).toBe(true))
    // Real points must have is_forecast: false
    const real = result.filter(d => !d.is_forecast)
    expect(real).toHaveLength(6)
    real.forEach(rp => expect(rp.is_forecast).toBe(false))
  })

  it('sets is_forecast: true on all 3 forecast points', () => {
    const data: MonthlyDataPoint[] = [
      { year: 2025, month: 7, query_count: 100, session_count: 25 },
      { year: 2025, month: 8, query_count: 110, session_count: 28 },
      { year: 2025, month: 9, query_count: 120, session_count: 30 },
      { year: 2025, month: 10, query_count: 130, session_count: 33 },
      { year: 2025, month: 11, query_count: 140, session_count: 35 },
      { year: 2025, month: 12, query_count: 150, session_count: 38 },
    ]
    const result = computeForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    expect(forecasted.every(f => f.is_forecast === true)).toBe(true)
    // Forecast months should be 2026-01, 2026-02, 2026-03
    expect(forecasted[0]).toMatchObject({ year: 2026, month: 1 })
    expect(forecasted[1]).toMatchObject({ year: 2026, month: 2 })
    expect(forecasted[2]).toMatchObject({ year: 2026, month: 3 })
  })

  it('forecast values follow linear trend (increasing for increasing input)', () => {
    const data: MonthlyDataPoint[] = [
      { year: 2025, month: 7, query_count: 100, session_count: 25 },
      { year: 2025, month: 8, query_count: 120, session_count: 30 },
      { year: 2025, month: 9, query_count: 140, session_count: 35 },
      { year: 2025, month: 10, query_count: 160, session_count: 40 },
      { year: 2025, month: 11, query_count: 180, session_count: 45 },
      { year: 2025, month: 12, query_count: 200, session_count: 50 },
    ]
    const result = computeForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    // With a perfectly linear increasing trend, each forecast should be > last real
    expect(forecasted[0].query_count).toBeGreaterThan(200)
    // Each subsequent forecast should be >= previous
    expect(forecasted[1].query_count).toBeGreaterThanOrEqual(forecasted[0].query_count)
    expect(forecasted[2].query_count).toBeGreaterThanOrEqual(forecasted[1].query_count)
  })

  it('returns empty forecast array when < 2 data points', () => {
    const data: MonthlyDataPoint[] = [
      { year: 2025, month: 12, query_count: 100, session_count: 25 },
    ]
    const result = computeForecast(data)
    const forecasted = result.filter(d => d.is_forecast)
    expect(forecasted).toHaveLength(0)
    // The single real point should still be returned with is_forecast: false
    expect(result).toHaveLength(1)
    expect(result[0].is_forecast).toBe(false)
  })

  it('returns empty forecast array when 0 data points', () => {
    const result = computeForecast([])
    expect(result).toHaveLength(0)
  })
})
