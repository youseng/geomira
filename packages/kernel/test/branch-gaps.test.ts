/**
 * Behaviours of the Run 3b candidate geometry that the first mutation run (7e4c55c) found
 * untested: messages naming the right object and range, a ray that meets a circle once
 * (no selector needed), exact tangency of circles whose radii are irrational (decided on
 * the exact sign of D over Q), degenerate first arguments, and the order in which other(P)
 * checks its two objects.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import type { Value } from '../src/value';
import { choose, other, sameSide } from './helpers/degenerate-branch';
import { plain, reason } from './helpers/degenerate';
import { REGISTRY, must, pt } from './helpers/doc';

const ORDERED = [FloatField, RationalField] as Field<unknown>[];
const C5 = call('circle', [pt(0, 0), pt(5, 0)]);
const line = (a: Expr, b: Expr) => call('line', [a, b]);

describe('Run 3b candidate geometry: gaps found by mutation testing', () => {
  it('messages name the object, the range and the pair', () => {
    for (const F of ORDERED) {
      // line ∩ line with a filter that rejects its one point.
      expect(
        reason(
          choose(
            F,
            'intersect',
            [line(pt(0, 0), pt(1, 1)), line(pt(0, 2), pt(2, 0))],
            [sameSide(pt(9, 0), line(pt(2, -1), pt(2, 1)))],
          ),
        ),
      ).toBe(
        'undefined: no intersection satisfies same_side(point(9, 0), line(point(2, -1), point(2, 1)))',
      );
      // other(P) checks the objects in the call's order: the line first in intersect(l, c).
      expect(
        reason(choose(F, 'intersect', [line(pt(0, 1), pt(1, 1)), C5], [other(pt(9, 9))])),
      ).toBe('undefined: other(point(9, 9)) needs the point on the line');
      expect(
        reason(choose(F, 'intersect', [C5, line(pt(0, 1), pt(1, 1))], [other(pt(9, 9))])),
      ).toBe('undefined: other(point(9, 9)) needs the point on the circle');
      expect(
        reason(
          choose(F, 'intersect', [C5, call('circle', [pt(6, 0), pt(3, 4)])], [other(pt(9, 9))]),
        ),
      ).toBe('undefined: other(point(9, 9)) needs the point on the first circle');
      // Both candidates behind a ray: the reason names the ray.
      expect(reason(choose(F, 'intersect', [call('ray', [pt(6, 0), pt(7, 0)]), C5]))).toBe(
        'undefined: no intersection: it lies outside the ray',
      );
    }
    expect(
      reason(
        choose(FloatField, 'intersect', [
          call('segment', [pt(0, 0), pt(1 + 1e-8, 0)]),
          line(pt(1, -1), pt(1, 1)),
        ]),
      ),
    ).toBe('undefined: ambiguous: the intersection is within the band of an end of the segment');
    expect(
      reason(
        choose(
          FloatField,
          'intersect',
          [call('segment', [pt(5, 0), pt(-5 - 5e-8, 0)]), C5],
          [other(pt(5, 0))],
        ),
      ),
    ).toBe(
      'undefined: ambiguous: the other intersection is within the band of an end of the segment',
    );
  });

  it('a ray that meets a circle once needs no selector (the range is applied before counting)', () => {
    for (const F of ORDERED) {
      expect(plain(F, choose(F, 'intersect', [call('ray', [pt(0, 0), pt(4, 3)]), C5]))).toEqual([
        4, 3,
      ]);
      expect(plain(F, choose(F, 'intersect', [C5, call('ray', [pt(0, 0), pt(-4, -3)])]))).toEqual([
        -4, -3,
      ]);
    }
  });

  it('exact tangency of circles with irrational radii: the double point over Q (sign of D) and mod p', () => {
    // r₁ = r₂ = √2, centres 2√2 apart: externally tangent at (1, 1).
    const c1 = call('circle', [pt(0, 0), pt(1, 1)]);
    const c2 = call('circle', [pt(2, 2), pt(1, 1)]);
    expect(plain(RationalField, choose(RationalField, 'intersect', [c1, c2]))).toEqual([1, 1]);
    expect(plain(FloatField, choose(FloatField, 'intersect', [c1, c2]))).toEqual([1, 1]);
    expect(choose(ModPField, 'intersect', [c1, c2])).toEqual({ kind: 'point', x: 1n, y: 1n });
    // Internally tangent with irrational radii: r₁ = 2√2, r₂ = √2, centres √2 apart.
    const big = call('circle', [pt(0, 0), pt(2, 2)]);
    const small = call('circle', [pt(1, 1), pt(2, 2)]);
    expect(plain(RationalField, choose(RationalField, 'intersect', [big, small]))).toEqual([2, 2]);
    expect(plain(RationalField, choose(RationalField, 'intersect', [small, big]))).toEqual([2, 2]);
    // Apart and inside with irrational radii, decided exactly.
    expect(
      reason(choose(RationalField, 'intersect', [c1, call('circle', [pt(3, 3), pt(2, 2)])])),
    ).toBe('undefined: no intersection: the circles are apart');
    expect(
      reason(choose(RationalField, 'intersect', [big, call('circle', [pt(1, 0), pt(1, 1)])])),
    ).toBe('undefined: no intersection: one circle lies inside the other');
  });

  it('a degenerate circle or line in either position', () => {
    const bad: Value<number> = { kind: 'circle', c: { x: 0, y: 0 }, r2: 0, arc: null };
    const good: Value<number> = { kind: 'circle', c: { x: 9, y: 0 }, r2: 25, arc: null };
    const flat: Value<number> = {
      kind: 'line',
      p: { x: 0, y: 0 },
      d: { x: 0, y: 0 },
      lo: null,
      hi: null,
      chiral: false,
    };
    const fine: Value<number> = { ...flat, d: { x: 1, y: 0 } };
    const P: Value<number> = { kind: 'point', x: 20, y: 0 };
    const cases: [string, Value<number>[], string][] = [
      ['intersect', [bad, good], 'the circle has no positive radius'],
      ['intersect', [good, bad], 'the circle has no positive radius'],
      ['intersect', [fine, bad], 'the circle has no positive radius'],
      ['intersect', [flat, good], 'the line has no direction'],
      ['tangent_point', [P, bad], 'the circle has no positive radius'],
      ['tangent_from', [P, bad], 'the circle has no positive radius'],
    ];
    for (const [tool, args, why] of cases) {
      expect(must(REGISTRY.get(tool)).compute(FloatField, args, { scale: 1 }), tool).toEqual({
        kind: 'undefined',
        reason: why,
      });
    }
  });
});
