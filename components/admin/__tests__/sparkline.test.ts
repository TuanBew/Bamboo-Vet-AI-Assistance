import { describe, it, expect } from 'vitest'
import { computePolylinePoints } from '../SparklineChart'

describe('computePolylinePoints', () => {
  it('returns empty string for empty data', () => {
    expect(computePolylinePoints([], 100, 30)).toBe('')
  })

  it('returns single point for single data value', () => {
    const result = computePolylinePoints([5], 100, 30)
    expect(result).toMatch(/^[\d.]+,[\d.]+$/)
  })

  it('maps min value to bottom of viewBox (y = height)', () => {
    const result = computePolylinePoints([0, 10], 100, 30)
    const points = result.split(' ').map(p => p.split(',').map(Number))
    // min value (0) should be at y = height (30)
    expect(points[0][1]).toBeCloseTo(30, 1)
  })

  it('maps max value to top of viewBox (y = 0)', () => {
    const result = computePolylinePoints([0, 10], 100, 30)
    const points = result.split(' ').map(p => p.split(',').map(Number))
    // max value (10) should be at y = 0
    expect(points[1][1]).toBeCloseTo(0, 1)
  })

  it('handles all-zero data without dividing by zero', () => {
    const result = computePolylinePoints([0, 0, 0], 100, 30)
    expect(result).not.toBe('')
    expect(result).not.toContain('NaN')
  })
})
