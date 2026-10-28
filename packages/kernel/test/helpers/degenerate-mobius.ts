/**
 * Degenerate cases of Run 14's tools (ADR-0032): inversion, sqrt_bc, orthocenter_inversion,
 * inversion_fixing, inversion_swap, and the Möbius cases that compose, inverse and apply
 * gained. Spread into degenerate.test.ts's table (apply, compose and inverse merged with their
 * earlier cases here). Fixture: J4 = inversion((0, 0), 4), the inversion in the circle of
 * radius 2 about the origin.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { complex } from '@geomira/num/complex';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { FIELDS, ORDERED, at, line, plain, reason, seg } from './degenerate';
import { APPLY_DISPLAY_CASES } from './degenerate-display';
import { TRANSFORM_CASES, fq } from './degenerate-transforms';
import { REGISTRY, num, pt } from './doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const O0 = pt(0, 0);
const J4 = T('inversion', O0, num(4));
const circ = (c: Expr, p: Expr): Expr => T('circle', c, p);
const arc = (a: Expr, b: Expr, c: Expr): Expr => T('arc', a, b, c);

/** The plain numbers of a line (p, d, lo, hi, chiral, outside) or a circle (c, r2, arc). */
export function shapeOf<X>(F: Field<X>, v: Value<X>): unknown {
  const n = (x: X): number => F.toNumber(x) + 0;
  const xy = (p: { readonly x: X; readonly y: X }): number[] => [n(p.x), n(p.y)];
  if (v.kind === 'line')
    return {
      p: xy(v.p),
      d: xy(v.d),
      lo: v.lo === null ? null : n(v.lo),
      hi: v.hi === null ? null : n(v.hi),
      chiral: v.chiral,
      outside: v.outside === true,
    };
  if (v.kind === 'circle')
    return {
      c: xy(v.c),
      r2: n(v.r2),
      arc: v.arc === null ? null : [xy(v.arc.from), xy(v.arc.to)],
    };
  return reason(v);
}

/** The point p + t·d of a line value at t, as numbers. */
export function lineAtT<X>(F: Field<X>, v: Value<X>, t: X | null): number[] {
  if (v.kind !== 'line' || t === null) return [];
  return [F.toNumber(F.add(v.p.x, F.mul(t, v.d.x))), F.toNumber(F.add(v.p.y, F.mul(t, v.d.y)))];
}

const img = <X>(F: Field<X>, X: Expr): Value<X> => at(F, 'apply', J4, X);

/**
 * Whether the point (x, y) lies on the line value v: on its carrier, and its parameter in the
 * range (the two rays when `outside`). Plain numbers; for exact fixtures with small values.
 */
export function onLineValue<X>(F: Field<X>, v: Value<X>, x: number, y: number): boolean {
  if (v.kind !== 'line') return false;
  const n = (z: X): number => F.toNumber(z);
  const [px, py, dx, dy] = [n(v.p.x), n(v.p.y), n(v.d.x), n(v.d.y)];
  const [wx, wy] = [x - px, y - py];
  if (Math.abs(wx * dy - wy * dx) > 1e-9) return false;
  const t = (wx * dx + wy * dy) / (dx * dx + dy * dy);
  const lo = v.lo === null ? -Infinity : n(v.lo);
  const hi = v.hi === null ? Infinity : n(v.hi);
  return v.outside === true ? t <= lo || t >= hi : t >= lo && t <= hi;
}

