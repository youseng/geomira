/**
 * Degenerate cases of foci (ADR-0043 decisions 15–16), spread into degenerate.test.ts. Fixtures:
 * E53 the ellipse x²/25 + y²/9 = 1 (foci (±4, 0), rational); ELL x²/4 + y² = 1 (foci (±√3, 0));
 * HYP xy = 1 (foci ±(√2, √2)); PAR y = x² (focus (0, 1/4)).
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr, type Selector } from '../../src/expr';
import { REGISTRY } from './doc';
import { FIELDS, ORDERED, plain, reason } from './degenerate';
import { ALONG_P, ORIENT_P, choose, other } from './degenerate-branch';
import { circ } from './degenerate-circles';
import { ELL, HYP, PAR } from './degenerate-conics';
import { contextOf, Builder, pt } from './doc';

const conic = (...ps: Expr[]): Expr => call('conic', ps);
export const E53 = conic(pt(5, 0), pt(0, 3), pt(-5, 0), pt(0, -3), pt(3, '12/5'));
const near = (p: Expr): Selector => ({ kind: 'near', p });

/** x² + 1e-9·y² − y = 0 (FloatField): its centre 5·10⁸ away, within the band of a parabola. */
const NEAR_PAR_EXPR = conic(
  pt(0, 0),
  pt(Math.sqrt(1 - 1e-9), 1),
  pt(-Math.sqrt(1 - 1e-9), 1),
  pt(Math.sqrt(4 - 16e-9), 4),
  pt(-Math.sqrt(4 - 16e-9), 4),
);

/** The value as [x, y], exactly over Q and rounded to 12 places in floats (-0 as 0). */
function xy<T>(
  F: { readonly kind: string; toNumber(x: T): number },
  v: ReturnType<typeof choose<T>>,
) {
  const p = plain(F as never, v) as [number, number] | string;
  if (typeof p === 'string' || F.kind !== 'float') return p;
  return p.map((c) => Math.round(c * 1e12) / 1e12 + 0);
}

