/** L12 (SPEC §17): degenerate claims are never true or false, in any sample of either regime. */
import { describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import { REGISTRY } from '../helpers/build';
import { baseFigure } from '../helpers/corpus';
import { DEGENERATE_CLAIMS } from '../helpers/corpus-degenerate';
import { currentValue, localVerdict } from '../helpers/l12';

describe('L12: degenerate claims are never true or false', () => {
  for (const e of DEGENERATE_CLAIMS) {
    it(e.name, () => {
      expect(currentValue(e).value).toBe('undefined');
      for (const seed of [1, 2, 3, 4, 5]) {
        const v = localVerdict(e, seed);
        expect(v.kind).toBe('inconclusive');
        expect([v.tally.true, v.tally.false]).toEqual([0, 0]);
      }
      const f = baseFigure();
      const id = e.build(f);
      const r = testClaim(
        { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed: 9, n: 40 },
        { registry: REGISTRY },
      );
      expect(
        r.kind === 'verdict' ? [r.verdict.kind, r.verdict.tally.true, r.verdict.tally.false] : r,
      ).toEqual(['inconclusive', 0, 0]);
    });
  }
});
