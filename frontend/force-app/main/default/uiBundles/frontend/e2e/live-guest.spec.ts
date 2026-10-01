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
 * Every spec spells out the full site path. baseURL in the config carries the host
 * only, because page.goto('/login') resolves against the origin and would drop
 * '/organisatorv1' — an earlier version of this file put the path in baseURL and
 * the suite silently ran against /login on the site root, which 301s to
 * AnmeldungsPortal. A different site, with Salesforce's own login form.
 *
 * Set PORTAL_USER and PORTAL_PASSWORD to run the sign-in case; without them it
 * is skipped, the rest still runs.
 */
const PORTAL_USER = process.env.PORTAL_USER;
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

test.describe('guest login (live)', () => {
  test('the login form becomes usable even though the session probe cannot succeed', async ({ page }) => {
    await page.goto('/organisatorv1/login');

    // Sanity check that this is our bundle and not Salesforce's own login page,
    // which would make everything below pass for the wrong reason.
    await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
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

    await page.goto('/organisatorv1/login');

    // The submit button must be usable while the session probe is still
    // resolving. This is the step that hung for the user before the timeout fix.
    const submit = page.getByRole('button', { name: /^login$/i }).last();
    await expect(submit).toBeEnabled({ timeout: 15_000 });

    await page.locator('input[type="email"], input[name="email"]').first().fill(PORTAL_USER!);
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill(PORTAL_PASSWORD!);

    await submit.click();

    // Erfolg heißt: von /login weg und an einem geschützten Pfad.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    // Keine Fehlermeldung des Formulars.
    await expect(page.getByText('Invalid username or password')).toHaveCount(0);

    // Und die Daten sind da: der Name des Portal-Users gehört zum Teilnehmer.
    await expect(page.getByText('Mehmet Kaya').first()).toBeVisible({ timeout: 30_000 });
  });
});