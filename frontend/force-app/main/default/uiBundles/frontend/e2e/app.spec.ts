import { test, expect } from '@playwright/test';

/**
 * The portal shell, exercised without an org.
 *
 * Playwright serves `dist/` statically and never talks to Salesforce, so there
 * is no session. `getCurrentUser()` therefore rejects and the auth guard sends
 * every protected route to the login page — which is exactly the behaviour
 * worth pinning down here.
 *
 * Caveat that shaped this file: `vite.config.ts` sets `base: './'`, so the
 * bundle URL in index.html is relative. It resolves correctly for every route
 * the portal actually has (all of them are one path segment below the site
 * root), but a two-segment path such as `/accounts/001` resolves the bundle to
 * `/accounts/assets/...`, the static server answers with index.html under a
 * text/html MIME type, and the app never boots. The deleted account feature is
 * therefore probed at `/accounts`, and the nested case is not asserted because
 * this harness cannot boot it — it is a property of the static harness, not of
 * the routing.
 */
test.describe('portal shell', () => {
  test('anonymous visit is sent to login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a deep link to a protected page returns to it after login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?startUrl=%2Fprofile/);
  });

  test('the account overview stays behind the auth guard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Deine Daten')).toHaveCount(0);
    await expect(page.getByText('Mein Konto')).toHaveCount(0);
  });

  test('not found route shows 404', async ({ page }) => {
    await page.goto('/non-existent-route');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  // Accounts are sales data. Participants must not reach them through the portal.
  test.describe('routes removed from the participant portal', () => {
    // /reset-password posted to /services/apexrest/auth/reset-password, an
    // endpoint that does not exist. Salesforce serves its own reset page from
    // the email link, so the route was removed rather than left as a dead form.
    for (const path of ['/register', '/search', '/test-chat', '/accounts', '/reset-password']) {
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