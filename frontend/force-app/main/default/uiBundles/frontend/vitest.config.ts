import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // `e2e/**` belongs to Playwright, which runs it against a served build with
    // a real browser. Vitest collecting those files fails on `test.describe()`
    // coming from @playwright/test, and it was silently doing so.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