const MOBIUS_APPLY_CASES: Record<string, () => void> = {
  'the center of an inversion → Undefined (its image is at infinity)': () => {
    for (const F of FIELDS)
      expect(reason(img(F, O0))).toBe(
        'undefined: apply: the point is the center of inversion: its image is at infinity',
      );
  },
  'a point within the band of the center → Undefined (ambiguous)': () => {
    const near = pt(0, '0.00000001');
    expect(reason(img(FloatField, near))).toBe(
      'undefined: ambiguous: within the band of the center of inversion',
    );
    expect(plain(RationalField, img(RationalField, near))).toEqual([0, 400000000]);
  },
  'a line through the center → that line; a circle through it → a line (chiral)': () => {
    for (const F of ORDERED) {
      const l = img(F, line(pt(1, 1), pt(3, 3)));
      expect(shapeOf(F, l)).toMatchObject({ lo: null, hi: null, chiral: false });
      expect(l.kind === 'line' && F.toNumber(F.sub(l.p.x, l.p.y))).toBe(0);
      const k = img(F, circ(pt(1, 0), O0));
      expect(shapeOf(F, k)).toMatchObject({ lo: null, hi: null, chiral: true });
      expect(lineAtT(F, k, F.zero)[0]).toBe(2);
    }
  },
  'a line off the center → a circle through it; a circle off it → a circle': () => {
    for (const F of ORDERED) {
      expect(shapeOf(F, img(F, line(pt(1, 0), pt(1, 1))))).toEqual({ c: [2, 0], r2: 4, arc: null });
      expect(shapeOf(F, img(F, circ(pt(3, 0), pt(4, 0))))).toEqual({
        c: [1.5, 0],
        r2: 0.25,
        arc: null,
      });
    }
    expect(img(ModPField, line(pt(1, 0), pt(1, 1))).kind).toBe('circle');
  },
  'a curve within the band of the center → Undefined (ambiguous)': () => {
    const near = line(pt('0.00000001', 0), pt('0.00000001', 1));
    expect(reason(img(FloatField, near))).toBe(
      'undefined: ambiguous: within the band of the center of inversion',
    );
    expect(img(RationalField, near).kind).toBe('circle');
  },
  'a segment → an arc; a segment with an end at the center → a ray': () => {
    for (const F of ORDERED) {
      expect(shapeOf(F, img(F, seg(pt(1, -1), pt(1, 1))))).toEqual({
        c: [2, 0],
        r2: 4,
        arc: [
          [2, -2],
          [2, 2],
        ],
      });
      const r = img(F, seg(O0, pt(1, 0)));
      expect(r.kind === 'line' && [r.lo !== null, r.hi === null]).toEqual([true, true]);
      expect(r.kind === 'line' && lineAtT(F, r, r.lo)).toEqual([4, 0]);
      expect(r.kind === 'line' && F.toNumber(r.d.x) > 0).toBe(true);
    }
  },
  'a segment containing the center → the two rays outside': () => {
    for (const F of ORDERED) {
      const r = img(F, seg(pt(-1, 0), pt(2, 0)));
      expect(r.kind === 'line' && r.outside).toBe(true);
      if (r.kind !== 'line') continue;
      const ends = [lineAtT(F, r, r.lo), lineAtT(F, r, r.hi)].map((p) => p[0] ?? 0);
      expect(ends.sort((a, b) => a - b)).toEqual([-4, 2]);
    }
  },
  'an arc through the center → a segment, a ray or two rays': () => {
    // The circle about (1, 0) through the center maps to the line x = 2.
    const F = RationalField;
    const s = img(F, arc(pt(1, -1), pt(2, 0), pt(1, 1)));
    expect(
      s.kind === 'line' && s.lo !== null && s.hi !== null && F.toNumber(F.sub(s.hi, s.lo)) > 0,
    ).toBe(true);
    expect(
      [
        [2, -2],
        [2, 0],
        [2, 2],
        [2, 3],
      ].map(([x, y]) => onLineValue(F, s, x ?? 0, y ?? 0)),
    ).toEqual([true, true, true, false]);
    const r = img(F, arc(pt(2, 0), pt(1, 1), O0));
    expect(r.kind === 'line' && (r.lo === null) !== (r.hi === null)).toBe(true);
    expect(
      [
        [2, 0],
        [2, 2],
        [2, 99],
        [2, -1],
      ].map(([x, y]) => onLineValue(F, r, x ?? 0, y ?? 0)),
    ).toEqual([true, true, true, false]);
    const two = img(F, arc(pt(1, 1), O0, pt(1, -1)));
    expect(two.kind === 'line' && two.outside).toBe(true);
    expect(
      [
        [2, 3],
        [2, -3],
        [2, 2],
        [2, 0],
      ].map(([x, y]) => onLineValue(F, two, x ?? 0, y ?? 0)),
    ).toEqual([true, true, true, false]);
    for (const X of [arc(pt(1, -1), pt(2, 0), pt(1, 1)), arc(pt(2, 0), pt(1, 1), O0)])
      expect(shapeOf(FloatField, img(FloatField, X))).toEqual(shapeOf(F, img(F, X)));
  },
  'a polygon under an inversion → Undefined (its sides become arcs)': () => {
    for (const F of FIELDS)
      expect(reason(img(F, T('polygon', pt(1, 0), pt(2, 0), pt(2, 1))))).toBe(
        'undefined: apply: an inversion maps the sides of a polygon to arcs, so it has no image',
      );
  },
  'a segment mark under an inversion → Undefined (lengths are not kept)': () => {
    for (const F of FIELDS)
      expect(reason(img(F, T('mark_segment', pt(1, 0), pt(2, 0))))).toBe(
        'undefined: apply: an inversion does not keep lengths, so a segment mark has no image',
      );
  },
  'an angle mark under an inversion → the mark on the tangents (arms swapped)': () => {
    for (const F of ORDERED) {
      const m = img(F, T('mark_right', pt(2, 1), pt(1, 1), pt(1, 2)));
      expect(m.kind === 'angle_mark' && [plain(F, { kind: 'point', ...m.b }), m.right]).toEqual([
        [2, 2],
        true,
      ]);
      if (m.kind !== 'angle_mark') continue;
      const b = m.b;
      const arm = (p: typeof b): readonly [number, number] => [
        F.toNumber(F.sub(p.x, b.x)),
        F.toNumber(F.sub(p.y, b.y)),
      ];
      const [[ux, uy], [vx, vy]] = [arm(m.from), arm(m.to)];
      // A right angle stays right; the arms are the tangent directions at the image vertex,
      // stored counter-clockwise.
      expect(ux * vx + uy * vy).toBeCloseTo(0, 12);
      expect(ux * vy - uy * vx).toBeGreaterThan(0);
    }
  },
  'mod p, an arc or a range through an inversion → Inexact (needs an order)': () => {
    const F = ModPField;
    const t = at(F, 'inversion', O0, num(4));
    const q = (n: number) => fq(F, n);
    const arcValue: Value<bigint> = {
      kind: 'circle',
      c: { x: q(3), y: q(0) },
      r2: q(1),
      arc: { from: { x: q(4), y: q(0) }, to: { x: q(2), y: q(0) } },
    };
    const tool = REGISTRY.get('apply');
    const v = tool?.compute(F, [t, arcValue], { scale: 1 });
    expect(v && reason(v)).toBe(
      'inexact: apply: an arc through an inversion needs an order, which ModPField lacks',
    );
  },
};

