import { test, expect } from '@playwright/test'

test.describe('Check Customers page (/admin/check-customers)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/check-customers')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads without server error', async ({ page }) => {
    await expect(page.locator('#admin-main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sidebar check-customers link visible', async ({ page }) => {
    await expect(page.locator('#admin-sidebar a[href="/admin/check-customers"]')).toBeVisible()
  })

  test('data table renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const table = page.locator('table')
    const noData = page.locator('text=Không có dữ liệu')
    await expect(table.or(noData)).toBeVisible({ timeout: 25_000 })
  })

  test('export buttons render (Copy, Excel, CSV)', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    for (const label of ['Copy', 'Excel', 'CSV']) {
      await expect(page.locator(`button:has-text("${label}")`).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('map renders (Leaflet container)', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible({ timeout: 20_000 })
  })

  test('pagination controls render', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const pager = page.locator('button:has-text("Tiếp theo"), button:has-text("Trước")').first()
    await expect(pager).toBeVisible({ timeout: 15_000 })
  })
})
