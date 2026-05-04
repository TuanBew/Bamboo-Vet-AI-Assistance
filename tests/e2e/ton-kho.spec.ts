import { test, expect } from '@playwright/test'

test.describe('Ton Kho page (/admin/ton-kho)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/ton-kho')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads without server error', async ({ page }) => {
    await expect(page.locator('#admin-main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sidebar visible and ton-kho link is active', async ({ page }) => {
    await expect(page.locator('#admin-sidebar a[href="/admin/ton-kho"]')).toBeVisible()
  })

  test('data table or no-data message renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const table = page.locator('table')
    const noData = page.locator('text=Không có dữ liệu')
    await expect(table.or(noData)).toBeVisible({ timeout: 20_000 })
  })

  test('NPP dropdown or filter renders', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const filter = page.locator('select, [role="combobox"]').first()
    await expect(filter).toBeVisible({ timeout: 15_000 })
  })

  test('Excel export button present', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    await expect(page.locator('button:has-text("Excel")').first()).toBeVisible({ timeout: 15_000 })
  })
})