export const FOCI_CASES: Record<string, Record<string, () => void>> = {
  foci: {
    'a circle → its center (no selector)': () => {
      for (const F of ORDERED)
        expect(xy(F, choose(F, 'foci', [circ(pt(1, 2), pt(4, 6))]))).toEqual([1, 2]);
      expect(choose(ModPField, 'foci', [circ(pt(1, 2), pt(4, 6))])).toEqual({
        kind: 'point',
        x: 1n,
        y: 2n,
      });
      expect(reason(choose(FloatField, 'foci', [circ(pt(1, 2), pt(4, 6))], [near(pt(0, 0))]))).toBe(
        'undefined: foci(c): a circle has one focus, its center: no selector',
      );
    },
    'an ellipse or a hyperbola: two foci; no selector → Undefined (ambiguous: add a selector)':
      () => {
        for (const F of FIELDS)
          for (const k of [E53, ELL, HYP])
            expect(reason(choose(F, 'foci', [k]))).toBe(
              'undefined: ambiguous: add a selector: foci(k) has two foci (for example other(P), near(P), same_side(Q, l))',
            );
        for (const F of ORDERED) {
          expect(xy(F, choose(F, 'foci', [E53], [near(pt(10, 1))]))).toEqual([4, 0]);
          expect(xy(F, choose(F, 'foci', [E53], [near(pt(-10, 1))]))).toEqual([-4, 0]);
        }
        const h = choose(FloatField, 'foci', [HYP], [near(pt(1, 1))]);
        expect(h.kind === 'point' && Math.hypot(h.x - Math.SQRT2, h.y - Math.SQRT2)).toBeLessThan(
          1e-12,
        );
      },
    'the two foci within the band of each other (a conic that is nearly a circle) → the center, one double point':
      () => {
        // x² + (1 + 2·10⁻¹⁶·…)y² ≈ 1: the half focal distance is far inside the band.
        const s = Math.sqrt(1 - 1e-15);
        const k = conic(pt(1, 0), pt(0, s), pt(-1, 0), pt(0, -s), pt('3/5', 0.8 * s));
        const v = choose(FloatField, 'foci', [k], [near(pt(10, 0))]);
        expect(v.kind === 'point' && Math.hypot(v.x, v.y)).toBeLessThan(1e-9);
        // Over Q the same conic has two foci, very close (Inexact square roots).
        expect(choose(RationalField, 'foci', [k], [near(pt(10, 0))]).kind).toBe('inexact');
      },
    'a parabola → its one focus, exact over Q and mod p': () => {
      for (const F of ORDERED) {
        expect(xy(F, choose(F, 'foci', [PAR], [near(pt(0, 0))]))).toEqual([0, 0.25]);
        expect(xy(F, choose(F, 'foci', [PAR]))).toEqual([0, 0.25]);
      }
      const v = choose(ModPField, 'foci', [PAR], [near(pt(0, 0))]);
      expect(v.kind === 'point' && ModPField.eq(ModPField.mul(v.y, 4n), 1n)).toBe(true);
    },
    'a conic within the band of a parabola → Undefined (ambiguous)': () => {
      expect(reason(choose(FloatField, 'foci', [NEAR_PAR_EXPR], [near(pt(0, 0))]))).toBe(
        'undefined: ambiguous: the conic is within the band of a parabola',
      );
    },
    'the square roots of the foci not representable → Inexact over Q and mod p': () => {
      expect(reason(choose(RationalField, 'foci', [ELL], [near(pt(2, 0))]))).toMatch(/^inexact: /);
      expect(reason(choose(RationalField, 'foci', [HYP], [near(pt(2, 0))]))).toMatch(/^inexact: /);
      for (const k of [E53, ELL, HYP])
        expect(reason(choose(ModPField, 'foci', [k], [near(pt(2, 0))]))).toMatch(/^inexact: /);
    },
    'other(F) with F not a focus → Undefined (within the band: ambiguous); a parabola’s other focus is at infinity → Undefined':
      () => {
        for (const F of ORDERED) {
          expect(xy(F, choose(F, 'foci', [E53], [other(pt(4, 0))]))).toEqual([-4, 0]);
          expect(reason(choose(F, 'foci', [E53], [other(pt(3, 0))]))).toBe(
            'undefined: other(F) needs F to be a focus of the conic',
          );
          expect(reason(choose(F, 'foci', [PAR], [other(pt(0, '1/4'))]))).toBe(
            'undefined: other(F): the other focus of a parabola is at infinity',
          );
        }
        expect(choose(ModPField, 'foci', [E53], [other(pt(4, 0))])).toEqual({
          kind: 'point',
          x: ModPField.neg(4n),
          y: 0n,
        });
        expect(reason(choose(FloatField, 'foci', [E53], [other(pt(4 + 3e-7, 0))]))).toMatch(
          /^undefined: ambiguous: within the band of a focus/,
        );
      },
    'along(±) or orient(±) → Undefined (they do not apply)': () => {
      for (const F of FIELDS) {
        expect(reason(choose(F, 'foci', [E53], [ALONG_P]))).toBe(
          'undefined: along(+) does not apply to foci(k)',
        );
        expect(reason(choose(F, 'foci', [E53], [ORIENT_P]))).toBe(
          'undefined: orient(+) does not apply to foci(k)',
        );
      }
    },
    'an invalid conic → Undefined': () => {
      const b = new Builder();
      b.add('x', pt(0, 0));
      const ctx = contextOf(b.doc);
      const pair = { kind: 'conic', a: 1, b: 0, c: -1, d: 0, e: 0, f: 0 } as const; // x² − y²
      const tool = REGISTRY.get('foci');
      expect(tool?.compute(FloatField, [pair], ctx)).toEqual({
        kind: 'undefined',
        reason: 'degenerate conic: a pair of lines, a double line or a point',
      });
    },
  },
};
