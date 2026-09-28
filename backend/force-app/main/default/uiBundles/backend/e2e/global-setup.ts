import { FullConfig, chromium } from '@playwright/test';
import { unlinkSync } from 'fs';

export default async function globalSetup(config: FullConfig) {
  const { E2E_USERNAME, E2E_PASSWORD } = process.env;
  if (!E2E_USERNAME || !E2E_PASSWORD) {
    throw new Error('E2E_USERNAME/E2E_PASSWORD env vars required for global-setup');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');

  await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 30_000 });

  await page.fill('input[name="username"], input[type="email"]', process.env.E2E_USERNAME!);
  await page.fill('input[name="password"], input[type="password"]', process.env.E2E_PASSWORD!);
  await page.click('input[type="submit"], button[type="submit"]');

  await page.waitForURL(/\/participants|\/dashboard|\/app/, { timeout: 30_000 });

  await context.storageState({ path: 'e2e/auth-state.json' });

  await browser.close();
}
