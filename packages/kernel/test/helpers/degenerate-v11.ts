/**
 * Degenerate cases of the v1.1 tools (Run 13, ADR-0031): spiral_center, isogonal,
 * symmedian, pole, radical_center, arc, and the arc cases that intersect, other, on,
 * tangent_point and tangent_from gained. Spread into degenerate.test.ts's table.
 * Fixtures: the upper half circle U = arc((5, 0), (0, 5), (−5, 0)) of C5.
 */
import { FloatField } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { ModPField } from '@geomira/num/modp';
import { rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { A, B, C, FIELDS, ORDERED, at, line, plain, reason, seg } from './degenerate';
import { ALONG_M, ALONG_P, ORIENT_M, ORIENT_P, choose } from './degenerate-branch';
import { C5, O0, circ, shape } from './degenerate-circles';
import { Builder, REGISTRY, contextOf, num, pt } from './doc';

const arc = (a: Expr, b: Expr, c: Expr): Expr => call('arc', [a, b, c]);
const U = arc(pt(5, 0), pt(0, 5), pt(-5, 0));
const DIAG = line(pt(-4, -3), pt(4, 3));
const circle = (c: Expr, r: number): Expr => call('circle', [c, num(r)]);

export const V11_CASES: Record<string, Record<string, () => void>> = {
  spiral_center: {
    'D − C = B − A (a translation; four equal points included) → Undefined': () => {
      const msg =
        'undefined: the spiral similarity is a translation (D − C = B − A): it has no center';
      for (const F of FIELDS) {
        expect(reason(at(F, 'spiral_center', A, B, pt(3, 3), pt(6, 7)))).toBe(msg);
        expect(reason(at(F, 'spiral_center', A, A, A, A))).toBe(msg);
      }
      expect(at(RationalField, 'spiral_center', A, B, pt(3, 3), pt(6, '7.000000000001')).kind).toBe(
        'point',
      );
    },
    'A = B, C = D, A = C or B = D → that point': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'spiral_center', A, A, C, pt(9, 9)))).toEqual([1, 2]);
        expect(plain(F, at(F, 'spiral_center', A, B, C, C))).toEqual([-2, 5]);
        expect(plain(F, at(F, 'spiral_center', A, B, A, C))).toEqual([1, 2]);
        expect(plain(F, at(F, 'spiral_center', A, B, C, B))).toEqual([4, 6]);
      }
    },
  },
  isogonal: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'isogonal', pt(0, 1), A, B, A))).toBe(
          'undefined: coincident points: isogonal needs three distinct vertices',
        );
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'isogonal', pt(0, 1), A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: isogonal needs a non-degenerate triangle',
        );
    },
    'P a vertex → Undefined': () => {
      for (const F of FIELDS)
        for (const P of [A, B, C])
          expect(reason(at(F, 'isogonal', P, A, B, C))).toBe(
            'undefined: P is a vertex: its isogonal conjugate is not defined',
          );
    },
    'P on the circumcircle → Undefined (the conjugate is at infinity)': () => {
      // The circle through (5, 0), (0, 5), (−5, 0) is C5; (3, −4) is on it.
      const [P, Q, R] = [pt(5, 0), pt(0, 5), pt(-5, 0)];
      for (const F of FIELDS)
        expect(reason(at(F, 'isogonal', pt(3, -4), P, Q, R))).toBe(
          'undefined: P is on the circumcircle: its isogonal conjugate is at infinity',
        );
      expect(at(RationalField, 'isogonal', pt(3, '-4.0000001'), P, Q, R).kind).toBe('point');
    },
    'P on a side line (not a vertex) → the opposite vertex': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'isogonal', call('midpoint', [B, C]), A, B, C))).toEqual([1, 2]);
        // (2, 6) is on line CA (y = 3x) of (0, 0), (4, 0), (1, 3): the conjugate is B.
        expect(plain(F, at(F, 'isogonal', pt(2, 6), pt(0, 0), pt(4, 0), pt(1, 3)))).toEqual([4, 0]);
      }
    },
  },
  symmedian: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'symmedian', A, B, B))).toBe(
          'undefined: coincident points: symmedian needs three distinct vertices',
        );
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'symmedian', A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: symmedian needs a non-degenerate triangle',
        );
      expect(at(RationalField, 'symmedian', A, B, pt(7, '10.000000000001')).kind).toBe('line');
    },
  },
  pole: {
    'l through the center → Undefined (the pole is at infinity)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'pole', line(pt(-1, -1), pt(2, 2)), C5))).toBe(
          'undefined: l passes through the center: its pole is at infinity',
        );
    },
    'l tangent to c → the touch point': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'pole', line(pt(5, -3), pt(5, 7)), C5))).toEqual([5, 0]);
        expect(plain(F, at(F, 'pole', call('tangent', [pt(3, 4), C5]), C5))).toEqual([3, 4]);
      }
    },
    'a segment or ray is extended to its carrier line': () => {
      for (const F of ORDERED)
        expect(plain(F, at(F, 'pole', seg(pt(10, 0), pt(10, 1)), C5))).toEqual([2.5, 0]);
    },
  },
  radical_center: {
    'two concentric circles → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'radical_center', C5, circle(pt(9, 9), 1), circle(O0, 2)))).toBe(
          'undefined: concentric circles',
        );
    },
    'collinear centers → Undefined (parallel radical axes)': () => {
      const cs = [C5, circle(pt(6, 0), 2), circle(pt(-7, 0), 3)];
      for (const F of FIELDS)
        expect(reason(at(F, 'radical_center', ...cs))).toBe(
          'undefined: the centers are collinear: the radical axes are parallel',
        );
    },
    'coaxal circles → Undefined (the radical axes coincide)': () => {
      // Three circles through (3, ±4): centres on the x-axis.
      const cs = [C5, circ(pt(6, 0), pt(3, 4)), circ(pt(-3, 0), pt(3, 4))];
      for (const F of FIELDS)
        expect(reason(at(F, 'radical_center', ...cs))).toBe(
          'undefined: the circles are coaxal: their radical axes coincide',
        );
    },
  },
  arc: {
    'coincident points → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'arc', A, B, A))).toBe(
          'undefined: coincident points: arc(A, B, C) needs three distinct points',
        );
    },
    'collinear points → Undefined (use segment)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'arc', A, pt(7, 10), B))).toBe(
          'undefined: collinear points: arc(A, B, C) needs three points not on one line (use segment)',
        );
    },
    'the orientation mod p → Inexact': () => {
      expect(reason(at(ModPField, 'arc', pt(5, 0), pt(0, 5), pt(-5, 0)))).toMatch(
        /^inexact: the orientation of an arc needs an order, which .* lacks$/,
      );
      expect(shape(RationalField, at(RationalField, 'arc', pt(5, 0), pt(0, 5), pt(-5, 0)))).toEqual(
        { c: [0, 0], r2: 25, anchor: [5, 0] },
      );
    },
  },
};

