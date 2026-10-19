import { defineConfig } from 'vitest/config';

/**
 * The tests of packages/kernel alone: the test set Stryker runs against the kernel's
 * geometry mutants. GEOMIRA_LAW_SCALE shrinks the law tests' iteration counts for each
 * mutant (packages/kernel/test/helpers/laws.ts); `pnpm verify` and CI never set it.
 */
export default defineConfig({
  test: {
    include: ['packages/kernel/test/**/*.test.ts'],
    environment: 'node',
    env: { GEOMIRA_LAW_SCALE: '0.25' },
  },
});
