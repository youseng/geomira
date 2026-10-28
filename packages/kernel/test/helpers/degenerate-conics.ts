/**
 * Degenerate cases of Run 16b's conic tools and of the conic overloads of existing tools
 * (ADR-0042), each a test keyed by the registry's text: CONIC_INTERSECT_CASES is spread into
 * degenerate.test.ts's `intersect` entry, CONIC_CASES after every other table (it merges the
 * earlier tables of the tools it extends). Fixtures: HYP the hyperbola xy = 1 (normal form
 * 2xy − 2 = 0, known point (1, 1)); ELL the ellipse x²/4 + y² = 1 (known point (2, 0)); PAR the
 * parabola y = x² (known point (0, 0)).
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, at, line, plain, reason } from './degenerate';
import { ALONG_M, ALONG_P, ORIENT_P, choose, other } from './degenerate-branch';
import { C5, circ } from './degenerate-circles';
import { GLIDER_CASES } from './degenerate-gliders';
import { PROJECTIVE_CASES, SEND_X } from './degenerate-projective';
import { ARC_ON_CASES, ARC_OTHER_CASES, ARC_TANGENT_CASES, V11_CASES } from './degenerate-v11';
import { TANGENT_CASES } from './degenerate-branch';
import { CIRCLE_CASES } from './degenerate-circles';
import { num, pt } from './doc';

const conic = (...ps: Expr[]): Expr => call('conic', ps);
export const HYP = conic(pt(1, 1), pt(2, '1/2'), pt(-1, -1), pt(4, '1/4'), pt('1/2', 2));
export const ELL = conic(pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt('6/5', '4/5'));
export const PAR = conic(pt(0, 0), pt(1, 1), pt(-1, 1), pt(2, 4), pt(-2, 4));

/** x² + 1e-8·y² − y = 0 (FloatField): ac − b² within the band of a parabola. */
const NEAR_PAR = conic(
  pt(0, 0),
  pt(Math.sqrt(1 - 1e-8), 1),
  pt(-Math.sqrt(1 - 1e-8), 1),
  pt(Math.sqrt(4 - 16e-8), 4),
  pt(-Math.sqrt(4 - 16e-8), 4),
);

/** A circle given as a conic (the identity map's image of C5). */
const ID = call('projective', [
  ...[pt(0, 0), pt(1, 0), pt(0, 1), pt(1, 1)],
  ...[pt(0, 0), pt(1, 0), pt(0, 1), pt(1, 1)],
]);
const C5_AS_CONIC = call('apply', [ID, C5]);

/** C5 sent by the map sending the line x = 5 (through its known point) to infinity. */
const NO_ANCHOR = call('apply', [call('send_to_infinity', [line(pt(5, 0), pt(5, 1))]), C5]);

const kindOf = (v: Value<unknown>): string => v.kind;

/** Whether a point value is at (x, y): exactly over Q, within 1e-9 relative in floats. */
function isAt<T>(
  F: { readonly kind: string; toNumber(x: T): number },
  v: Value<T>,
  x: number,
  y: number,
): boolean {
  if (v.kind !== 'point') return false;
  const [a, b] = [F.toNumber(v.x), F.toNumber(v.y)];
  const tol = F.kind === 'float' ? 1e-9 * Math.max(1, Math.abs(x), Math.abs(y)) : 0;
  return Math.abs(a - x) <= tol && Math.abs(b - y) <= tol;
}

