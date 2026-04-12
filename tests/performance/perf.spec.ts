import { test, expect } from '@playwright/test'

// Pages to assert against performance thresholds
const PAGES = [
  { name: 'dashboard',         path: '/admin/dashboard',         selector: 'main' },
  { name: 'nhap-hang',         path: '/admin/nhap-hang',         selector: 'main' },
  { name: 'ton-kho',           path: '/admin/ton-kho',           selector: 'main' },
  { name: 'khach-hang',        path: '/admin/khach-hang',        selector: 'main' },
  { name: 'check-customers',   path: '/admin/check-customers',   selector: 'main' },
  { name: 'check-distributor', path: '/admin/check-distributor', selector: 'main' },
]

// ---------------------------------------------------------------------------
// Cold-cache assertions
// Each page load is a fresh navigation with no prior warm state.
// Threshold: time-to-first-content < 8000ms (conservative upper bound for CI).
// The design target is <2000ms cold for dashboard KPIs; 8000ms guards against
// complete regressions while remaining stable across CI environments.
// ---------------------------------------------------------------------------
test.describe('Performance Regression — cold cache', () => {
  test.slow()

  for (const pageConfig of PAGES) {
    test(`cold load: ${pageConfig.name} time-to-first-content < 8000ms`, async ({ page }) => {
      const navStart = Date.now()

      await page.goto(pageConfig.path, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(pageConfig.selector, { timeout: 30_000 })

      const timeToFirstContent_ms = Date.now() - navStart

      expect(
        timeToFirstContent_ms,
        `${pageConfig.name}: expected time-to-first-content < 8000ms, got ${timeToFirstContent_ms}ms`,
      ).toBeLessThan(8_000)
    })
  }
})

// ---------------------------------------------------------------------------
// Dashboard API call count assertion
// After optimization the dashboard must issue ≤ 6 /api/admin/** requests per
// page load (down from the pre-optimization 14 concurrent calls).
// ---------------------------------------------------------------------------
test.describe('Performance Regression — dashboard API call count', () => {
  test.slow()

  test('dashboard: API calls ≤ 6', async ({ page }) => {
    let apiCallCount = 0

    await page.route('/api/admin/**', async (route) => {
      apiCallCount++
      await route.continue()
    })

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('main', { timeout: 30_000 })

    // Allow in-flight requests to settle before asserting
    await page.waitForTimeout(500)

    expect(
      apiCallCount,
      `dashboard: expected ≤ 6 API calls, got ${apiCallCount}`,
    ).toBeLessThanOrEqual(6)
  })
})

// ---------------------------------------------------------------------------
// Warm-cache assertions
// Each page is visited TWICE. The second navigation exercises browser and
// server-side caches. Threshold: < 2000ms time-to-first-content.
// Note: true sub-500ms warm cache requires Redis/unstable_cache in production;
// 2000ms is the conservative CI-safe threshold.
// ---------------------------------------------------------------------------
test.describe('Performance Regression — warm cache', () => {
  test.slow()

  for (const pageConfig of PAGES) {
    test(`warm load: ${pageConfig.name} time-to-first-content < 2000ms`, async ({ page }) => {
      // First pass — primes any server-side and browser caches
      await page.goto(pageConfig.path, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(pageConfig.selector, { timeout: 30_000 })

      // Second pass — the one we assert against
      const navStart = Date.now()
      await page.goto(pageConfig.path, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(pageConfig.selector, { timeout: 30_000 })
      const timeToFirstContent_ms = Date.now() - navStart

      expect(
        timeToFirstContent_ms,
        `${pageConfig.name} (warm): expected time-to-first-content < 2000ms, got ${timeToFirstContent_ms}ms`,
      ).toBeLessThan(2_000)
    })
  }
})
