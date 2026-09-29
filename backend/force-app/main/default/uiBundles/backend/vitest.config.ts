import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // e2e/ holds Playwright specs, not vitest tests. Without this, vitest
    // collects them and fails on test.describe()/test.use() not being expected.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
