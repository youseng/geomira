import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `pnpm test:coverage` (part of `pnpm verify`) enforces the per-package coverage gates.
    // Packages join `include` and `thresholds` in the run that builds them.
    coverage: {
      provider: 'v8',
      include: [
        'packages/num/src/**/*.ts',
        'packages/kernel/src/**/*.ts',
        'packages/claims/src/**/*.ts',
        'packages/lang/src/**/*.ts',
        'packages/scene/src/**/*.ts',
        'packages/editor/src/**/*.ts',
        'packages/export/src/**/*.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        'packages/num/src/**/*.ts': { lines: 95, branches: 95 },
        // Run 2 acceptance: kernel ≥ 90% lines (branches gated too, so gaps stay visible).
        'packages/kernel/src/**/*.ts': { lines: 90, branches: 85 },
        // Run 5: claims gated like the kernel.
        'packages/claims/src/**/*.ts': { lines: 90, branches: 85 },
        // Run 6: lang gated like the kernel and claims.
        'packages/lang/src/**/*.ts': { lines: 90, branches: 85 },
        // Run 7: scene gated like the kernel, claims and lang.
        'packages/scene/src/**/*.ts': { lines: 90, branches: 85 },
        // Run 8a: editor gated like the other packages.
        'packages/editor/src/**/*.ts': { lines: 90, branches: 85 },
        // Run 9a: export gated like the other packages.
        'packages/export/src/**/*.ts': { lines: 90, branches: 85 },
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
