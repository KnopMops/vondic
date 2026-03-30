import { test, expect } from '@playwright/test'

test.describe('Error Pages', () => {
  test('404 page should show correct content', async ({ page }) => {
    // Navigate to a non-existent page
    const response = await page.goto('/some-non-existent-page')
    
    // Check status code (Note: Next.js dev server might return 200 for client-side navigation, 
    // but in production it should be 404. For e2e we check the content.)
    expect(response?.status()).toBe(404)
    
    await expect(page.getByText('404')).toBeVisible()
    await expect(page.getByText('Ой, потерялись?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Вернуться назад' })).toBeVisible()
  })

  test('502 page should show correct content', async ({ page }) => {
    const response = await page.goto('/502')
    expect(response?.status()).toBe(200) // It's a regular page route in our implementation
    
    await expect(page.getByText('502')).toBeVisible()
    await expect(page.getByText('Сервер спит...')).toBeVisible()
  })

  test('503 page should show correct content', async ({ page }) => {
    const response = await page.goto('/503')
    expect(response?.status()).toBe(200)
    
    await expect(page.getByText('503')).toBeVisible()
    await expect(page.getByText('Очередь за мороженым')).toBeVisible()
  })

  test('redirect timer should work', async ({ page }) => {
    test.setTimeout(15000) // 10s redirect + buffer
    await page.goto('/404')
    
    await expect(page.getByText('10')).toBeVisible()
    
    // Wait for redirect to home page
    await page.waitForURL('**/', { timeout: 12000 })
    expect(page.url()).toBe(process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000/')
  })
})
