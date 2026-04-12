import { test, expect } from '@playwright/test'

test.describe('Forecast chart — visual verification', () => {
  test('dashboard loads and forecast chart section is visible', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })

    // Wait for the Tổng quan section heading
    await expect(
      page.locator('text=Nhập xuất theo tháng').first()
    ).toBeVisible({ timeout: 20_000 })

    // Take screenshot of the full page for visual inspection
    await page.screenshot({
      path: 'tests/.screenshots/forecast-after.png',
      fullPage: true,
    })

    // Verify the chart container rendered (not crashed)
    const chartContainer = page.locator('.recharts-responsive-container').first()
    await expect(chartContainer).toBeVisible()

    console.log('[forecast-visual] ✅ Chart visible. Screenshot: tests/.screenshots/forecast-after.png')
  })
})
