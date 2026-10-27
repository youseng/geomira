import { defineConfig } from 'vitest/config';

/**
 * The tests of packages/discovery alone: the test set Stryker runs against the discovery
 * mutants (ADR-0035). GEOMIRA_LAW_SCALE shrinks the corpora's entry counts for each mutant
 * (packages/claims/test/helpers/laws.ts); `pnpm verify` and CI never set it.
 */
export default defineConfig({
  test: {
    include: ['packages/discovery/test/**/*.test.ts'],
    environment: 'node',
    env: { GEOMIRA_LAW_SCALE: '0.25' },
  },
});
