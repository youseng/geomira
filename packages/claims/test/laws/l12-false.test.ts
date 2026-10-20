/** L12 (SPEC §17): false claims are FALSE or MIXED in the local test, never HOLDS. */
import { afterAll, describe, expect, it } from 'vitest';
import { FALSE_CLAIMS } from '../helpers/corpus-false';
import { TRUE_THEOREMS } from '../helpers/corpus-true';
import { DEGENERATE_CLAIMS } from '../helpers/corpus-degenerate';
import { currentValue, localVerdict } from '../helpers/l12';
import { lawCount } from '../helpers/laws';

const SEEDS = Array.from({ length: lawCount(5) }, (_, i) => i + 1);
const rows: string[] = [];

describe('L12: the corpora have the required sizes', () => {
  it('≥ 40 true theorems, ≥ 40 false claims, ≥ 20 degenerate claims, all names distinct', () => {
    expect(TRUE_THEOREMS.length).toBeGreaterThanOrEqual(40);
    expect(FALSE_CLAIMS.length).toBeGreaterThanOrEqual(40);
    expect(DEGENERATE_CLAIMS.length).toBeGreaterThanOrEqual(20);
    const names = [...TRUE_THEOREMS, ...FALSE_CLAIMS, ...DEGENERATE_CLAIMS].map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('L12: false claims are FALSE or MIXED', () => {
  for (const e of FALSE_CLAIMS) {
    it(e.name, () => {
      for (const seed of SEEDS) {
        const v = localVerdict(e, seed);
        expect(['false', 'mixed'], `${e.name}, seed ${String(seed)}: ${v.text}`).toContain(v.kind);
      }
      const cur = currentValue(e);
      expect(cur.value).toBe('false');
      rows.push(`| ${e.name} | ${cur.value === 'false' ? cur.rung : ''} |`);
    });
  }
  afterAll(() => {
    console.warn(
      ['L12 false claims:', '| claim | rung (current figure) |', '| --- | --- |', ...rows].join(
        '\n',
      ),
    );
  });
});
