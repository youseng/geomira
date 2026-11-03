/**
 * ADR-0054 (mutation shard kernel-h: tools/conic-conic.ts): conic ∩ conic's behaviour the Run
 * 16c tests left open. The pair counts the common points (one to four); other(P, Q, R) refuses
 * two points within the band of each other (ambiguous) or within EPS (not distinct), a fourth
 * point within the band of infinity (ambiguous) or beyond it (at infinity), and a call without
 * three points; the curves are named in the refusals (first/second, conic/circle); an invalid
 * second curve is refused; in floats nearly coincident conics refuse other(P, Q, R) too, while
 * over Q a near coincidence is not one; and two conics without a known point far from the
 * world origin are met in a frame at their vertices.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { makeConic, type Coeffs } from '../src/conic';
import { call, type Expr, type Selector } from '../src/expr';
import { conicConicPair, fourthPoint, type Round } from '../src/tools/conic-conic';
import type { EvalContext } from '../src/tool';
import type { Value, Vec } from '../src/value';
import { reason } from './helpers/degenerate';
import { choose } from './helpers/degenerate-branch';
import { circ } from './helpers/degenerate-circles';
import { ELL } from './helpers/degenerate-conics';
import { pt } from './helpers/doc';

type Q = Coeffs<number>;
const CTX: EvalContext = { scale: 4 };
const F = FloatField;
const v = (x: number, y: number): Vec<number> => ({ x, y });
const near = (p: Expr): Selector => ({ kind: 'near', p });
const other3 = (p: Expr, q: Expr, r: Expr): Selector => ({ kind: 'other', p, rest: [q, r] });

function conicOf(q: Q, ctx: EvalContext = CTX): Round<number> {
  const k = makeConic(F, q, undefined, ctx);
  if (k.kind !== 'conic') throw new Error(k.reason);
  return k;
}
const circleOf = (cx: number, cy: number, r2: number): Round<number> => ({
  kind: 'circle',
  c: v(cx, cy),
  r2,
  arc: null,
});
const why = <T>(x: Value<T> | Vec<T>): string =>
  'kind' in x && (x.kind === 'undefined' || x.kind === 'inexact') ? x.reason : JSON.stringify(x);

/** The product of the lines through (p, q) and (r, s), as coefficients. */
function lines(p: Vec<number>, q: Vec<number>, r: Vec<number>, s: Vec<number>): Q {
  const form = (a: Vec<number>, b: Vec<number>) =>
    [b.y - a.y, a.x - b.x, a.y * b.x - a.x * b.y] as const;
  const [a1, b1, c1] = form(p, q);
  const [a2, b2, c2] = form(r, s);
  return [
    a1 * a2,
    (a1 * b2 + a2 * b1) / 2,
    b1 * b2,
    (a1 * c2 + a2 * c1) / 2,
    (b1 * c2 + b2 * c1) / 2,
    c1 * c2,
  ];
}
const plus = (q: Q, k: number, p: Q): Q => [
  q[0] + k * p[0],
  q[1] + k * p[1],
  q[2] + k * p[2],
  q[3] + k * p[3],
  q[4] + k * p[4],
  q[5] + k * p[5],
];

const ELLQ: Q = [1, 0, 4, 0, 0, -4];

describe('the pair counts the common points', () => {
  for (const [what, k2, n] of [
    ['a circle touching once', circleOf(0, 2, 1), 1],
    ['a circle touching twice', circleOf(0, 0, 1), 2],
    ['a circle touching once and crossing twice', circleOf(0.5, 0, 2.25), 3],
    ['a circle crossing four times', circleOf(0, 0, 2.25), 4],
  ] as const)
    it(`${what}: ${String(n)}`, () => {
      const pair = conicConicPair(F, conicOf(ELLQ), k2, CTX);
      if ('kind' in pair) throw new Error(pair.reason);
      expect(pair.count()).toBe(n);
      const list = pair.list(n);
      expect('kind' in list ? list.reason : list.length).toBe(n);
    });

  it('no common point: Undefined', () => {
    const pair = conicConicPair(F, conicOf(ELLQ), circleOf(10, 0, 1), CTX);
    if ('kind' in pair) throw new Error(pair.reason);
    expect(why(pair.count() as Value<number>)).toBe('no intersection: the conics do not meet');
  });

  it('other(P, Q, R) called without three points', () => {
    const pair = conicConicPair(F, conicOf(ELLQ), circleOf(0, 0, 2.25), CTX);
    if ('kind' in pair) throw new Error(pair.reason);
    expect(why(pair.other?.point(v(2, 0)) ?? v(0, 0))).toBe('other(P, Q, R) needs three points');
    expect(why(pair.other?.point(v(2, 0), v(0, 1)) ?? v(0, 0))).toBe(
      'other(P, Q, R) needs three points',
    );
  });
});