export const CONIC_INTERSECT_CASES: Record<string, () => void> = {
  'line ∩ conic: the line misses the conic → Undefined': () => {
    for (const F of ORDERED)
      expect(reason(choose(F, 'intersect', [line(pt(0, 5), pt(1, 5)), ELL], [ALONG_P]))).toBe(
        'undefined: no intersection: the line misses the conic',
      );
    // Mod p "misses" is not decidable: two candidates, whose square roots are not evaluable.
    expect(choose(ModPField, 'intersect', [line(pt(0, 5), pt(1, 5)), ELL], [ALONG_P]).kind).toBe(
      'inexact',
    );
  },
  'line ∩ conic: tangency (the gap within the band) → the double point': () => {
    for (const F of FIELDS) {
      const v = choose(F, 'intersect', [line(pt(-3, 1), pt(3, 1)), ELL]);
      expect(v.kind).toBe('point');
      if (F !== ModPField) expect(isAt(F, v, 0, 1)).toBe(true);
    }
    // In floats a tangent line moved by 1e-12 is still tangent (the double point).
    const near = line(pt(-3, 1 + 1e-12), pt(3, 1 + 1e-12));
    expect(isAt(FloatField, choose(FloatField, 'intersect', [near, ELL], [ALONG_M]), 0, 1)).toBe(
      true,
    );
  },
  'line ∩ conic: an asymptotic direction (α within EPS) → the one finite common point (both along signs)':
    () => {
      for (const F of ORDERED)
        for (const s of [ALONG_P, ALONG_M])
          expect(isAt(F, choose(F, 'intersect', [line(pt(0, 1), pt(2, 1)), HYP], [s]), 1, 1)).toBe(
            true,
          );
      expect(choose(ModPField, 'intersect', [line(pt(0, 1), pt(2, 1)), HYP]).kind).toBe('point');
    },
  'line ∩ conic: an asymptote → Undefined (no finite common point)': () => {
    for (const F of FIELDS)
      expect(reason(choose(F, 'intersect', [line(pt(0, 0), pt(1, 0)), HYP], [ALONG_P]))).toBe(
        'undefined: no intersection: the line meets the conic only at infinity (an asymptote)',
      );
  },
  'line ∩ conic: α within the band of an asymptotic direction → Undefined (ambiguous)': () => {
    const l = line(pt(0, 1), pt(1, 1 + 1e-8));
    expect(reason(choose(FloatField, 'intersect', [l, HYP], [ALONG_P]))).toMatch(
      /^undefined: ambiguous: the line is within the band of an asymptotic direction/,
    );
    expect(choose(RationalField, 'intersect', [l, HYP], [ALONG_M]).kind).not.toBe('undefined');
  },
  'line ∩ conic: every decision is scale-free (the ellipse 10⁸ times larger gives the same points)':
    () => {
      const big = (x: number, y: number) => pt(x * 1e8, y * 1e8);
      const k = conic(big(2, 0), big(0, 1), big(-2, 0), big(0, -1), big(1.2, 0.8));
      const l = line(big(-3, 0), big(3, 0));
      expect(isAt(FloatField, choose(FloatField, 'intersect', [l, k], [ALONG_P]), 2e8, 0)).toBe(
        true,
      );
      expect(isAt(FloatField, choose(FloatField, 'intersect', [k, l], [ALONG_M]), -2e8, 0)).toBe(
        true,
      );
      expect(isAt(FloatField, choose(FloatField, 'other', [l, k, big(2, 0)]), -2e8, 0)).toBe(true);
    },
  'other(P) on line ∩ conic with an asymptotic direction → Undefined (the other point is at infinity)':
    () => {
      for (const F of FIELDS)
        expect(
          reason(choose(F, 'intersect', [line(pt(0, 1), pt(2, 1)), HYP], [other(pt(1, 1))])),
        ).toBe(
          'undefined: the other intersection is at infinity (the line has an asymptotic direction)',
        );
    },
};

