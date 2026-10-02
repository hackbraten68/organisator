import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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
 * Set PORTAL_USER and PORTAL_PASSWORD to run the sign-in cases; without them they
 * are skipped, the rest still runs. The cross-participant case is suspended by
 * design and needs no credentials — see its own describe block below.
 */
const PORTAL_USER = process.env.PORTAL_USER;
const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

/** Full site path — never rely on baseURL, see the header comment. */
const LOGIN_PATH = '/organisatorv1/login';
const ME_PATH = '/organisatorv1/sf/api/services/apexrest/participant-portal/me';

/**
 * The community host, NOT the My Domain. After logout the platform lands the
 * member on `*.sandbox.my.salesforce.com` when the Network <logoutUrl> is
 * missing or wrong — which serves `/organisatorv1/login` too, so the path alone
 * cannot tell a correct landing from the org login page.
 */
const COMMUNITY_HOST = 'techandteach--devhub.sandbox.my.site.com';

const BUNDLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_INDEX = resolve(BUNDLE_ROOT, 'dist/index.html');

/**
 * Signs in through the real form and waits until the app has left /login.
 *
 * Shared by every case that needs a session, so the "is this our app and not
 * Salesforce's own login page" sanity check lives in exactly one place instead
 * of being copy-pasted into each test.
 */
async function signIn(page: Page, user: string, password: string): Promise<void> {
  await page.goto(LOGIN_PATH);

  // The submit button must be usable while the session probe is still resolving.
  // This is the step that hung for the user before the AUTH_PROBE_TIMEOUT_MS fix.
  const submit = page.getByRole('button', { name: /^login$/i }).last();
  await expect(submit).toBeEnabled({ timeout: 15_000 });

  await page.locator('input[type="email"], input[name="email"]').first().fill(user);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);

  await submit.click();

  // Erfolg heißt: von /login weg und an einem geschützten Pfad.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

