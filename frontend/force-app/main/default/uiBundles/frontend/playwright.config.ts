import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 5175;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Serve built dist/ with static server so e2e works in CI without SF org (vite preview runs plugin and can fail)
    //
    // `--single` is what makes this an SPA: every request that is not a real
    // file is rewritten to index.html, so React Router resolves /login,
    // /non-existent-route and friends in the browser.
    //
    // It used to depend on a hand-placed dist/serve.json with a rewrite rule.
    // The build wipes dist/, so that file vanished on the next clean build and
    // every unknown path answered with serve's own 404 page instead of the
    // app's NotFound route — the suite kept running against the wrong HTML.
    // --single needs no file in the build output.
    command: `npx serve dist -l ${E2E_PORT} --single`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 120_000 : 60_000,
  },
});
