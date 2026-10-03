import { test, expect } from '@playwright/test';

/**
 * The signed-in portal shell, without an org.
 *
 * WHY THIS FILE EXISTS
 *   `app.spec.ts` can only ever see the login page, because it serves `dist/`
 *   statically and `getCurrentUser()` has no session. Everything that renders
 *   *after* sign-in — the sidebar, the dashboard, the sidebar's user menu — was
 *   therefore untested, and the only coverage lived in `live-guest.spec.ts`,
 *   which needs real credentials. A layout change could break the authenticated
 *   shell with the whole offline suite still green.
 *
 * HOW THE SESSION IS FAKED
 *   `getCurrentUser()` (@salesforce/ui-bundle) does two requests in order, and
 *   both have to be answered or the app never mounts:
 *
 *     1. GET  /services/data/v67.0/ui-api/session/csrf — the platform SDK takes a
 *        CSRF token before every protected call. Served statically this path
 *        answers index.html, so the SDK dies on JSON.parse before it ever gets
 *        to the query. (Same limitation AGENTS.md documents for the guest path.)
 *     2. POST /services/data/v67.0/graphql — the GetCurrentUser query, read from
 *        `data.uiapi.currentUser`. A non-Guest user there is enough for
 *        AuthContext to report a session.
 *
 *   `UserType: "Guest"` is the negative control below and is asserted to behave
 *   like a real anonymous visitor.
 *
 * This is a layout/structure test. It says nothing about whether the real
 * endpoints answer — that stays in the live suite.
 */

const CSRF_PATTERN = '**/ui-api/session/csrf';
const GRAPHQL_PATTERN = '**/services/data/v67.0/graphql';
const ME_PATTERN = '**/services/apexrest/participant-portal/me';

/**
 * The CSRF token endpoint, answered before anything else.
 *
 * Needs a JSON body with a token; without it the SDK throws inside JSON.parse and
 * AuthContext reports "not authenticated" regardless of the GraphQL stub.
 */
async function stubCsrf(page: import('@playwright/test').Page): Promise<void> {
  await page.route(CSRF_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-csrf-token' }),
    });
  });
}

/** Minimal payload that `getCurrentUser()` accepts as a signed-in session. */
function signedInUserResponse(): string {
  return JSON.stringify({
    data: {
      uiapi: {
        currentUser: {
          Id: '005MEHMETKAYA',
          Name: { value: 'Mehmet Kaya' },
          UserType: { value: 'PowerCustomerSuccess' },
        },
      },
    },
  });
}

/** The shape the platform actually returns for an anonymous visitor. */
function guestUserResponse(): string {
  return JSON.stringify({
    data: {
      uiapi: {
        currentUser: {
          Id: '005GUEST',
          Name: null,
          UserType: { value: 'Guest' },
        },
      },
    },
  });
}

/**
 * Answers the session query and `/me`, so the shell reaches its signed-in state.
 * The participant name is the one the live suite asserts after a real login.
 */
async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await stubCsrf(page);

  await page.route(GRAPHQL_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: signedInUserResponse(),
    });
  });

  await page.route(ME_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        participantId: 'a0P0000000MEHME',
        contactId: '0030000000MEHME',
        participantName: 'Mehmet Kaya',
        participantStatus: 'Aktiv',
        programName: 'Integrationskurs',
        coachName: 'Sabine Beispiel',
        startDate: '2026-09-01',
        expectedEndDate: '2027-01-31',
        contactName: 'Mehmet Kaya',
        contactEmail: 'mehmet.kaya@example.invalid',
      }),
    });
  });
}