describe('fourthPoint: the band', () => {
  // xy = 1 (q1) and q1 + (PQ)(RS), through P, Q, R on it and S = (s, 1/s).
  const HQ: Q = [0, 0.5, 0, 0, 0, -1];
  const [P, Qp, R] = [v(1, 1), v(2, 0.5), v(-1, -1)];
  const through = (s: number) => plus(HQ, 1, lines(P, Qp, R, v(s, 1 / s)));

  it('two of the points within EPS of each other: not three distinct points', () => {
    for (const [a, b] of [
      [P, v(1 + 1e-12, 1)],
      [Qp, v(2, 0.5 + 1e-12)],
    ] as const)
      expect(why(fourthPoint(F, HQ, through(5), [a, b, R], CTX))).toBe(
        'other(P, Q, R) needs three distinct points',
      );
  });

  it('two of the points within the band of each other: ambiguous', () => {
    expect(why(fourthPoint(F, HQ, through(5), [P, v(1 + 1e-7, 1), R], CTX))).toBe(
      'ambiguous: other(P, Q, R): two of the points are within the band of each other',
    );
    expect(why(fourthPoint(F, HQ, through(5), [P, Qp, v(2, 0.5 + 1e-7)], CTX))).toBe(
      'ambiguous: other(P, Q, R): two of the points are within the band of each other',
    );
  });

  it('the fourth point: found, within the band of infinity (ambiguous), at infinity', () => {
    const S = fourthPoint(F, HQ, through(5), [P, Qp, R], CTX);
    expect('kind' in S ? S.reason : [S.x, S.y]).toEqual([
      expect.closeTo(5, 9),
      expect.closeTo(0.2, 9),
    ]);
    expect(why(fourthPoint(F, HQ, through(1e8), [P, Qp, R], CTX))).toBe(
      'ambiguous: the fourth common point is within the band of infinity',
    );
    expect(why(fourthPoint(F, HQ, through(1e12), [P, Qp, R], CTX))).toBe(
      'the fourth common point is at infinity',
    );
  });
});