/** The arc cases of tools that existed before Run 13 (each declared on its tool). */
export const ARC_INTERSECT_CASES: Record<string, () => void> = {
  'a candidate outside an arc is not a candidate (none left → Undefined)': () => {
    for (const F of ORDERED) {
      // DIAG meets C5 at (4, 3) and (−4, −3): only (4, 3) is on the upper half.
      expect(plain(F, choose(F, 'intersect', [DIAG, U], [ALONG_P]))).toEqual([4, 3]);
      expect(reason(choose(F, 'intersect', [DIAG, U], [ALONG_M]))).toMatch(/^undefined: no /);
      expect(
        plain(F, choose(F, 'intersect', [U, call('circle', [pt(6, 0), pt(3, 4)])], [ORIENT_P])),
      ).toEqual([3, 4]);
      expect(reason(choose(F, 'intersect', [line(pt(-9, -3), pt(9, -3)), U], [ALONG_P]))).toBe(
        'undefined: no intersection: it lies outside the arc',
      );
    }
  },
  'a candidate within the band of an arc end → Undefined (ambiguous)': () => {
    // y = 5·10⁻⁷ meets C5 next to (±5, 0), within BAND·scale of U's chord: ambiguous in
    // floats; over Q the side is exact (both candidates are on U).
    const near = line(pt(-9, '0.0000005'), pt(9, '0.0000005'));
    expect(reason(choose(FloatField, 'intersect', [near, U], [ALONG_P]))).toBe(
      'undefined: ambiguous: the intersection is within the band of an end of the arc',
    );
    expect(choose(RationalField, 'intersect', [near, U], [ALONG_P]).kind).not.toBe('undefined');
  },
};

