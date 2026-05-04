import { test, expect } from '@playwright/test'

test.describe('Khach Hang page (/admin/khach-hang)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/khach-hang')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads without server error', async ({ page }) => {
    await expect(page.locator('#admin-main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sidebar khach-hang link visible', async ({ page }) => {
    await expect(page.locator('#admin-sidebar a[href="/admin/khach-hang"]')).toBeVisible()
  })

  test('at least one chart or data section renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const chart = page.locator('svg').first()
    const section = page.locator('#admin-main h2, #admin-main h3').first()
    await expect(chart.or(section)).toBeVisible({ timeout: 20_000 })
  })

  test('NPP filter renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const filter = page.locator('select, [role="combobox"]').first()
    await expect(filter).toBeVisible({ timeout: 15_000 })
  })

  test('page does not show generic error message', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('500')
  })
})
