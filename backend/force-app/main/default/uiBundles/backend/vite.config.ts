import { existsSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import salesforce from '@salesforce/vite-plugin-ui-bundle';
import codegen from 'vite-plugin-graphql-codegen';
import { getOrgInfo, refreshOrgAuth } from '@salesforce/ui-bundle/app';

const schemaPath = resolve(__dirname, '../../../../../schema.graphql');
const schemaExists = existsSync(schemaPath);

/**
 * `@salesforce/vite-plugin-ui-bundle` serves `/services/data/**` through
 * `orgInfo.instanceUrl`, which `getOrgInfo` rewrites to the Lightning domain
 * (`*.lightning.force.com`). That domain rejects the Platform SDK's GraphQL
 * endpoint with `401 UNAUTHORIZED_EXCEPTION: Session expired or invalid token
 * usage`, while the plain instance URL answers `200` for the identical request
 * — the plugin's own `handleGraphQL`, frontdoor and file-upload handlers all
 * use `rawInstanceUrl` for the same reason. Its generic REST handler does not,
 * so every `POST /services/data/vXX/graphql` fails in local dev.
 *
 * Rather than patch the plugin, this middleware claims that single route first
 * (`enforce: 'pre'` + array order) and forwards it to `rawInstanceUrl`. All
 * other org routes keep the plugin's behaviour, which is verified working.
 */
const SDK_GRAPHQL_ROUTE = /^\/services\/data\/v\d{2}\.\d\/graphql$/;

type OrgInfo = NonNullable<Awaited<ReturnType<typeof getOrgInfo>>>;

function createOrgGraphqlProxy(): Plugin {
  let orgInfo: OrgInfo | undefined;

  return {
    name: 'organisator:org-graphql-proxy',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';
        const route = url.split('?')[0];
        if (!SDK_GRAPHQL_ROUTE.test(route)) {
          next();
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = Buffer.concat(chunks).toString('utf8');
          const search = url.slice(route.length);

          const forward = (target: OrgInfo) =>
            fetch(`${target.rawInstanceUrl}${route}${search}`, {
              method: req.method,
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Chatter-Entity-Encoding': 'false',
                // `sid` is what Apex/UI API expects; the bearer token covers
                // plain REST. Both must carry the same session.
                Cookie: `sid=${target.accessToken}`,
                Authorization: `Bearer ${target.accessToken}`,
              },
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            });

          let target = orgInfo ?? (orgInfo = await getOrgInfo());
          if (!target) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                errorCode: 'UNAUTHORIZED',
                message:
                  'No org authenticated. Run "sf org login" or "sf config set target-org=<alias>".',
              })
            );
            return;
          }

          let response = await forward(target);
          if (response.status === 401 || response.status === 403) {
            const refreshed = await refreshOrgAuth(target.orgAlias || target.username);
            if (refreshed) {
              target = orgInfo = refreshed;
              response = await forward(target);
            }
          }

          res.statusCode = response.status;
          res.setHeader(
            'Content-Type',
            response.headers.get('content-type') ?? 'application/json'
          );
          res.end(await response.text());
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    base: './',
    plugins: [
      tailwindcss(),
      react(),
      createOrgGraphqlProxy(),
      salesforce(),
      // Only add codegen when schema exists (e.g. after `npm run graphql:schema`).
      // In CI or when schema is not checked in, skip codegen so build succeeds.
      ...(schemaExists
        ? [
            codegen({
              configFilePathOverride: resolve(__dirname, 'codegen.yml'),
              runOnStart: true,
              runOnBuild: true,
              enableWatcher: true,
              throwOnBuild: true,
            }),
          ]
        : []),
    ] as import('vite').PluginOption[],

    // Build configuration for MPA
    build: {
      outDir: resolve(__dirname, 'dist'),
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router'],
            'vendor-radix': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
            ],
            'vendor-date': ['date-fns'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },

    // Resolve aliases (shared between build and test)
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

    // Vitest configuration
    test: {
      // Override root for tests (build uses src/pages as root)
      root: resolve(__dirname),

      // Use jsdom environment for React component testing
      environment: 'jsdom',

      // Setup files to run before each test
      setupFiles: ['./src/test/setup.ts'],

      // Global test patterns
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        'src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'clover', 'json'],
        exclude: [
          'node_modules/',
          'src/test/',
          'src/**/*.d.ts',
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/components/**/index.ts',
          '**/*.config.ts',
          'build/',
          'dist/',
          'coverage/',
          'eslint.config.js',
        ],
        thresholds: {
          global: {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85,
          },
        },
      },

      // Test timeout
      testTimeout: 10000,

      // Globals for easier testing
      globals: true,
    },
  };
});