export const ARC_OTHER_CASES: Record<string, () => void> = {
  'the other point outside an arc → Undefined': () => {
    for (const F of ORDERED) {
      expect(reason(at(F, 'other', DIAG, U, pt(4, 3)))).toBe(
        'undefined: no other intersection: it lies outside the arc',
      );
      expect(plain(F, at(F, 'other', DIAG, U, pt(-4, -3)))).toEqual([4, 3]);
      expect(reason(at(F, 'other', call('circle', [pt(6, 0), pt(3, 4)]), U, pt(3, 4)))).toBe(
        'undefined: no other intersection: it lies outside the arc',
      );
    }
  },
  'a hand-built arc mod p → Inexact': () => {
    const v = direct(ModPField, 'other', [modpLine(), modpArc(), modpPoint(4n, 3n)]);
    expect(reason(v)).toMatch(/^inexact: whether the other intersection lies on the arc/);
  },
};

export const ARC_ON_CASES: Record<string, () => void> = {
  'on an arc, the point is clamped to the nearer end': () => {
    for (const F of ORDERED) {
      // U's anchor is (5, 0): (1 : 1) is (0, 5), on U; (2 : −1) is (3, −4), below U and
      // nearer (5, 0); (1 : −2) is (−3, −4), nearer (−5, 0).
      expect(plain(F, at(F, 'on', U, num(1), num(1)))).toEqual([0, 5]);
      expect(plain(F, at(F, 'on', U, num(2), num(-1)))).toEqual([5, 0]);
      expect(plain(F, at(F, 'on', U, num(1), num(-2)))).toEqual([-5, 0]);
    }
    // By angle (FloatField; −30° is not rational over Q): (5·cos 30°, −2.5) is nearer (5, 0).
    expect(plain(FloatField, at(FloatField, 'on', U, num(-30)))).toEqual([5, 0]);
  },
  'on an arc, both ends equally far → Undefined (ambiguous)': () => {
    // (1 : −1) is (0, −5), as far from (5, 0) as from (−5, 0).
    for (const F of ORDERED)
      expect(reason(at(F, 'on', U, num(1), num(-1)))).toBe(
        'undefined: ambiguous: the glider is equally far from both ends of the arc',
      );
  },
  'a hand-built arc mod p → Inexact': () => {
    const v = direct(ModPField, 'on', [modpArc(), modpNum(1n), modpNum(1n)]);
    expect(reason(v)).toBe(
      `inexact: clamping to an arc needs an order, which ${ModPField.name} lacks`,
    );
  },
};

export const ARC_TANGENT_CASES: Record<string, () => void> = {
  'a touch point outside an arc is not a candidate': () => {
    // From (5, −5) the touch points of C5 are (5, 0), an end of U, and (0, −5), below it.
    for (const F of ORDERED) {
      for (const tool of ['tangent_point', 'tangent_from']) {
        const got = [ORIENT_P, ORIENT_M].map((s) => choose(F, tool, [pt(5, -5), U], [s]));
        expect(got.filter((v) => v.kind !== 'undefined')).toHaveLength(1);
        const off = got.find((v) => v.kind === 'undefined');
        expect(off && reason(off)).toMatch(/^undefined: no (touch point|tangent) satisfies orient/);
      }
      const T = [ORIENT_P, ORIENT_M].map((s) =>
        plain(F, choose(F, 'tangent_point', [pt(5, -5), U], [s])),
      );
      expect(T).toContainEqual([5, 0]);
    }
  },
};

/** A tool's compute called directly (values no document can build: arcs mod p). */
function direct(F: typeof ModPField, tool: string, args: Value<bigint>[]): Value<bigint> {
  const spec = REGISTRY.get(tool);
  if (spec === undefined) throw new Error(tool);
  return spec.compute(F, args, contextOf(new Builder().doc));
}

function modpNum(n: bigint): Value<bigint> {
  const v = ModPField.fromRational(rational(n));
  if (isInexact(v)) throw new Error(v.reason);
  return { kind: 'number', v };
}

const lift = (n: number): bigint => {
  const v = ModPField.fromRational(rational(BigInt(n)));
  if (isInexact(v)) throw new Error(v.reason);
  return v;
};

function modpPoint(x: bigint, y: bigint): Value<bigint> {
  return { kind: 'point', x: lift(Number(x)), y: lift(Number(y)) };
}

/** U mod p, as a hand-built value. */
function modpArc(): Value<bigint> {
  const P = (x: number, y: number) => ({ x: lift(x), y: lift(y) });
  return {
    kind: 'circle',
    c: P(0, 0),
    r2: lift(25),
    arc: { from: P(5, 0), to: P(-5, 0) },
    anchor: P(5, 0),
  };
}

/** DIAG mod p. */
function modpLine(): Value<bigint> {
  return {
    kind: 'line',
    p: { x: lift(-4), y: lift(-3) },
    d: { x: lift(8), y: lift(6) },
    lo: null,
    hi: null,
    chiral: false,
  };
}
