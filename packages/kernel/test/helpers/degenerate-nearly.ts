/** Degenerate cases of circle ∩ circle when the circles nearly coincide (ADR-0027). */
import { FloatField } from '@geomira/num/float-field';
import { expect } from 'vitest';
import { call } from '../../src/expr';
import { plain, reason } from './degenerate';
import { choose } from './degenerate-branch';
import { num, pt } from './doc';

const UNIT = call('circle', [pt(0, 0), pt(1, 0)]);

export const NEARLY_COINCIDENT_CASES: Record<string, () => void> = {
  'circle ∩ circle: the circles nearly coincide (centres and radii within the band) → two candidates by the half chord, or Undefined (ambiguous)':
    () => {
      // Centres 5·10⁻⁸ apart, equal radii: two points near (0, ±1), never a centre.
      const twin = call('circle', [pt('5/100000000', 0), num(1)]);
      const near = { kind: 'near' as const, p: pt(0, 2) };
      const [x, y] = plain(FloatField, choose(FloatField, 'intersect', [UNIT, twin], [near])) as [
        number,
        number,
      ];
      expect(Math.abs(x)).toBeLessThan(1e-6);
      expect(y).toBeCloseTo(1, 6);
      // The second circle 10⁻⁸ inside the first, within the band: neither inside nor meeting.
      const inner = call('circle', [pt('5/100000000', 0), num('99999994/100000000')]);
      expect(reason(choose(FloatField, 'intersect', [UNIT, inner], [near]))).toBe(
        'undefined: ambiguous: the circles nearly coincide',
      );
    },
};
