import { defineConfig } from 'vitest/config';

/**
 * The tests of packages/claims alone: the test set Stryker runs against the claims
 * mutants. GEOMIRA_LAW_SCALE shrinks the corpora's seed counts for each mutant
 * (packages/claims/test/helpers/laws.ts); `pnpm verify` and CI never set it.
 */
export default defineConfig({
  test: {
    include: ['packages/claims/test/**/*.test.ts'],
    environment: 'node',
    env: { GEOMIRA_LAW_SCALE: '0.25' },
  },
});
