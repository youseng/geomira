import { defineConfig } from 'vitest/config';

/** The tests of packages/num alone: the test set Stryker runs against num's mutants. */
export default defineConfig({
  test: {
    include: ['packages/num/test/**/*.test.ts'],
    environment: 'node',
  },
});
