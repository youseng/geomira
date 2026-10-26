/**
 * Degenerate cases of symmedian_point (maintainer request after Run 13, ADR-0033), as the other
 * triangle centers: coincident or collinear vertices → Undefined with the reason. Spread into
 * degenerate.test.ts's table.
 */
import { expect } from 'vitest';
import { A, B, C, FIELDS, at, reason } from './degenerate';
import { pt } from './doc';

export const SYMMEDIAN_POINT_CASES: Record<string, Record<string, () => void>> = {
  symmedian_point: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        for (const args of [
          [A, A, C],
          [A, B, B],
          [C, B, C],
        ])
          expect(reason(at(F, 'symmedian_point', ...args))).toBe(
            'undefined: coincident points: symmedian_point needs three distinct vertices',
          );
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'symmedian_point', A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: symmedian_point needs a non-degenerate triangle',
        );
    },
  },
};