describe('conic ∩ conic through the tools', () => {
  const K = call('conic', [pt(0, 0), pt(4, 0), pt(0, 3), pt(3, 5), pt(-1, 2)]);
  const K2 = call('conic', [pt(0, 0), pt(4, 0), pt(0, 3), pt(3, 5), pt(2, -2)]);
  const C = call('circle', [pt(0, 0), pt(4, 0), pt(0, 3)]);

  it('the refusals name the curve: first or second, conic or circle', () => {
    // (3, 5) lies on K and K2 but not on the circle through (0, 0), (4, 0), (0, 3).
    const [O, A, B, D] = [pt(0, 0), pt(4, 0), pt(0, 3), pt(3, 5)];
    expect(reason(choose(F, 'intersect', [K, C], [other3(O, A, D)]))).toBe(
      'undefined: other(point(0, 0), point(4, 0), point(3, 5)) needs the point on the second circle',
    );
    expect(reason(choose(F, 'intersect', [C, K], [other3(O, A, D)]))).toBe(
      'undefined: other(point(0, 0), point(4, 0), point(3, 5)) needs the point on the first circle',
    );
    // (2, −2) lies on K2 only.
    expect(reason(choose(F, 'intersect', [K, K2], [other3(O, A, pt(2, -2))]))).toBe(
      'undefined: other(point(0, 0), point(4, 0), point(2, -2)) needs the point on the first conic',
    );
    expect(reason(choose(F, 'intersect', [K2, K], [other3(O, B, pt(2, -2))]))).toBe(
      'undefined: other(point(0, 0), point(0, 3), point(2, -2)) needs the point on the second conic',
    );
  });

  it('an arc does not change the selector rule: no selector → add a selector', () => {
    // A two-candidate pair with a segment, ray or arc lists before it asks for a selector
    // (Pair.ranged); conic ∩ conic asks for one whatever the count, arc or not (ADR-0054).
    const arc = call('arc', [pt(2, 0), pt(0, 1), pt('-6/5', '4/5')]);
    for (const Fd of [F, RationalField] as Field<unknown>[])
      for (const args of [
        [ELL, arc],
        [arc, ELL],
      ])
        expect(reason(choose(Fd, 'intersect', args))).toBe(
          'undefined: ambiguous: add a selector: conic ∩ conic has up to four intersections (for example other(P, Q, R), near(P), same_side(Q, l))',
        );
  });

  it('an invalid second curve is refused', () => {
    const line5 = call('conic', [pt(0, 0), pt(1, 0), pt(2, 0), pt(0, 1), pt(0, 2)]);
    for (const Fd of [F, RationalField] as Field<unknown>[]) {
      const bad = reason(choose(Fd, 'intersect', [ELL, line5], [near(pt(0, 0))]));
      expect(bad).toMatch(/^undefined: /u);
      expect(bad).toBe(reason(choose(Fd, 'intersect', [line5, ELL], [near(pt(0, 0))])));
      expect(
        reason(choose(Fd, 'intersect', [ELL, circ(pt(0, 0), pt(0, 0))], [near(pt(0, 0))])),
      ).toMatch(/^undefined: /u);
    }
  });

  it('nearly coincident conics: other(P, Q, R) refuses them in floats; over Q they differ', () => {
    // ELL and the conic through its points (±2, 0), (0, ±1) and (6/5 + δ, 4/5).
    const moved = (dx: string) =>
      call('conic', [pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt(dx, '4/5')]);
    const ABC = other3(pt(2, 0), pt(0, 1), pt(-2, 0));
    expect(reason(choose(F, 'intersect', [ELL, moved('1.20000002')], [ABC]))).toBe(
      'undefined: ambiguous: the conics nearly coincide',
    );
    expect(reason(choose(F, 'intersect', [ELL, moved('1.2000000000001')], [ABC]))).toBe(
      'undefined: the conics coincide',
    );
    // Over Q they are two conics: the fourth point is (0, −1), exactly; no exact list.
    expect(choose(RationalField, 'intersect', [ELL, moved('1.20000002')], [ABC])).toEqual({
      kind: 'point',
      x: RationalField.zero,
      y: RationalField.neg(RationalField.one),
    });
    expect(
      reason(choose(RationalField, 'intersect', [ELL, moved('1.20000002')], [near(pt(0, 0))])),
    ).toMatch(/^inexact: the common points of two conics are roots of a quartic/u);
  });
});

