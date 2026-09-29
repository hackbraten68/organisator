import { test, expect } from '@playwright/test';

test.describe('portal shell', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('not found route shows 404', async ({ page }) => {
    await page.goto('/non-existent-route');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  // Accounts are sales data. Participants must not reach them through the portal.
  test.describe('routes removed from the participant portal', () => {
    for (const path of ['/register', '/search', '/test-chat', '/accounts/001']) {
      test(`${path} is not reachable`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBeLessThan(400);
        await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
      });
    }
  });

  test('login page has no sign up link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign up' })).toHaveCount(0);
    await expect(page.getByText("Don't have an account?")).toHaveCount(0);
  });
});