const COMPOSE_CASES: Record<string, () => void> = {
  'two inversions → a direct Möbius map (the same center: a homothety, with no pole)': () => {
    for (const F of FIELDS) {
      const h = at(F, 'compose', J4, T('inversion', O0, num(1)));
      expect(h.kind === 'transform' && h.t.type === 'mobius' && [h.t.type, h.t.anti]).toEqual([
        'mobius',
        false,
      ]);
      expect(h.kind === 'transform' && h.t.type === 'mobius' && F.eq(h.t.c.re, F.zero)).toBe(true);
    }
    for (const F of ORDERED)
      expect(
        plain(F, at(F, 'apply', T('compose', J4, T('inversion', O0, num(1))), pt(1, 0))),
      ).toEqual([4, 0]);
  },
  'a hand-built Möbius map with ad − bc = 0 → Undefined': () => {
    for (const F of FIELDS) {
      const one = complex(F.one, F.zero);
      const bad: Value<unknown> = {
        kind: 'transform',
        t: { type: 'mobius', anti: false, a: one, b: one, c: one, d: one },
      };
      const v = REGISTRY.get('compose')?.compute(F, [bad, bad], { scale: 1 });
      expect(v && reason(v)).toBe('undefined: compose: the map is not invertible (ad − bc = 0)');
    }
  },
};

const INVERSE_CASES: Record<string, () => void> = {
  'an inversion → itself (its matrix up to a factor)': () => {
    for (const F of ORDERED)
      for (const P of [pt(1, 0), pt(3, 5), pt(-2, 7)])
        expect(plain(F, at(F, 'apply', T('inverse', J4), P))).toEqual(
          plain(F, at(F, 'apply', J4, P)),
        );
  },
};