const CONIC_OWN: Record<string, Record<string, () => void>> = {
  conic: {
    'two coincident points → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'conic', pt(1, 1), pt(1, 1), pt(-1, -1), pt(4, '1/4'), pt(0, 3)))).toBe(
          'undefined: coincident points: conic(A, B, C, D, E) needs five distinct points',
        );
    },
    'four collinear points → Undefined (no unique conic)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'conic', pt(0, 0), pt(1, 0), pt(2, 0), pt(3, 0), pt(0, 3)))).toBe(
          'undefined: four of the points are collinear: no unique conic passes through them',
        );
    },
    'three collinear points → Undefined (a pair of lines)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'conic', pt(0, 0), pt(1, 0), pt(2, 0), pt(0, 1), pt(1, 3)))).toBe(
          'undefined: three of the points are collinear: the conic through them is a pair of lines',
        );
      expect(
        at(RationalField, 'conic', pt(0, 0), pt(1, 0), pt(2, '1/10'), pt(0, 1), pt(1, 3)).kind,
      ).toBe('conic');
    },
    'a conic within the band of a pair of lines → Undefined (ambiguous)': () => {
      // A thin ellipse: semi-axes 10 and 2.4e-3, so its semi-latus rectum b²/a ≈ 5.8e-7 is
      // inside the band (scale ≈ 20), while no three of its points are collinear within EPS.
      const b = 2.4e-3;
      const ps = [0.3, 1.2, 2, 3.5, 5].map((t) => pt(10 * Math.cos(t), b * Math.sin(t)));
      expect(reason(at(FloatField, 'conic', ...ps))).toBe(
        'undefined: ambiguous: the conic is within the band of a pair of lines',
      );
      expect(
        at(
          FloatField,
          'conic',
          ...[0.3, 1.2, 2, 3.5, 5].map((t) => pt(10 * Math.cos(t), Math.sin(t))),
        ).kind,
      ).toBe('conic');
    },
  },
  conic_center: {
    'a parabola → the point at infinity of its axis': () => {
      for (const F of FIELDS) {
        const v = at(F, 'conic_center', PAR);
        expect(v.kind === 'ideal_point' && F.isZero(v.d.x, 'dimensionless', { scale: 1 })).toBe(
          true,
        );
      }
      for (const F of ORDERED) expect(isAt(F, at(F, 'conic_center', HYP), 0, 0)).toBe(true);
    },
    'a conic within the band of a parabola → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'conic_center', NEAR_PAR))).toBe(
        'undefined: ambiguous: the conic is within the band of a parabola',
      );
    },
  },
  conic_to_circle: {
    'a conic without a known point → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'conic_to_circle', NO_ANCHOR))).toBe(
          'undefined: conic_to_circle(k): the conic has no known point',
        );
    },
    'a circle as a conic → the identity': () => {
      for (const F of ORDERED) {
        const f = call('conic_to_circle', [C5_AS_CONIC]);
        expect(plain(F, at(F, 'apply', f, pt(1, 2)))).toEqual([1, 2]);
        expect(plain(F, at(F, 'apply', f, pt(-7, 3)))).toEqual([-7, 3]);
      }
    },
  },
  circle_to_centre: {
    'P on c → Undefined': () => {
      for (const F of ORDERED)
        expect(reason(at(F, 'circle_to_centre', C5, pt(3, 4)))).toBe(
          'undefined: circle_to_centre(c, P): P lies on c',
        );
    },
    'P within the band of c → Undefined (ambiguous)': () => {
      expect(reason(at(FloatField, 'circle_to_centre', C5, pt(5 - 1e-7, 0)))).toBe(
        'undefined: ambiguous: P is within the band of c',
      );
      expect(at(RationalField, 'circle_to_centre', C5, pt(5 - 1e-7, 0)).kind).toBe('inexact');
    },
    'P outside c → Undefined': () => {
      for (const F of ORDERED)
        expect(reason(at(F, 'circle_to_centre', C5, pt(6, 0)))).toBe(
          'undefined: circle_to_centre(c, P): P lies outside c: no projective map keeping c sends it to the center',
        );
    },
    'P = the center → the identity': () => {
      for (const F of ORDERED)
        expect(
          plain(F, at(F, 'apply', call('circle_to_centre', [C5, pt(0, 0)]), pt(1, 2))),
        ).toEqual([1, 2]);
    },
    'the square root not representable → Inexact over Q and mod p': () => {
      expect(at(RationalField, 'circle_to_centre', C5, pt(1, 2)).kind).toBe('inexact');
      expect(at(ModPField, 'circle_to_centre', C5, pt(1, 2)).kind).toBe('inexact');
      // 25·(25 − 9) = 400 is a square: exact over Q.
      expect(
        plain(
          RationalField,
          at(RationalField, 'apply', call('circle_to_centre', [C5, pt(3, 0)]), pt(3, 0)),
        ),
      ).toEqual([0, 0]);
    },
  },
};

