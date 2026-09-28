import { FullConfig } from '@playwright/test';
import { unlinkSync } from 'fs';

export default async function globalTeardown(_config: FullConfig) {
  try {
    unlinkSync('e2e/auth-state.json');
  } catch {
    // ignore
  }
}
