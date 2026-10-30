/**
 * ADR-0054 (mutation shard kernel-b: tools/conic-pairs.ts): line ∩ conic and the tangents from
 * a point at the edges the Run 16c tests left open. A short direction vector is decided on the
 * normalized α and β (never on their absolute size); a ray or segment holding one candidate
 * needs no selector, a full line does; an invalid conic is refused with a valid line; other(P)
 * names the curve P is not on; the touch point orient(+) is on the left of P → mid, wherever P
 * is; lineConicMeet reports a single point in an asymptotic direction as simple, and two
 * points in the carrier's direction.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Coeffs } from '../src/conic';
import { call, type Expr, type Selector } from '../src/expr';
import { lineConicMeet, lineConicPair } from '../src/tools/conic-pairs';
import type { Conic, Line } from '../src/value';
import { plain, reason } from './helpers/degenerate';
import { choose } from './helpers/degenerate-branch';
import { ELL, HYP } from './helpers/degenerate-conics';
import { pt } from './helpers/doc';

const F = FloatField;
const line = (a: Expr, b: Expr) => call('line', [a, b]);
const near = (p: Expr): Selector => ({ kind: 'near', p });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });
const BAD = call('conic', [pt(0, 0), pt(1, 0), pt(2, 0), pt(0, 1), pt(0, 2)]);

describe('line ∩ conic: decisions on the normalized coefficients', () => {
  it('a line through two points 10⁻⁵ apart meets the ellipse twice (α is tiny, not zero)', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[])
      expect(
        plain(
          Fd,
          choose(Fd, 'intersect', [line(pt(0, 0), pt('1/100000', 0)), ELL], [near(pt(3, 0))]),
        ),
      ).toEqual([2, 0]);
  });

  it('parallel to an asymptote, a short direction: one point (β is tiny, not zero)', () => {
    // x = 1/10000 is parallel to the asymptote x = 0 of xy = 1: one point, (1/10000, 10000).
    const l = line(pt('1/10000', 0), pt('1/10000', '1/1000000'));
    for (const Fd of [F, RationalField] as Field<unknown>[])
      expect(plain(Fd, choose(Fd, 'intersect', [l, HYP]))).toEqual([
        expect.closeTo(0.0001, 12),
        expect.closeTo(10000, 6),
      ]);
  });
});

describe('line ∩ conic: ranges and refusals', () => {
  it('a ray or a segment holding one candidate needs no selector; a full line does', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[]) {
      expect(plain(Fd, choose(Fd, 'intersect', [call('ray', [pt(0, 0), pt(1, 0)]), ELL]))).toEqual([
        2, 0,
      ]);
      expect(plain(Fd, choose(Fd, 'intersect', [ELL, call('ray', [pt(0, 0), pt(-1, 0)])]))).toEqual(
        [-2, 0],
      );
      expect(
        plain(Fd, choose(Fd, 'intersect', [call('segment', [pt(0, 0), pt(0, 3)]), ELL])),
      ).toEqual([0, 1]);
      expect(reason(choose(Fd, 'intersect', [line(pt(0, 0), pt(1, 0)), ELL]))).toMatch(
        /^undefined: ambiguous: add a selector/u,
      );
    }
  });

  it('an invalid conic with a valid line is refused, in either order', () => {
    for (const Fd of [F, RationalField] as Field<unknown>[]) {
      const r = reason(choose(Fd, 'intersect', [line(pt(0, 0), pt(1, 1)), BAD], [near(pt(0, 0))]));
      expect(r).toMatch(/^undefined: /u);
      expect(r).not.toMatch(/intersection/u);
      expect(
        reason(choose(Fd, 'intersect', [BAD, line(pt(0, 0), pt(1, 1))], [near(pt(0, 0))])),
      ).toBe(r);
    }
    // A hand-built conic value that is a pair of lines (xy = 0), with a valid line.
    const lines: Conic<number> = { kind: 'conic', a: 0, b: 0.5, c: 0, d: 0, e: 0, f: 0 };
    const l: Line<number> = {
      kind: 'line',
      p: { x: 0, y: 1 },
      d: { x: 1, y: 1 },
      lo: null,
      hi: null,
      chiral: false,
    };
    for (const first of [true, false]) {
      const pair = lineConicPair(F, l, lines, { scale: 4 }, first);
      expect('kind' in pair ? pair.reason : 'a pair').toBe(
        'degenerate conic: a pair of lines, a double line or a point',
      );
    }
  });

  it('other(P) names the curve P is not on', () => {
    const l = line(pt(-2, 0), pt(2, 0));
    const sel: Selector = { kind: 'other', p: pt(1, 0) };
    expect(reason(choose(F, 'intersect', [l, ELL], [sel]))).toBe(
      'undefined: other(point(1, 0)) needs the point on the conic',
    );
    expect(reason(choose(F, 'intersect', [ELL, l], [sel]))).toBe(
      'undefined: other(point(1, 0)) needs the point on the conic',
    );
    // Off both: the first curve of the call is named.
    const off: Selector = { kind: 'other', p: pt(0, 3) };
    expect(reason(choose(F, 'intersect', [l, ELL], [off]))).toBe(
      'undefined: other(point(0, 3)) needs the point on the line',
    );
    expect(reason(choose(F, 'intersect', [ELL, l], [off]))).toBe(
      'undefined: other(point(0, 3)) needs the point on the conic',
    );
  });
});

describe('the tangents from P to a conic', () => {
  const tp = (P: Expr, sels: Selector[], k: Expr = ELL) => choose(F, 'tangent_point', [P, k], sels);

  it('orient(+) is the touch point on the left of P → mid, from every side', () => {
    for (const [x, y, k] of [
      [0, 3, ELL],
      [0, -3, ELL],
      [5, 0, ELL],
      [-5, 0, ELL],
      [3, 2, ELL],
      [-3, -2, ELL],
      // xy = 1 from points between its branches and beyond them.
      [1, -1, HYP],
      [-1, 1, HYP],
      [2, -3, HYP],
      [0.5, 0.5, HYP],
      [-0.5, -0.5, HYP],
    ] as const) {
      const P = pt(x, y);
      const [plus, minus] = [tp(P, [orient(1)], k), tp(P, [orient(-1)], k)];
      if (plus.kind !== 'point' || minus.kind !== 'point') throw new Error(reason(plus));
      const mid = { x: (plus.x + minus.x) / 2, y: (plus.y + minus.y) / 2 };
      const cross = (mid.x - x) * (plus.y - y) - (mid.y - y) * (plus.x - x);
      expect(cross, `P = (${String(x)}, ${String(y)})`).toBeGreaterThan(0);
    }
  });

  it('other(X) names the curve X is not on: the conic, or the chord of contact', () => {
    const P = pt(0, 3);
    // (2, 0) is on the ellipse but not on the polar of (0, 3) (y = 1/3); (1, 1/3) the reverse.
    expect(reason(tp(P, [{ kind: 'other', p: pt(2, 0) }]))).toBe(
      'undefined: other(point(2, 0)) needs the point on the polar of P (the chord of contact)',
    );
    expect(reason(tp(P, [{ kind: 'other', p: pt(1, '1/3') }]))).toBe(
      'undefined: other(point(1, 1/3)) needs the point on the conic',
    );
  });
});

describe('lineConicMeet', () => {
  const CTX = { scale: 4 };
  it('one point in an asymptotic direction is simple; two points in the order of d', () => {
    // y = x² and the vertical line x = 1: one point, not a double one.
    const par: Coeffs<number> = [1, 0, 0, 0, -0.5, 0];
    expect(lineConicMeet(F, par, { x: 1, y: 0 }, { x: 0, y: 1 }, CTX)).toEqual({
      points: [{ x: 1, y: 1 }],
      double: false,
    });
    // The ellipse and the x-axis, in the order of d.
    const ell: Coeffs<number> = [1, 0, 4, 0, 0, -4];
    for (const s of [1, -1])
      expect(lineConicMeet(F, ell, { x: 0, y: 0 }, { x: s, y: 0 }, CTX)).toEqual({
        points: [
          { x: -2 * s, y: 0 },
          { x: 2 * s, y: 0 },
        ],
        double: false,
      });
  });
});
