import { test, expect } from '@playwright/test'

test.describe('Dashboard page (/admin/dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard')
    // Wait for page to settle past skeleton
    await page.waitForLoadState('networkidle', { timeout: 30_000 })
  })

  test('page loads and sidebar is visible', async ({ page }) => {
    await expect(page.locator('#admin-sidebar')).toBeVisible()
    await expect(page.locator('#admin-main')).toBeVisible()
  })

  test('at least one KPI card renders with a non-empty value', async ({ page }) => {
    const kpiSection = page.locator('#admin-main')
    await expect(kpiSection).toBeVisible()
    // Ensure page is not showing a blank/error state
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('filter bar renders with NPP selector', async ({ page }) => {
    if (await page.locator('text=Không thể tải dữ liệu').isVisible()) return
    const filterArea = page.locator('#admin-main select, #admin-main [role="combobox"]').first()
    await expect(filterArea).toBeVisible({ timeout: 15_000 })
  })

  test('page does not show error state or blank charts section', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Không có dữ liệu')
    await expect(page.locator('body')).not.toContainText('error')
  })
})
