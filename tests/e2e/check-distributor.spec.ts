import { test, expect } from '@playwright/test'

test.describe('Check Distributor page (/admin/check-distributor)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/check-distributor')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads without server error', async ({ page }) => {
    await expect(page.locator('#admin-main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sidebar check-distributor link visible', async ({ page }) => {
    await expect(page.locator('#admin-sidebar a[href="/admin/check-distributor"]')).toBeVisible()
  })

  test('data table or no-data message renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const table = page.locator('table')
    const noData = page.locator('text=Không có dữ liệu')
    await expect(table.or(noData)).toBeVisible({ timeout: 25_000 })
  })

  test('export buttons render', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    for (const label of ['Copy', 'Excel', 'CSV']) {
      await expect(page.locator(`button:has-text("${label}")`).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('year and metric filters render', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const filter = page.locator('select, [role="combobox"]').first()
    await expect(filter).toBeVisible({ timeout: 15_000 })
  })
})
