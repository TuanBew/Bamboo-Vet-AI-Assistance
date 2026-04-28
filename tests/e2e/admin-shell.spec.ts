import { test, expect } from '@playwright/test'

// All tests run with admin auth (global storageState from playwright.config.ts)

test.describe('Admin shell — sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('domcontentloaded')
  })

  test('sidebar renders with #1a1f2e background', async ({ page }) => {
    const sidebar = page.locator('#admin-sidebar aside')
    await expect(sidebar).toBeVisible()
    const bg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor)
    // #1a1f2e = rgb(26, 31, 46)
    expect(bg).toBe('rgb(26, 31, 46)')
  })

  test('brand name "AI Bamboo" visible in sidebar', async ({ page }) => {
    await expect(page.locator('#admin-sidebar')).toContainText('AI Bamboo')
  })

  const navItems = [
    { label: 'Dashboard',          href: '/admin/dashboard' },
    { label: 'Nhập hàng',          href: '/admin/nhap-hang' },
    { label: 'Tồn kho',            href: '/admin/ton-kho' },
    { label: 'Khách hàng',         href: '/admin/khach-hang' },
    { label: 'Check Khách hàng',   href: '/admin/check-customers' },
    { label: 'Check NPP',          href: '/admin/check-distributor' },
    { label: 'Cài đặt',           href: '/admin/settings' },
  ]

  for (const item of navItems) {
    test(`nav item "${item.label}" renders and navigates`, async ({ page }) => {
      const link = page.locator(`#admin-sidebar a[href="${item.href}"]`)
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).toHaveURL(new RegExp(item.href.replace('/', '\\/')))
    })
  }
})

test.describe('Admin shell — topbar', () => {
  test('"Làm mới dữ liệu" button is visible', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.locator('#admin-topbar')).toContainText('Làm mới dữ liệu')
  })
})

test.describe('Admin shell — no hydration errors', () => {
  const pages = [
    '/admin/dashboard',
    '/admin/nhap-hang',
    '/admin/ton-kho',
    '/admin/khach-hang',
    '/admin/settings',
  ]

  for (const route of pages) {
    test(`${route} loads without console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const hydrationErrors = errors.filter(e =>
        e.toLowerCase().includes('hydrat') || e.toLowerCase().includes('minified react error')
      )
      expect(hydrationErrors).toHaveLength(0)
    })
  }
})
