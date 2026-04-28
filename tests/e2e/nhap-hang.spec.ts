import { test, expect } from '@playwright/test'

test.describe('Nhap Hang page (/admin/nhap-hang)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/nhap-hang')
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads without server error', async ({ page }) => {
    await expect(page.locator('#admin-main')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sidebar visible on nhap-hang page', async ({ page }) => {
    await expect(page.locator('#admin-sidebar')).toBeVisible()
    const activeLink = page.locator('#admin-sidebar a[href="/admin/nhap-hang"]')
    await expect(activeLink).toBeVisible()
  })

  test('data table renders with at least one row or no-data message', async ({ page }) => {
    // Either the table has rows OR it shows "Không có dữ liệu"
    const table = page.locator('table')
    const noData = page.locator('text=Không có dữ liệu')
    await expect(table.or(noData)).toBeVisible({ timeout: 20_000 })
  })

  test('export buttons present', async ({ page }) => {
    const exportButtons = ['Copy', 'Excel', 'CSV', 'PDF', 'Print']
    for (const label of exportButtons) {
      await expect(page.locator(`button:has-text("${label}")`).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('pagination controls render', async ({ page }) => {
    const prevBtn = page.locator('button:has-text("Trước")').or(page.locator('[aria-label="Previous page"]'))
    const nextBtn = page.locator('button:has-text("Tiếp theo")').or(page.locator('[aria-label="Next page"]'))
    await expect(prevBtn.first().or(nextBtn.first())).toBeVisible({ timeout: 15_000 })
  })
})
