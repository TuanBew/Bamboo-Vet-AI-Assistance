import { test, expect } from '@playwright/test'

// These tests check unauthenticated / non-admin behaviour.
// Override the global storageState so they run with a fresh session.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('AUTH-01: unauthenticated → /admin/* redirects to /login', () => {
  const adminRoutes = [
    '/admin/dashboard',
    '/admin/nhap-hang',
    '/admin/ton-kho',
    '/admin/khach-hang',
    '/admin/check-customers',
    '/admin/check-distributor',
    '/admin/settings',
  ]

  for (const route of adminRoutes) {
    test(`${route} → /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })
  }
})

test.describe('AUTH-04: /api/admin/* returns 401/403 without valid session', () => {
  const apiRoutes = [
    '/api/admin/dashboard',
    '/api/admin/nhap-hang',
    '/api/admin/ton-kho',
    '/api/admin/khach-hang',
    '/api/admin/check-customers',
    '/api/admin/check-distributor',
  ]

  for (const route of apiRoutes) {
    test(`${route} returns 4xx`, async ({ request }) => {
      const res = await request.get(`http://localhost:3001${route}`)
      expect([401, 403]).toContain(res.status())
    })
  }
})
