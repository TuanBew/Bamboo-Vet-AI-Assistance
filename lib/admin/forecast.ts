/**
 * Weighted Moving Average (WMA) forecast for dashboard monthly series.
 *
 * Design decisions:
 * - Excludes the current calendar month (data is not yet complete)
 * - Uses the last `windowSize` complete months as the WMA window
 * - Forecasts from (last data month + 1) through December of the same year
 * - WMA gives more weight to recent months: weights [1, 2, …, n] (newest = n)
 * - If data already reaches December, no forecast is generated
 */

export interface MonthlyDataPoint {
  year: number
  month: number
  value: number
}

export interface ForecastPoint extends MonthlyDataPoint {
  is_forecast: boolean
}

/**
 * Compute a Weighted Moving Average forecast from monthly data.
 *
 * @param data - Monthly data points (any numeric series)
 * @param windowSize - Number of recent complete months used for WMA (default: 6)
 * @returns Sorted real points (is_forecast: false) followed by forecast points (is_forecast: true).
 *          Forecast extends to December of the year of the last data point.
 */
export function computeMovingAverageForecast(
  data: MonthlyDataPoint[],
  windowSize: number = 6
): ForecastPoint[] {
  if (data.length === 0) return []

  // Sort ascending by date
  const sorted = [...data].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  )

  // Exclude the current calendar month — its data is incomplete
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const completeData = sorted.filter(
    d => !(d.year === currentYear && d.month === currentMonth)
  )

  if (completeData.length < 2) {
    // Not enough complete data — return real points with no forecast
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  const lastPoint = completeData[completeData.length - 1]

  // Months to forecast: from lastPoint.month + 1 up to and including December
  const monthsToForecast = 12 - lastPoint.month
  if (monthsToForecast <= 0) {
    // Last data point is already December — nothing to forecast
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  // Weighted Moving Average over the last `windowSize` complete months.
  // Weight of position i (0-indexed, oldest first) = i + 1
  // → newest month gets weight n, oldest gets weight 1
  const window = completeData.slice(-windowSize)
  const n = window.length
  const weightSum = (n * (n + 1)) / 2 // 1 + 2 + … + n
  const forecastValue = Math.max(
    0,
    Math.round(
      window.reduce((sum, d, i) => sum + d.value * (i + 1), 0) / weightSum
    )
  )

  // Build forecast points: lastPoint + 1 month → December of lastPoint.year
  const forecastPoints: ForecastPoint[] = []
  for (let i = 1; i <= monthsToForecast; i++) {
    const totalMonths = lastPoint.year * 12 + lastPoint.month + i
    const fy = Math.floor((totalMonths - 1) / 12)
    const fm = ((totalMonths - 1) % 12) + 1
    forecastPoints.push({ year: fy, month: fm, value: forecastValue, is_forecast: true })
  }

  return [
    ...sorted.map(d => ({ ...d, is_forecast: false })),
    ...forecastPoints,
  ]
}
