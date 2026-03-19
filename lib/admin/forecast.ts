/**
 * Linear regression forecast utility for dashboard monthly series.
 * Runs server-side only — no 'use client' directive.
 */

export interface MonthlyDataPoint {
  year: number
  month: number
  query_count: number
  session_count: number
}

export interface ForecastPoint extends MonthlyDataPoint {
  is_forecast: boolean
}

/**
 * Computes a linear regression forecast from monthly data points.
 *
 * @param data - Array of monthly data points (will be sorted ascending by date)
 * @param forecastMonths - Number of months to forecast (default 3)
 * @returns Array of real points (is_forecast: false) followed by forecast points (is_forecast: true)
 */
export function computeForecast(
  data: MonthlyDataPoint[],
  forecastMonths: number = 3
): ForecastPoint[] {
  if (data.length === 0) return []

  // Sort by date ascending
  const sorted = [...data].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  )

  // Take last 6 data points for regression
  const recent = sorted.slice(-6)

  // Not enough data for regression — return real points only
  if (recent.length < 2) {
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  const n = recent.length

  // Linear regression: y = a + b*x where x = index (0 to n-1)
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    const x = i
    const y = recent[i].query_count
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  }

  const denominator = n * sumX2 - sumX * sumX
  const b = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0
  const a = (sumY - b * sumX) / n

  // Generate forecast points
  const lastPoint = sorted[sorted.length - 1]
  const forecastPoints: ForecastPoint[] = []

  for (let i = 1; i <= forecastMonths; i++) {
    // Compute next year/month with rollover
    const totalMonths = lastPoint.year * 12 + lastPoint.month + i
    const forecastYear = Math.floor((totalMonths - 1) / 12)
    const forecastMonth = ((totalMonths - 1) % 12) + 1

    // Predict using regression (x continues from last index)
    const predictedQueries = Math.max(0, Math.round(a + b * (n - 1 + i)))
    const predictedSessions = Math.round(predictedQueries * 0.25)

    forecastPoints.push({
      year: forecastYear,
      month: forecastMonth,
      query_count: predictedQueries,
      session_count: predictedSessions,
      is_forecast: true,
    })
  }

  return [
    ...sorted.map(d => ({ ...d, is_forecast: false })),
    ...forecastPoints,
  ]
}
