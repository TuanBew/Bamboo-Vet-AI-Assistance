/**
 * Simple Moving Average (SMA) forecast for dashboard monthly series.
 *
 * Design decisions:
 * - Excludes the current calendar month (data is not yet complete)
 * - Forecast range: currentMonth+1 through December of currentYear
 * - 2-month rolling SMA: Forecast(M) = (Value(M-1) + Value(M-2)) / 2
 * - Each forecasted value feeds into the next forecast (rolling forward)
 * - Values floored at 0 — no negative forecasts
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
 * Compute a 2-month rolling Simple Moving Average forecast from monthly data.
 *
 * @param data       - Monthly data points (any numeric series)
 * @param windowSize - SMA window size (default: 2)
 * @returns Sorted real points (is_forecast: false) followed by forecast points (is_forecast: true).
 *          Forecast starts at currentMonth+1 and extends to December of currentYear.
 */
export function computeMovingAverageForecast(
  data: MonthlyDataPoint[],
  windowSize: number = 2
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
    // Not enough complete data to compute a forecast.
    // Return all raw data (including the current incomplete month) so the chart
    // can still display whatever data exists, just without any forecast extension.
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  // Forecast range: skip current month entirely, start from next month
  // e.g. currentMonth=4 (April) → forecastStartMonth=5 (May), monthsToForecast=8 (May–Dec)
  const forecastStartMonth = currentMonth + 1
  const monthsToForecast = 12 - currentMonth

  if (monthsToForecast <= 0) {
    // Current month is December — nothing left to forecast this year
    return sorted.map(d => ({ ...d, is_forecast: false }))
  }

  // Seed the rolling window with the last `windowSize` complete months
  const slidingWindow = completeData.slice(-windowSize).map(d => d.value)

  const forecastPoints: ForecastPoint[] = []
  for (let i = 0; i < monthsToForecast; i++) {
    // SMA of the last windowSize values (actual or previously forecasted)
    const currentWindow = slidingWindow.slice(-windowSize)
    const forecastValue = Math.max(
      0,
      Math.round(currentWindow.reduce((sum, v) => sum + v, 0) / currentWindow.length)
    )

    // Convert (currentYear, forecastStartMonth + i) to (year, month)
    const totalMonths = currentYear * 12 + forecastStartMonth + i
    const fy = Math.floor((totalMonths - 1) / 12)
    const fm = ((totalMonths - 1) % 12) + 1

    forecastPoints.push({ year: fy, month: fm, value: forecastValue, is_forecast: true })
    slidingWindow.push(forecastValue) // roll forward: this forecast seeds the next iteration
  }

  return [
    ...sorted.map(d => ({ ...d, is_forecast: false })),
    ...forecastPoints,
  ]
}
