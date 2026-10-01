import { defineConfig, devices } from '@playwright/test';

/**
 * Guest login against the live Experience Cloud site.
 *
 * Why this is a separate project from the shell suite: the bug it guards is
 * the *guest* session probe, and only the live org reproduces that. Served
 * statically, `services/data/.../ui-api/session/csrf` answers with index.html,
 * the SDK throws, and the button is enabled even without the fix — the harness
 * is green either way and proves nothing.
 *
 * On the live site the same request answers
 *
 *   403 [{"errorCode":"API_DISABLED_FOR_ORG",
 *         "message":"The Chatter Connect API is not enabled for this
 *                     organization or user type."}]
 *
 * because Chatter Connect is off for the guest profile. The platform SDK
 * fetches a CSRF token before every protected request, so the probe depends on
 * an endpoint the guest cannot reach. Any wait on it must therefore be bounded.
 *
 * Run with:
 *   npx playwright test --config=playwright.live.config.ts
 *
 * Credentials come from the environment; the sign-in case skips without them:
 *   PORTAL_USER=<username> PORTAL_PASSWORD=<password> npx playwright test --config=playwright.live.config.ts
 */
export default defineConfig({
  // Only the live suite. The shell suite in app.spec.ts needs the static
  // `serve dist` harness and fails against the real site by design.
  testMatch: /live-guest\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    // Host only, no path. Playwright resolves page.goto('/x') against the URL
    // *origin*, discarding any path in baseURL — with '/organisatorv1' here the
    // suite silently ran against /login on the site root, which 301s to
    // AnmeldungsPortal, a completely different site. Every spec below therefore
    // spells out the full site path instead of relying on baseURL.
    baseURL: process.env.PORTAL_HOST ?? 'https://techandteach--devhub.sandbox.my.site.com',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'live-guest',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});