describe('a frame at the curves for conics without a known point', () => {
  // ELL and the circle x² + y² = 5/2 about (u, u), both as conics without a known point (a
  // circle that is a conic value: the image of an unanchored circle by a similarity). Their
  // common points are (±√2, ±√(1/2)) from (u, u). The frame must start at the curves: from the
  // world origin, or halfway to it, the pencil misreads them far out (u = 10⁵ at scale 4: "the
  // conics do not meet" before the fix, when the circle came first: it has no distinct vertex).
  const shifted =
    (u: number) =>
    ([a, b, c, d, e, f]: Q): Q => [
      a,
      b,
      c,
      d - a * u - b * u,
      e - b * u - c * u,
      a * u * u + 2 * b * u * u + c * u * u - 2 * d * u - 2 * e * u + f,
    ];
  const WANT = [
    [-Math.SQRT2, -Math.SQRT1_2],
    [-Math.SQRT2, Math.SQRT1_2],
    [Math.SQRT2, -Math.SQRT1_2],
    [Math.SQRT2, Math.SQRT1_2],
  ] as const;

  for (const [u, scale, tol] of [
    [1e5, 4, 1e-5],
    [2 ** 23, 1, 0.05],
  ] as const)
    it(`about (${String(u)}, ${String(u)}) at scale ${String(scale)}, in either order`, () => {
      const ctx: EvalContext = { scale };
      const [k1, k2] = [
        conicOf(shifted(u)(ELLQ), ctx),
        conicOf(shifted(u)([1, 0, 1, 0, 0, -2.5]), ctx),
      ];
      for (const [a, b] of [
        [k1, k2],
        [k2, k1],
      ] as const) {
        const pair = conicConicPair(F, a, b, ctx);
        if ('kind' in pair) throw new Error(pair.reason);
        const list = pair.list(4);
        if ('kind' in list) throw new Error(list.reason);
        const got = list.map((p) => [p.at.x - u, p.at.y - u]);
        expect(got, a === k1 ? 'ellipse first' : 'circle first').toHaveLength(4);
        for (const [x, y] of WANT)
          expect(
            Math.min(...got.map(([p, q]) => Math.hypot((p ?? 0) - x, (q ?? 0) - y))),
          ).toBeLessThan(tol);
      }
    });

  /** The common points of two conics without a known point, both orders, minus (u, u). */
  function both(q1: Q, q2: Q, u: number): number[][][] {
    const ctx: EvalContext = { scale: 4 };
    const [k1, k2] = [conicOf(shifted(u)(q1), ctx), conicOf(shifted(u)(q2), ctx)];
    return [
      [k1, k2],
      [k2, k1],
    ].map(([a, b]) => {
      const pair = conicConicPair(F, a ?? k1, b ?? k2, ctx);
      if ('kind' in pair) throw new Error(pair.reason);
      const list = pair.list(4);
      if ('kind' in list) throw new Error(list.reason);
      return list.map((p) => [p.at.x - u, p.at.y - u]);
    });
  }
  const close = (got: number[][], want: readonly (readonly [number, number])[]) => {
    expect(got).toHaveLength(want.length);
    for (const [x, y] of want)
      expect(Math.min(...got.map(([p, q]) => Math.hypot((p ?? 0) - x, (q ?? 0) - y)))).toBeLessThan(
        1e-5,
      );
  };

  it('a hyperbola whose vertices lie on its second axis (x² − y² = −1) and a circle', () => {
    // x² − y² + 1 = 0 and x² + y² = 3 meet at (±1, ±√2); the hyperbola has no real vertex on
    // the x-axis (its first eigen-direction), so its vertex is (0, ±1).
    const R2 = Math.SQRT2;
    for (const got of both([1, 0, -1, 0, 0, 1], [1, 0, 1, 0, 0, -3], 1e5))
      close(got, [
        [-1, -R2],
        [-1, R2],
        [1, -R2],
        [1, R2],
      ]);
  });

  it('a parabola (no centre, no vertex there) and a circle', () => {
    // y = x² and x² + (y − 1)² = 1 meet at (0, 0) (touching) and at (±1, 1).
    for (const got of both([1, 0, 0, 0, -0.5, 0], [1, 0, 1, 0, -1, 0], 10))
      close(got, [
        [-1, 1],
        [0, 0],
        [1, 1],
      ]);
  });
});

describe('the pair refuses invalid curves and names arcs', () => {
  it('an invalid curve, first or second (hand-built values)', () => {
    const lines: Round<number> = { kind: 'conic', a: 0, b: 0.5, c: 0, d: 0, e: 0, f: 0 };
    const point: Round<number> = circleOf(0, 0, 0);
    const ok = conicOf(ELLQ);
    for (const bad of [lines, point]) {
      const one = conicConicPair(F, ok, bad, CTX);
      const two = conicConicPair(F, bad, ok, CTX);
      expect('kind' in one ? one.kind : 'pair').toBe('undefined');
      expect('kind' in two ? two.kind : 'pair').toBe('undefined');
      expect(one).toEqual(two);
    }
  });

  it('other(P, Q, R) with the fourth point off the arc: the other intersection is outside it', () => {
    // The circle through (2, 0), (0, 1), (−6/5, 4/5) meets ELL a fourth time at (−8/5, 3/5),
    // beyond the end of the arc from (2, 0) through (0, 1) to (−6/5, 4/5).
    const [A, B, C] = [pt(2, 0), pt(0, 1), pt('-6/5', '4/5')];
    const full = choose(F, 'intersect', [ELL, call('circle', [A, B, C])], [other3(A, B, C)]);
    expect(full.kind === 'point' ? [full.x, full.y] : reason(full)).toEqual([
      expect.closeTo(-1.6, 12),
      expect.closeTo(0.6, 12),
    ]);
    const r = reason(choose(F, 'intersect', [ELL, call('arc', [A, B, C])], [other3(A, B, C)]));
    expect(r).toMatch(/^undefined: .*other intersection/u);
  });
});