test.describe('signed-in portal shell', () => {
  test('the dashboard is the start page and greets the participant', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    // "Dashboard" is the nav label; the page's own h1 is the greeting.
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    // The live suite asserts this name after a real login; the greeting is what
    // keeps that assertion meaningful now that "/" is the start page.
    await expect(page.getByRole('heading', { name: 'Guten Tag, Mehmet Kaya' })).toBeVisible();
  });

  test('the sidebar lists every navigation route', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    const sidebar = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Lernpfad' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Mein Konto' })).toBeVisible();
  });

  test('the dashboard placeholders are static, not a loading skeleton', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    for (const title of ['Dein Programm', 'Nächster Termin', 'Abwesenheiten', 'Dein Lernpfad']) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }

    // `Skeleton` hardcodes animate-pulse. A pulsing block reads as "loading",
    // so the dashboard would look permanently busy — see dashboard-placeholder.
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
  });

  test('exactly one user menu trigger is visible, and it opens upward', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    // Desktop Chrome is 1280px wide, so the sidebar is showing and the header's
    // AuthMenu stands down. The live logout spec resolves this trigger in
    // strict mode: a second visible copy would fail that test.
    const trigger = page.getByRole('button', { name: 'User menu' });
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toBeVisible();

    await trigger.click();
    // The trigger sits at the bottom of the viewport, so the menu has to open
    // towards the top or it renders off-screen.
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

    // The portal owns the session, so unlike the backoffice footer this menu
    // must offer Sign Out.
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible();
  });

  test('the sidebar footer shows the participant identity', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    const footer = page.getByRole('button', { name: 'User menu' });
    await expect(footer).toContainText('Mehmet Kaya');
    await expect(footer).toContainText('Teilnehmer');
  });

  test('Mein Konto moved off the start page and is reachable from the sidebar', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await page.getByRole('link', { name: 'Mein Konto' }).click();
    await expect(page).toHaveURL(/\/mein-konto$/);
    await expect(page.getByText('Deine Daten')).toBeVisible();
  });

  test('a guest gets neither sidebar nor user footer', async ({ page }) => {
    await stubCsrf(page);
    await page.route(GRAPHQL_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: guestUserResponse(),
      });
    });

    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'User menu' })).toHaveCount(0);
    // Same assertion app.spec.ts makes; repeated here because the sidebar makes
    // it a live question rather than a property of a closed disclosure.
    await expect(page.getByText('Mein Konto')).toHaveCount(0);
  });
});

/**
 * The two header affordances ported from the backoffice bundle: the colour theme
 * cycle and the `?` shortcuts legend.
 */
test.describe('theme and keyboard legend', () => {
  /** Resolved theme is visible as a class on <html>; tokens hang off it. */
  async function resolvedTheme(page: import('@playwright/test').Page): Promise<boolean> {
    return page.evaluate(() => document.documentElement.classList.contains('dark'));
  }

  test('the theme toggle cycles system -> dark -> light and persists', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /^Color theme:/ });
    await expect(toggle).toBeVisible();

    // Default follows the OS, and this harness reports light.
    expect(await resolvedTheme(page)).toBe(false);

    // First click relieves a light-OS user by going to dark.
    await toggle.click();
    await expect.poll(() => resolvedTheme(page)).toBe(true);

    // An explicit choice is persisted and survives a reload.
    expect(await page.evaluate(() => localStorage.getItem('organisator-portal-theme'))).toBe('dark');
    await page.reload();
    expect(await resolvedTheme(page)).toBe(true);

    // ...and the rest of the cycle: dark -> light -> system. Back on "system"
    // the harness still reports light, so the last step is only observable in the
    // stored value, not in the resolved one.
    await toggle.click();
    await expect.poll(() => resolvedTheme(page)).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('organisator-portal-theme'))).toBe('light');

    await toggle.click();
    expect(await page.evaluate(() => localStorage.getItem('organisator-portal-theme'))).toBe('system');
    await expect.poll(() => resolvedTheme(page)).toBe(false);
  });

  test('the toggle announces its state, not just "button"', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /^Color theme:/ });
    // The accessible name spells out what the button does next.
    await expect(toggle).toHaveAttribute('aria-label', /System theme \(currently light\)/);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', /Dark theme/);
  });

  test('the header carries the product name, not the scaffold default', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    // "React App" was the LWR template placeholder. It is easy to reintroduce by
    // copying a fresh scaffold, so the brand is asserted here.
    await expect(page.getByRole('banner')).toContainText('Organisator');
    await expect(page.getByText('React App')).toHaveCount(0);
  });

  test('? opens the legend and Escape closes it', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Tastenkürzel')).toBeVisible();
    // Guards against an open-then-close race. Note this does NOT detect a second
    // "?" listener: with both bound, the handlers converge on the same value
    // (one functional toggle, one stale prop) and the dialog still opens. Binding
    // it once is a readability decision, not a tested behaviour.

    // Escape is handled by DialogContent itself.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the legend lists only controls this portal has', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await page.keyboard.press('?');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Allgemein' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Portal' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Menüs' })).toBeVisible();

    // No Tabs and no Akkordeons exist in the portal. A legend entry for a control
    // that is not on the page documents something untrue.
    await expect(dialog.getByRole('heading', { name: 'Tabs' })).toHaveCount(0);
    await expect(dialog.getByRole('heading', { name: 'Akkordeons' })).toHaveCount(0);
  });

  test('? is typed, not swallowed, inside a login field', async ({ page }) => {
    await stubCsrf(page);
    await page.route(GRAPHQL_PATTERN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: guestUserResponse(),
      });
    });

    await page.goto('/login');
    const email = page.getByLabel(/email/i);
    await email.click();
    await email.type('wer?');

    // The character must survive...
    await expect(email).toHaveValue('wer?');
    // ...and the dialog must not open over the form the user is typing in.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the legend is reachable from the header button, not only the key', async ({ page }) => {
    await signIn(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Tastenkürzel anzeigen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});