const OTHER_CONIC: Record<string, () => void> = {
  'line and conic: an asymptotic direction → Undefined (the other point is at infinity)': () => {
    for (const F of FIELDS) {
      expect(reason(at(F, 'other', line(pt(0, 1), pt(2, 1)), HYP, pt(1, 1)))).toBe(
        'undefined: the other intersection is at infinity (the line has an asymptotic direction)',
      );
      const v = at(F, 'other', HYP, line(pt(0, 0), pt(1, 1)), pt(1, 1));
      expect(v.kind).toBe('point');
      if (F !== ModPField) expect(isAt(F, v, -1, -1)).toBe(true);
    }
  },
};

const TANGENT_CONIC: Record<string, () => void> = {
  'a conic: P not on k (the gap Q/|∇Q| as a length) → Undefined; within the band → ambiguous':
    () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'tangent', pt(2, 0), HYP))).toBe(
          'undefined: tangent(P, k) needs P on k',
        );
      expect(reason(at(FloatField, 'tangent', pt(1, 1 + 1e-8), HYP))).toMatch(
        /^undefined: ambiguous/,
      );
      for (const F of ORDERED) {
        const t = at(F, 'tangent', pt(1, 1), HYP);
        expect(t.kind === 'line' && t.chiral).toBe(true);
        expect(
          isAt(
            F,
            at(F, 'intersect', call('tangent', [pt(1, 1), HYP]), line(pt(0, 0), pt(1, 0))),
            2,
            0,
          ),
        ).toBe(true);
      }
    },
};

const POLAR_CONIC: Record<string, () => void> = {
  'a conic: P = its center (g(P) = 0 as a length) → Undefined; P on k → the tangent at P': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'polar', pt(0, 0), HYP))).toBe(
        'undefined: P is the center: its polar is the line at infinity',
      );
    for (const F of ORDERED) {
      const meet = at(F, 'intersect', call('polar', [pt(1, 1), HYP]), line(pt(0, 0), pt(1, 0)));
      expect(isAt(F, meet, 2, 0)).toBe(true);
    }
  },
};

const POLE_CONIC: Record<string, () => void> = {
  'a conic: l through its center (a parabola: l parallel to its axis) → the point at infinity of the pole':
    () => {
      for (const F of FIELDS) {
        expect(kindOf(at(F, 'pole', line(pt(0, 0), pt(1, 2)), HYP))).toBe('ideal_point');
        expect(kindOf(at(F, 'pole', line(pt(3, 0), pt(3, 1)), PAR))).toBe('ideal_point');
        expect(kindOf(at(F, 'pole', line(pt(0, -1), pt(1, -1)), PAR))).toBe('point');
      }
      for (const F of ORDERED)
        expect(isAt(F, at(F, 'pole', call('polar', [pt(3, 1), HYP]), HYP), 3, 1)).toBe(true);
    },
  'a conic within the band of a parabola → Undefined (ambiguous)': () => {
    expect(reason(at(FloatField, 'pole', line(pt(0, -1), pt(1, -1)), NEAR_PAR))).toBe(
      'undefined: ambiguous: the conic is within the band of a parabola',
    );
  },
};