export const MOBIUS_CASES: Record<string, Record<string, () => void>> = {
  apply: { ...TRANSFORM_CASES.apply, ...APPLY_DISPLAY_CASES, ...MOBIUS_APPLY_CASES },
  compose: { ...TRANSFORM_CASES.compose, ...COMPOSE_CASES },
  inverse: { ...TRANSFORM_CASES.inverse, ...INVERSE_CASES },
  inversion: {
    'k = 0 → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'inversion', O0, num(0)))).toBe(
          'undefined: inversion: the power k is 0',
        );
        expect(reason(at(F, 'inversion', O0, T('sub', num(2), num(2))))).toBe(
          'undefined: inversion: the power k is 0',
        );
      }
    },
    'k < 0 → the inversion with power |k| followed by the half turn about O': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'apply', T('inversion', pt(1, 1), num(-4)), pt(3, 1)))).toEqual([
          -1, 1,
        ]);
        expect(plain(F, at(F, 'apply', T('inversion', pt(1, 1), num(4)), pt(3, 1)))).toEqual([
          3, 1,
        ]);
      }
    },
    'an arc → the inversion in its carrier circle': () => {
      for (const F of ORDERED) {
        const a = at(F, 'apply', T('inversion', arc(pt(2, 0), pt(0, 2), pt(-2, 0))), pt(1, 0));
        expect(plain(F, a)).toEqual([4, 0]);
      }
    },
  },
  sqrt_bc: {
    'A = B or A = C → Undefined': () => {
      for (const F of FIELDS) {
        expect(at(F, 'sqrt_bc', O0, O0, pt(5, 0)).kind).toBe('undefined');
        expect(at(F, 'sqrt_bc', O0, pt(5, 0), O0).kind).toBe('undefined');
      }
    },
    'collinear A, B, C → still defined (it swaps B and C)': () => {
      for (const F of ORDERED) {
        for (const C of [pt(-4, 0), pt(4, 0)]) {
          const m = T('sqrt_bc', O0, pt(1, 0), C);
          expect(plain(F, at(F, 'apply', m, pt(1, 0)))).toEqual(plain(F, at(F, 'midpoint', C, C)));
        }
      }
    },
  },
  orthocenter_inversion: {
    'coincident or collinear vertices → Undefined': () => {
      for (const F of FIELDS) {
        expect(at(F, 'orthocenter_inversion', O0, O0, pt(1, 2)).kind).toBe('undefined');
        expect(at(F, 'orthocenter_inversion', O0, pt(1, 1), pt(2, 2)).kind).toBe('undefined');
      }
    },
    'a right angle (H on the circumcircle) → Undefined (power 0)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'orthocenter_inversion', O0, pt(4, 0), pt(0, 3)))).toBe(
          'undefined: inversion: the power k is 0',
        );
    },
  },
  inversion_fixing: {
    'O on c → Undefined (power 0)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'inversion_fixing', pt(3, 0), circ(O0, pt(3, 0))))).toBe(
          'undefined: inversion: the power k is 0',
        );
    },
    'O inside c → a negative power (still fixes c)': () => {
      for (const F of ORDERED) {
        const m = T('inversion_fixing', pt(1, 0), circ(O0, pt(3, 0)));
        expect(plain(F, at(F, 'apply', m, pt(3, 0)))).toEqual([-3, 0]);
        expect(shapeOf(F, at(F, 'apply', m, circ(O0, pt(3, 0))))).toEqual({
          c: [0, 0],
          r2: 9,
          arc: null,
        });
      }
    },
  },
  inversion_swap: {
    'O off line AB → Undefined (no inversion centered at O swaps them)': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'inversion_swap', pt(0, 1), pt(1, 0), pt(4, 0)))).toBe(
          'undefined: inversion_swap(O, A, B): no inversion centered at O swaps A and B unless O lies on line AB',
        );
    },
    'A = B → Undefined': () => {
      for (const F of FIELDS)
        expect(at(F, 'inversion_swap', O0, pt(1, 0), pt(1, 0)).kind).toBe('undefined');
    },
    'O = A or O = B → Undefined (power 0)': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'inversion_swap', O0, O0, pt(4, 0)))).toBe(
          'undefined: inversion: the power k is 0',
        );
        expect(reason(at(F, 'inversion_swap', O0, pt(4, 0), O0))).toBe(
          'undefined: inversion: the power k is 0',
        );
      }
    },
  },
};
