/**
 * L12 (SPEC §17): true theorems HOLD (local) for 20 seeds with zero flakes, on the exact
 * rung wherever the closure is exact over Q. Part b of the corpus (split for parallel runs).
 */
import { afterAll, describe, it } from 'vitest';
import { TRUE_THEOREMS } from '../helpers/corpus-true';
import { expectHolds } from '../helpers/l12';
import { lawCount } from '../helpers/laws';

const SEEDS = Array.from({ length: lawCount(20) }, (_, i) => i + 1);
const rows: string[] = [];

describe('L12: true theorems hold in the local test (b)', () => {
  for (const e of TRUE_THEOREMS.slice(24)) {
    it(e.name, () => {
      rows.push(expectHolds(e, SEEDS));
    });
  }
  afterAll(() => {
    console.warn(
      [
        'L12 true theorems (b):',
        '| theorem | rung | seeds × figures |',
        '| --- | --- | --- |',
        ...rows,
      ].join('\n'),
    );
  });
});
