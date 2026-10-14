import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Mirrors `vite.config.ts`. Vitest prefers this file over the Vite config, so
  // without the aliases here every `@/...` import fails to resolve — which only
  // showed up once a test imported a module that does so itself
  // (`appointmentsApi.ts` -> `@/features/authentication/utils/helpers`).
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
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
