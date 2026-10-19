import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `pnpm test:coverage` (part of `pnpm verify`) enforces the per-package coverage gates.
    // Packages join `include` and `thresholds` in the run that builds them.
    coverage: {
      provider: 'v8',
      include: ['packages/num/src/**/*.ts'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        'packages/num/src/**/*.ts': { lines: 95, branches: 95 },
      },
    },
    projects: [
      {
        test: {
          name: 'packages',
          include: ['packages/*/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'web',
          include: ['apps/web/test/**/*.test.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'scripts',
          include: ['scripts/**/*.test.ts'],
          exclude: ['scripts/check-rules/fixtures/**'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
    ],
  },
});