const TANGENT_FROM_CONIC: Record<string, () => void> = {
  'a conic: P its center or no tangent from P (P inside it) → Undefined': () => {
    for (const tool of ['tangent_point', 'tangent_from'])
      for (const F of ORDERED) {
        expect(reason(choose(F, tool, [pt(0, 0), ELL], [ORIENT_P]))).toBe(
          `undefined: ${tool}(P, k): no tangent from P to the conic (P is its center)`,
        );
        expect(reason(choose(F, tool, [pt(1, 0), ELL], [ORIENT_P]))).toBe(
          `undefined: ${tool}(P, k): no tangent from P to the conic (P is inside it)`,
        );
      }
    // From (0, 2) the tangents touch x²/4 + y² = 1 at (±√3, 1/2): Inexact over Q.
    expect(choose(RationalField, 'tangent_point', [pt(0, 2), ELL], [ORIENT_P]).kind).toBe(
      'inexact',
    );
    expect(choose(FloatField, 'tangent_point', [pt(0, 2), ELL], [ORIENT_P]).kind).toBe('point');
  },
  'a conic: P on an asymptote → Undefined (one touch point is at infinity)': () => {
    for (const tool of ['tangent_point', 'tangent_from'])
      for (const F of FIELDS)
        expect(reason(choose(F, tool, [pt(3, 0), HYP], [ORIENT_P]))).toBe(
          `undefined: ${tool}(P, k): P lies on an asymptote, so one touch point is at infinity`,
        );
  },
};

const ON_CONIC: Record<string, () => void> = {
  'on(k, u, v) on a conic without a known point → Undefined': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'on', NO_ANCHOR, num(1), num(2)))).toBe(
        'undefined: this conic has no known point: a glider on it needs one',
      );
  },
  'on(k, u, v) at a point at infinity of the conic (an asymptotic direction) → Undefined; within the band: ambiguous':
    () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'on', HYP, num(1), num(-1)))).toBe(
          'undefined: the glider is at a point at infinity of the conic (an asymptotic direction)',
        );
      expect(reason(at(FloatField, 'on', HYP, num(1), num(-1 + 1e-8)))).toMatch(
        /^undefined: ambiguous: the glider is within the band of a point at infinity/,
      );
      for (const F of ORDERED)
        expect(isAt(F, at(F, 'on', HYP, num(1), num(2)), -3, -1 / 3)).toBe(true);
    },
};

const APPLY_CONIC: Record<string, () => void> = {
  'a conic under a similarity or a projective map → a conic (its known point mapped, dropped at infinity)':
    () => {
      for (const F of FIELDS) {
        const r = at(F, 'apply', call('reflect', [line(pt(0, 0), pt(1, 0))]), HYP);
        expect(r.kind === 'conic' && r.anchor !== undefined).toBe(true);
        expect(kindOf(at(F, 'apply', SEND_X, HYP))).toBe('conic');
        const n = at(F, 'apply', call('send_to_infinity', [line(pt(5, 0), pt(5, 1))]), C5);
        expect(n.kind === 'conic' && n.anchor === undefined).toBe(true);
      }
    },
  'a conic under a Möbius map with a pole → Undefined (a curve of degree 3 or 4)': () => {
    for (const F of FIELDS)
      expect(reason(at(F, 'apply', call('inversion', [circ(pt(0, 0), pt(1, 0))]), HYP))).toBe(
        'undefined: apply: a Möbius map with a pole sends a conic (that is not a circle) to a curve of degree 3 or 4, which is not an object',
      );
  },
};

/** The tables of the tools a conic extends, merged with their earlier cases. */
export const CONIC_CASES: Record<string, Record<string, () => void>> = {
  ...CONIC_OWN,
  other: { ...GLIDER_CASES['other'], ...ARC_OTHER_CASES, ...OTHER_CONIC },
  tangent: { ...CIRCLE_CASES['tangent'], ...TANGENT_CONIC },
  polar: { ...CIRCLE_CASES['polar'], ...POLAR_CONIC },
  pole: { ...V11_CASES['pole'], ...POLE_CONIC },
  tangent_point: { ...TANGENT_CASES['tangent_point'], ...ARC_TANGENT_CASES, ...TANGENT_FROM_CONIC },
  tangent_from: { ...TANGENT_CASES['tangent_from'], ...ARC_TANGENT_CASES, ...TANGENT_FROM_CONIC },
  on: { ...GLIDER_CASES['on'], ...ARC_ON_CASES, ...ON_CONIC },
  apply: { ...PROJECTIVE_CASES['apply'], ...APPLY_CONIC },
};
