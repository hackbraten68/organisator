import { test, expect } from '@playwright/test';

/**
 * Guest login against the live Experience Cloud site.
 *
 * These assertions are about the guest path only: a visitor who is not
 * authenticated must reach a usable login form and be able to sign in. The
 * static shell suite cannot cover any of it, because there the CSRF endpoint
 * answers with index.html and the SDK fails fast instead of hanging — which
 * made that harness pass with *and* without the timeout fix.
 *
 * KNOWN SITE CONFIGURATION ISSUE (2026-10-01), still open
 *   `/organisatorv1/login` currently serves Experience Cloud's own login page
 *   rather than the React bundle. The DOM proves it:
 *
 *     <input type="email" name="username" id="username" autocomplete="username">
 *     <img alt="Log In with a Different Username" src="/img/clear.png">
 *
 *   Salesforce's page, not ours. The React bundle is never loaded there, so the
 *   timeout fix in AuthContext cannot influence what a guest sees until the
 *   site's login page is pointed back at the builder page (Setup → Digital
 *   Experiences → Sites → Organisator → login page).
 *
 *   The first test below therefore pins the *bundle's* behaviour and will keep
 *   passing either way until that setting is changed. It is deliberately kept:
 *   once the site is reconfigured it becomes the regression guard that the
 *   static suite could not provide.
 *
 * Set PORTAL_USER and PORTAL_PASSWORD to run the sign-in case; without them it
 * is skipped, the rest still runs.
 */
const PORTAL_USER = process.env.PORTAL_USER;
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

/**
 * Skipped while the site still serves Salesforce's own login page, because the
 * assertions describe the React bundle.
 */
const REACT_LOGIN_IS_SERVED = false;

test.describe('guest login (live)', () => {
  test('the login form becomes usable even though the session probe cannot succeed', async ({ page }) => {
    test.skip(REACT_LOGIN_IS_SERVED === false, 'site serves the Experience Cloud login page, not the bundle');

    await page.goto('/login');

    // The message names the real failure: Chatter Connect is off for the guest
    // profile, so the CSRF fetch the SDK performs before a protected request
    // cannot resolve. Login has to be released anyway.
    const button = page.getByRole('button', { name: /^login$/i }).last();

    // Bounded by AUTH_PROBE_TIMEOUT_MS (8s) plus slack. Without that bound the
    // button stays disabled forever and this times out — which is the bug.
    await expect(button).toBeEnabled({ timeout: 15_000 });

    // The fields must be usable, not merely present.
    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible();
    await expect(email).toBeEnabled();
    await email.fill('someone@example.invalid');
  });

  test('a guest cannot read participant data', async ({ page }) => {
    // Anonym auf /me: es dürfen keine Teilnehmerdaten kommen. Das DTO enthält die
    // Feldnamen immer — entscheidend ist, dass die Werte null sind und der Code
    // NO_CONTACT_IDENTITY lautet.
    const response = await page.request.get(
      '/organisatorv1/sf/api/services/apexrest/participant-portal/me',
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBeGreaterThanOrEqual(401);

    const body = JSON.parse(await response.text());
    expect(body.code).toBe('NO_CONTACT_IDENTITY');
    expect(body.participantId).toBeNull();
    expect(body.participantName).toBeNull();
    expect(body.participantStatus).toBeNull();
  });

  test('a portal user can sign in and sees their own participant', async ({ page }) => {
    test.skip(!PORTAL_USER || !PORTAL_PASSWORD, 'PORTAL_USER / PORTAL_PASSWORD not set');

    await page.goto('/login');

    await page.locator('input[type="email"], input[name="email"]').first().fill(PORTAL_USER!);
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill(PORTAL_PASSWORD!);

    await page.getByRole('button', { name: /^login$/i }).last().click();

    // Erfolg heißt: von /login weg und an einem geschützten Pfad.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    // Keine Fehlermeldung des Formulars.
    await expect(page.getByText('Invalid username or password')).toHaveCount(0);
  });
});