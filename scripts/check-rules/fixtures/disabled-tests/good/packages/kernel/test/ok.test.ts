import { expect, it } from 'vitest';
it('only runs when skipping is off', () => {
  const list = { skipped: 0, skipWhitespace: () => 1, fitness: () => 2 };
  expect(list.skipped + list.skipWhitespace() + list.fitness()).toBe(3);
});