test.describe('guest login (live)', () => {
  test('the login form becomes usable even though the session probe cannot succeed', async ({ page }) => {
    await page.goto(LOGIN_PATH);

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

  test('the live site serves the bundle built in this working tree', async ({ page }) => {
    // Which bundle is live has been a recurring open question, and the answer was
    // always produced by hand with curl. Asserted here instead.
    //
    // A MISSING dist/ FAILS rather than skips. A skip is precisely the "green
    // suite that proves nothing" this repo keeps documenting: without a local
    // build there is nothing to compare against, so the rollout state is simply
    // unproven, and a skip would hide that.
    expect(existsSync(LOCAL_INDEX), `${LOCAL_INDEX} is missing — run \`npm run build\` first`).toBe(true);

    const built = readFileSync(LOCAL_INDEX, 'utf8');
    const builtHash = built.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(
      builtHash,
      'dist/index.html carries no hashed entry bundle — run `npm run build` first',
    ).not.toBeNull();

    await page.goto(LOGIN_PATH);

    const liveSrc = await page
      .locator('script[src*="assets/index-"]')
      .first()
      .getAttribute('src');
    expect(liveSrc, 'the live page has no hashed entry bundle — is this still our app?').toBeTruthy();

    // Compared against the LOCAL build, never a hardcoded hash: the hash changes
    // on every deploy, so a pinned value would one day fail for the wrong reason.
    expect(liveSrc).toContain(builtHash![0]);
  });

  test('a guest cannot read participant data', async ({ page }) => {
    // Anonym auf /me: es dürfen keine Teilnehmerdaten kommen. Das DTO enthält die
    // Feldnamen immer — entscheidend ist, dass die Werte null sind und der Code
    // NO_CONTACT_IDENTITY lautet.
    const response = await page.request.get(ME_PATH, { headers: { Accept: 'application/json' } });

    expect(response.status()).toBeGreaterThanOrEqual(401);

    const body = JSON.parse(await response.text());
    expect(body.code).toBe('NO_CONTACT_IDENTITY');
    expect(body.participantId).toBeNull();
    expect(body.participantName).toBeNull();
    expect(body.participantStatus).toBeNull();
  });

  test('a portal user can sign in and sees their own participant', async ({ page }) => {
    test.skip(!PORTAL_USER || !PORTAL_PASSWORD, 'PORTAL_USER / PORTAL_PASSWORD not set');

    await signIn(page, PORTAL_USER!, PORTAL_PASSWORD!);

    // Keine Fehlermeldung des Formulars.
    await expect(page.getByText('Invalid username or password')).toHaveCount(0);

    // Und die Daten sind da: der Name des Portal-Users gehört zum Teilnehmer.
    await expect(page.getByText('Mehmet Kaya').first()).toBeVisible({ timeout: 30_000 });
  });

  test("signing out lands on this app's login page, not on the org login", async ({ page }) => {
    test.skip(!PORTAL_USER || !PORTAL_PASSWORD, 'PORTAL_USER / PORTAL_PASSWORD not set');

    await signIn(page, PORTAL_USER!, PORTAL_PASSWORD!);

    // Sanity: we are really signed in before we prove we can sign out again.
    await expect(page.getByText('Mehmet Kaya').first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign Out' }).click();

    // The auto-retrying assertion comes FIRST, as a predicate over host AND path
    // together.
    //
    // Reading page.url() synchronously after the click races the navigation: it
    // reads the pre-logout URL and the assertion then fails for a reason that has
    // nothing to do with the bug. And two separate checks can straddle two
    // navigations. One predicate removes both hazards.
    //
    // Host and path are asserted together because each alone passes for the wrong
    // reason: the org login also serves `/organisatorv1/login`, and a host-only
    // match would survive a stale redirect that never ended the session.
    // The trailing slash is tolerated rather than required: the platform may
    // normalise the <logoutUrl> target, and a false failure here would look like
    // the bug this test exists to catch. It cannot mask the org-login case —
    // COMMUNITY_HOST is checked in the same predicate.
    const isReactLogin = (url: URL) =>
      url.host === COMMUNITY_HOST && /^\/organisatorv1\/login\/?$/.test(url.pathname);

    await expect(
      page,
      `expected the React login on ${COMMUNITY_HOST}/organisatorv1/login, landed on ${page.url()}`,
    ).toHaveURL(isReactLogin, { timeout: 30_000 });

    // And the session really ended: a protected route asks for the login again
    // instead of rendering participant data from cache.
    await page.goto('/organisatorv1/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  });

/**
 * AUSGESETZT (2026-10-02) — es gibt keine Credentials für einen zweiten Portal-User.
 *
 * Der Nachweis selbst existiert bereits, und zwar über den Service-Aufruf, nicht über
 * diesen Browser-Test: `backend/docs/portal-deploy-status.md:205-211` belegt beide Richtungen
 *
 *   beide Shares vorhanden  ->  beide User 200 mit eigener Row
 *   Probe-Share entzogen    ->  Probe-User 404
 *
 * Dieser Fall ergänzt ausschließlich die Oberfläche: dass die UI keine fremden Daten
 * rendert, auch wenn der Response-Level-Check grün wäre. Das ist echter Zusatznutzen, aber
 * kein offenes Gate — und ein ausgesetzter Test ist nur dann ehrlich, wenn jemand das auch
 * so aufschreibt. `describe.skip` statt `test.skip`, weil Playwright dann „skipped" meldet und
 * der Grund im Block steht; eine env-Variable, die ihn einschaltet, existiert bewusst nicht.
 *
 * Reaktivieren: Portaleinsatz-Passwort für `probe.mixeddml2.1790159877908@example.invalid`
 * setzen (dokumentiert in portal-deploy-status.md:161-166, `System.setPassword` per Execute
 * Anonymous), dann `.skip` hier entfernen und PORTAL_USER2/PORTAL_PASSWORD2 wieder aufnehmen.
 */
test.describe.skip("cross-participant isolation (suspended, no second-user credentials)", () => {
  const PORTAL_USER2 = process.env.PORTAL_USER2;
  const PORTAL_PASSWORD2 = process.env.PORTAL_PASSWORD2;

  test("a second portal user never sees the first user's participant", async ({ browser }) => {
    test.skip(!PORTAL_USER || !PORTAL_PASSWORD, 'PORTAL_USER / PORTAL_PASSWORD not set');
    test.skip(!PORTAL_USER2 || !PORTAL_PASSWORD2, 'PORTAL_USER2 / PORTAL_PASSWORD2 not set');

    // WHAT THIS DOES AND DOES NOT PROVE.
    //
    // `/me` accepts no parameter and resolves identity server-side from
    // User.ContactId, so there is no place to substitute an id — the classic
    // injection negative test is not available, and pretending otherwise would
    // produce a test that cannot fail.
    //
    // What IS testable: that a second, legitimately authorised portal user never
    // receives the first user's row. A probe through `/services/data/...` would be
    // worthless — Experience Cloud sessions are rejected there with
    // INVALID_SESSION_ID, so such an assertion would pass unconditionally.

    // User 1 establishes what their own record looks like, so the negative check
    // compares against a captured value instead of a name that can go stale.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await signIn(pageA, PORTAL_USER!, PORTAL_PASSWORD!);

    const first = await pageA.request.get(ME_PATH, { headers: { Accept: 'application/json' } });
    expect(first.status()).toBe(200);
    const me1 = await first.json();

    // A genuinely separate session. Reusing pageA would only be user 1 wearing a
    // different label.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signIn(pageB, PORTAL_USER2!, PORTAL_PASSWORD2!);

    const second = await pageB.request.get(ME_PATH, { headers: { Accept: 'application/json' } });
    const body2 = await second.json().catch(() => null);

    if (second.status() === 200) {
      // The second user has a released row — it must be theirs, not user 1's.
      expect(body2.participantId).not.toBe(me1.participantId);
      expect(body2.contactId).not.toBe(me1.contactId);
    } else {
      // No row is also legitimate. But only the documented codes — an unexpected
      // code is a new failure mode and must not be waved through.
      expect(['NO_CONTACT_IDENTITY', 'NO_PARTICIPANT', 'PORTAL_ACCESS_NOT_GRANTED']).toContain(
        body2?.code,
      );
    }

    // Whatever the status, user 1's identifiers must not appear anywhere in the
    // response body.
    if (me1.participantId) {
      expect(JSON.stringify(body2)).not.toContain(me1.participantId);
    }

    // And nothing of theirs is rendered on the page either — a response-level
    // check alone would miss a UI that fetched it by another route.
    await expect(pageB.getByText(me1.participantName).first()).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});