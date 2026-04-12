import { test } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

// Pages to benchmark with their "first meaningful content" selectors
const PAGES = [
  { name: 'dashboard',         path: '/admin/dashboard',         selector: 'main' },
  { name: 'nhap-hang',         path: '/admin/nhap-hang',         selector: 'main' },
  { name: 'ton-kho',           path: '/admin/ton-kho',           selector: 'main' },
  { name: 'khach-hang',        path: '/admin/khach-hang',        selector: 'main' },
  { name: 'check-customers',   path: '/admin/check-customers',   selector: 'main' },
  { name: 'check-distributor', path: '/admin/check-distributor', selector: 'main' },
]

interface PageMetrics {
  name: string
  domContentLoaded_ms: number
  timeToFirstContent_ms: number
  apiCallCount: number
  apiTotalBytes: number
}

const results: PageMetrics[] = []

test.describe('Performance Baseline', () => {
  test.slow()

  for (const pageConfig of PAGES) {
    test(`capture baseline for ${pageConfig.name}`, async ({ page }) => {
      let apiCallCount = 0
      let apiTotalBytes = 0

      // Intercept all /api/admin/* requests — count them but let them through
      await page.route('/api/admin/**', async (route) => {
        apiCallCount++
        await route.continue()
      })

      // Listen to responses and accumulate body sizes
      page.on('response', async (response) => {
        const url = response.url()
        if (url.includes('/api/admin/')) {
          try {
            const body = await response.body()
            apiTotalBytes += body.length
          } catch {
            // Response may already be consumed or connection closed — skip
          }
        }
      })

      // Record wall-clock time before navigation to measure time-to-first-content
      const navStart = Date.now()

      // Navigate and wait only for DOMContentLoaded to keep baseline consistent
      await page.goto(pageConfig.path, { waitUntil: 'domcontentloaded' })

      // DOMContentLoaded timing from the browser's own Navigation Timing API
      const domContentLoaded_ms = await page.evaluate(() => {
        const t = performance.timing
        return t.domContentLoadedEventEnd - t.navigationStart
      })

      // Time until the first meaningful DOM node is visible
      await page.waitForSelector(pageConfig.selector, { timeout: 30_000 })
      const timeToFirstContent_ms = Date.now() - navStart

      // Small settle window so in-flight response listeners can finish
      await page.waitForTimeout(500)

      results.push({
        name: pageConfig.name,
        domContentLoaded_ms,
        timeToFirstContent_ms,
        apiCallCount,
        apiTotalBytes,
      })
    })
  }

  test.afterAll(() => {
    const docsDir = path.resolve(process.cwd(), 'docs')
    mkdirSync(docsDir, { recursive: true })

    // ── JSON output ──────────────────────────────────────────────────────────
    const jsonPayload = {
      capturedAt: new Date().toISOString(),
      pages: results,
    }
    writeFileSync(
      path.join(docsDir, 'performance-baseline.json'),
      JSON.stringify(jsonPayload, null, 2),
      'utf-8',
    )

    // ── Markdown output ──────────────────────────────────────────────────────
    const header = [
      '# Performance Baseline',
      '',
      `> Captured at: ${jsonPayload.capturedAt}`,
      '',
      '| Page | DomContentLoaded (ms) | Time to First Content (ms) | API Calls | API Response Size (bytes) |',
      '|------|-----------------------|---------------------------|-----------|--------------------------|',
    ]

    const rows = results.map((r) =>
      `| ${r.name} | ${r.domContentLoaded_ms} | ${r.timeToFirstContent_ms} | ${r.apiCallCount} | ${r.apiTotalBytes} |`,
    )

    writeFileSync(
      path.join(docsDir, 'performance-baseline.md'),
      [...header, ...rows, ''].join('\n'),
      'utf-8',
    )
  })
})
