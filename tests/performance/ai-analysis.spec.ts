import { test, expect } from '@playwright/test'

test.describe('AIAnalysisBoard — loading states', () => {
  test('board appears immediately with waiting state', async ({ page }) => {
    // Intercept to keep board in waiting state (never resolve)
    await page.route('/api/ai-analysis', async () => {
      await new Promise(() => {}) // Never resolves
    })
    await page.goto('/admin/dashboard')
    await expect(page.locator('[data-testid="ai-analysis-board"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible({ timeout: 5000 })
  })

  test('no AI API call before 10 seconds', async ({ page }) => {
    let apiCallCount = 0
    await page.route('/api/ai-analysis', async route => {
      apiCallCount++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ html: '<b>Done</b>' }) })
    })
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(8_000)
    expect(apiCallCount).toBe(0)
  })

  test('no countdown or timer text visible in board', async ({ page }) => {
    await page.route('/api/ai-analysis', async () => {
      await new Promise(() => {}) // Never resolves
    })
    await page.goto('/admin/dashboard')
    await page.waitForTimeout(3_000)
    const boardText = await page.locator('[data-testid="ai-analysis-board"]').innerText()
    expect(boardText).not.toMatch(/\d+\s*(giây|seconds)/)
    expect(boardText).not.toMatch(/\d{1,2}:\d{2}/)
  })
})
