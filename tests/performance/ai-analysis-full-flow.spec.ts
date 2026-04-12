import { test, expect } from '@playwright/test'

test.describe('AIAnalysisBoard — full flow', () => {
  test('board transitions waiting → loading → ready after 10s gate', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ html: '<b>Phân tích hoàn tất</b>' }),
      })
    })

    await page.goto('/admin/dashboard')

    // Initially in waiting state
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible({ timeout: 5000 })

    // After 10s gate, should transition to ready (allow up to 15s)
    await expect(page.locator('[data-testid="ai-analysis-status-ready"]')).toBeVisible({ timeout: 15_000 })

    // Content should be sanitized HTML from API
    const boardText = await page.locator('[data-testid="ai-analysis-status-ready"]').innerText()
    expect(boardText).toContain('Phân tích hoàn tất')
  })

  test('navigate away before 10s cancels timer — zero API calls', async ({ page }) => {
    let apiCallCount = 0
    await page.route('/api/ai-analysis', async route => {
      apiCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ html: '<b>Done</b>' }),
      })
    })

    await page.goto('/admin/dashboard')
    // Board is mounted, timer is running
    await expect(page.locator('[data-testid="ai-analysis-board"]')).toBeVisible({ timeout: 5000 })

    // Navigate away after 4s (well before the 10s gate)
    await page.waitForTimeout(4_000)
    await page.goto('/admin/settings')

    // Wait past the 10s gate mark (total 12s from dashboard load)
    await page.waitForTimeout(8_000)

    // The timer was cancelled on unmount — no API calls should have been made
    expect(apiCallCount).toBe(0)
  })

  test('error state shown when API returns 500, retry button visible', async ({ page }) => {
    await page.route('/api/ai-analysis', async route => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' })
    })

    await page.goto('/admin/dashboard')

    // Wait for gate + error state
    await expect(page.locator('[data-testid="ai-analysis-status-error"]')).toBeVisible({ timeout: 15_000 })

    // Retry button should be present
    const retryButton = page.locator('[data-testid="ai-analysis-status-error"] button')
    await expect(retryButton).toBeVisible()
  })

  test('retry button triggers a new fetch and recovers to ready', async ({ page }) => {
    let callCount = 0
    await page.route('/api/ai-analysis', async route => {
      callCount++
      if (callCount === 1) {
        // First call: fail
        await route.fulfill({ status: 500, body: 'Internal Server Error' })
      } else {
        // Subsequent calls: succeed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ html: '<b>Khôi phục thành công</b>' }),
        })
      }
    })

    await page.goto('/admin/dashboard')

    // Wait for error state
    await expect(page.locator('[data-testid="ai-analysis-status-error"]')).toBeVisible({ timeout: 15_000 })

    // Click retry
    await page.locator('[data-testid="ai-analysis-status-error"] button').click()

    // Should recover to ready
    await expect(page.locator('[data-testid="ai-analysis-status-ready"]')).toBeVisible({ timeout: 10_000 })
    const text = await page.locator('[data-testid="ai-analysis-status-ready"]').innerText()
    expect(text).toContain('Khôi phục thành công')
    expect(callCount).toBe(2)
  })

  test('board can be collapsed and expanded via chevron button', async ({ page }) => {
    await page.route('/api/ai-analysis', async () => {
      await new Promise(() => {}) // Never resolves — keep in waiting state
    })

    await page.goto('/admin/dashboard')
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible({ timeout: 5000 })

    // Collapse the board
    await page.locator('[data-testid="ai-analysis-board"] button[aria-label="Thu gon"]').click()
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).not.toBeVisible()

    // Expand again
    await page.locator('[data-testid="ai-analysis-board"] button[aria-label="Mo rong"]').click()
    await expect(page.locator('[data-testid="ai-analysis-status-waiting"]')).toBeVisible()
  })
})
