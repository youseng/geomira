/**
 * The transformation part of degenerate.test.ts's table (Run 4): reflect, rotate,
 * homothety, translate, spiral, compose, inverse, apply. Every declared case is a test; the
 * meta-test in degenerate.test.ts checks the names against the registry.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { rational } from '@geomira/num/rational';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import type { Value } from '../../src/value';
import { A, B, C, FIELDS, ORDERED, at, line, plain, reason, seg } from './degenerate';
import { O0, circ } from './degenerate-circles';
import { Builder, REGISTRY, evalDoc, must, num, pt, valueOf } from './doc';

/** A transform as plain numbers ({ anti, a, b }), or the reason / kind. */
export function tv<T>(F: Field<T>, v: Value<T>): unknown {
  if (v.kind !== 'transform') return reason(v);
  const n = (x: T) => F.toNumber(x) + 0;
  return { anti: v.t.anti, a: [n(v.t.a.re), n(v.t.a.im)], b: [n(v.t.b.re), n(v.t.b.im)] };
}

const ID = { anti: false, a: [1, 0], b: [0, 0] };

/** The integer n in F. */
export function fq<T>(F: Field<T>, n: number): T {
  const v = F.fromRational(rational(BigInt(n)));
  if (isInexact(v)) throw new Error(v.reason);
  return v;
}
const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);

/** The value of `last` in a document `O = intersect(line(A, B), parallel(C, line(A, B)))`, … */
function withUndefined<X>(F: Field<X>, build: (b: Builder, O: Expr) => void): Value<X> {
  const b = new Builder();
  const O = b.add('O', T('intersect', line(A, B), T('parallel', C, line(A, B))));
  build(b, O);
  return valueOf(b.doc, evalDoc(b.doc, F), 'x');
}

const direct = (tool: string, F: Field<unknown>, args: readonly Value<unknown>[]) =>
  must(REGISTRY.get(tool)).compute(F, args, { scale: 1 });

export const TRANSFORM_CASES: Record<string, Record<string, () => void>> = {
  reflect: {
    'a line with no direction → Undefined': () => {
      for (const F of FIELDS) {
        const o = { x: F.zero, y: F.zero };
        const bad: Value<unknown> = { kind: 'line', p: o, d: o, lo: null, hi: null, chiral: false };
        expect(reason(direct('reflect', F, [bad]))).toBe('undefined: the line has no direction');
      }
    },
    'an Undefined mirror → Undefined': () => {
      for (const F of FIELDS) {
        const why = 'undefined: coincident points: line(A, B) needs A ≠ B';
        expect(reason(at(F, 'reflect', line(A, A)))).toBe(why);
        expect(reason(at(F, 'reflect', B, line(A, A)))).toBe(why);
      }
    },
    'X on the mirror (X = P for a point) → X itself': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'reflect', pt(7, 10), line(A, B)))).toEqual([7, 10]);
        expect(plain(F, at(F, 'reflect', A, A))).toEqual([1, 2]);
        expect(plain(F, at(F, 'reflect', pt(3, 1), line(O0, pt(1, 1))))).toEqual([1, 3]);
      }
      const m = at(ModPField, 'reflect', pt(7, 10), line(A, B));
      expect(m).toEqual({ kind: 'point', x: 7n, y: 10n });
    },
  },
  rotate: {
    'θ a multiple of 360° → the identity': () => {
      for (const F of FIELDS) {
        expect(tv(F, at(F, 'rotate', A, num(360)))).toEqual(ID);
        expect(tv(F, at(F, 'rotate', A, num(-720)))).toEqual(ID);
        expect(at(F, 'rotate', B, A, num(360))).toEqual(at(F, 'point', num(4), num(6)));
      }
    },
    'θ not a multiple of 90° → Inexact over Q and mod p': () => {
      for (const F of [RationalField, ModPField] as Field<unknown>[]) {
        expect(at(F, 'rotate', A, num(60)).kind).toBe('inexact');
        expect(at(F, 'rotate', B, A, num(30)).kind).toBe('inexact');
      }
      const v = at(FloatField, 'rotate', pt(2, 0), O0, num(60));
      expect(v.kind === 'point' && [v.x, v.y].map((x) => Math.round(x * 1e12) / 1e12)).toEqual([
        1,
        Math.round(Math.sqrt(3) * 1e12) / 1e12,
      ]);
      expect(plain(RationalField, at(RationalField, 'rotate', pt(2, 0), O0, num(90)))).toEqual([
        0, 2,
      ]);
    },
    'an Undefined centre → Undefined': () => {
      for (const F of FIELDS) {
        const v = withUndefined(F, (b, O) => b.add('x', T('rotate', B, O, num(90))));
        expect(reason(v)).toBe('undefined: O is undefined');
        const w = withUndefined(F, (b, O) => b.add('x', T('rotate', O, num(90))));
        expect(reason(w)).toBe('undefined: O is undefined');
      }
    },
  },
  homothety: {
    'k = 0 → Undefined': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'homothety', A, num(0)))).toBe(
          'undefined: homothety: the ratio k is 0',
        );
        expect(reason(at(F, 'homothety', B, A, num(0)))).toBe(
          'undefined: homothety: the ratio k is 0',
        );
      }
      expect(at(FloatField, 'homothety', A, num(1e-12)).kind).toBe('undefined');
      expect(at(RationalField, 'homothety', A, num(1e-12)).kind).toBe('transform');
    },
    'k = 1 → the identity; k = −1 → the half turn about O': () => {
      for (const F of FIELDS) {
        expect(tv(F, at(F, 'homothety', A, num(1)))).toEqual(ID);
        expect(at(F, 'homothety', B, A, num(-1))).toEqual(at(F, 'reflect', B, A));
        expect(at(F, 'homothety', A, num(-1))).toEqual(at(F, 'reflect', A));
      }
      expect(plain(FloatField, at(FloatField, 'homothety', B, A, num(-1)))).toEqual([-2, -2]);
    },
  },
  translate: {
    'A = B → the identity': () => {
      for (const F of FIELDS) {
        expect(tv(F, at(F, 'translate', A, A))).toEqual(ID);
        expect(at(F, 'translate', C, B, B)).toEqual(at(F, 'point', num(-2), num(5)));
      }
    },
  },
  spiral: {
    'A = B or C = D → Undefined (coincident points)': () => {
      for (const F of FIELDS) {
        expect(reason(at(F, 'spiral', A, A, B, C))).toBe(
          'undefined: coincident points: spiral(A, B, C, D) needs A ≠ B',
        );
        expect(reason(at(F, 'spiral', C, A, B, C, C))).toBe(
          'undefined: coincident points: spiral(A, B, C, D) needs C ≠ D',
        );
      }
      expect(at(FloatField, 'spiral', A, pt(1 + 1e-12, 2), B, C).kind).toBe('undefined');
      expect(at(RationalField, 'spiral', A, pt(1 + 1e-12, 2), B, C).kind).toBe('transform');
    },
    'B − A = D − C → a translation': () => {
      // B − A = (3, 4); D = C + (3, 4) = (1, 9); the map is z ↦ z + (C − A) = z + (−3, 3).
      for (const F of FIELDS) {
        expect(tv(F, at(F, 'spiral', A, B, C, pt(1, 9)))).toEqual({
          anti: false,
          a: [1, 0],
          b: [-3, 3],
        });
      }
    },
  },
  compose: {
    'a scale factor that vanishes (within EPS) → Undefined': () => {
      const h = T('homothety', A, num('1/100000'));
      expect(reason(at(FloatField, 'compose', h, h))).toBe(
        'undefined: compose: the map collapses the plane (scale factor 0)',
      );
      expect(at(RationalField, 'compose', h, h).kind).toBe('transform');
      expect(at(ModPField, 'compose', h, h).kind).toBe('transform');
    },
    'compose(T, inverse(T)) → the identity': () => {
      const s = T('spiral', A, B, C, pt(3, -1));
      for (const F of [RationalField, ModPField] as Field<unknown>[]) {
        expect(tv(F, at(F, 'compose', s, T('inverse', s)))).toEqual(ID);
        expect(tv(F, at(F, 'compose', T('inverse', s), s))).toEqual(ID);
      }
      const f = tv(FloatField, at(FloatField, 'compose', s, T('inverse', s)));
      expect(f).toMatchObject({ anti: false });
    },
    'two anti-similarities → a direct similarity': () => {
      for (const F of FIELDS) {
        const v = at(
          F,
          'compose',
          T('reflect', line(O0, pt(1, 0))),
          T('reflect', line(O0, pt(0, 1))),
        );
        // Reflections in two perpendicular lines through O: the half turn about O.
        expect(tv(F, v)).toEqual({ anti: false, a: [-1, 0], b: [0, 0] });
      }
    },
  },
  inverse: {
    'a reflection or a half turn → itself': () => {
      for (const F of [RationalField, ModPField] as Field<unknown>[]) {
        const r = T('reflect', line(A, B));
        expect(at(F, 'inverse', r)).toEqual(at(F, 'reflect', line(A, B)));
        expect(at(F, 'inverse', T('reflect', C))).toEqual(at(F, 'reflect', C));
      }
    },
    'a hand-built map with scale factor 0 → Undefined': () => {
      for (const F of FIELDS) {
        const z = { re: F.zero, im: F.zero };
        const t = {
          kind: 'transform',
          t: { type: 'similarity', anti: false, a: z, b: z },
        } as const;
        expect(reason(direct('inverse', F, [t]))).toBe(
          'undefined: inverse: the map collapses the plane (scale factor 0)',
        );
        expect(reason(direct('apply', F, [t, { kind: 'point', x: F.one, y: F.one }]))).toBe(
          'undefined: apply: the map collapses the plane (scale factor 0)',
        );
      }
    },
  },
  apply: {
    'X a number or a transform → Undefined (not imaged)': () => {
      for (const F of FIELDS) {
        const t = T('reflect', A);
        expect(reason(at(F, 'apply', t, num(2)))).toMatch(
          /^undefined: apply does not accept \(transform, number\)/,
        );
        expect(reason(at(F, 'apply', t, t))).toMatch(/^undefined: apply does not accept/);
        expect(reason(at(F, 'reflect', num(2), A))).toMatch(/^undefined: reflect does not accept/);
      }
    },
    'an Undefined T or X → Undefined': () => {
      for (const F of FIELDS) {
        const x = withUndefined(F, (b, O) => b.add('x', T('apply', T('reflect', A), O)));
        expect(reason(x)).toBe('undefined: O is undefined');
        const t = withUndefined(F, (b, O) => {
          b.add('t', T('reflect', O));
          b.add('x', T('apply', b.ref('t'), B));
        });
        expect(reason(t)).toBe('undefined: t is undefined');
      }
    },
    'an anti-similarity reverses arcs; ranges and the chirality flag are kept': () => {
      for (const F of FIELDS) {
        const P = (x: number, y: number) => ({ x: fq(F, x), y: fq(F, y) });
        const mirror = at(F, 'reflect', line(O0, pt(1, 0)));
        const arc: Value<unknown> = {
          kind: 'circle',
          c: P(0, 0),
          r2: fq(F, 25),
          arc: { from: P(5, 0), to: P(0, 5) },
        };
        const img = direct('apply', F, [mirror, arc]);
        expect(img).toMatchObject({ kind: 'circle', arc: { from: P(0, -5), to: P(5, 0) } });
        const turn = direct('apply', F, [at(F, 'rotate', O0, num(90)), arc]);
        expect(turn).toMatchObject({ arc: { from: P(0, 5), to: P(-5, 0) } });
        const s = at(F, 'reflect', seg(A, B), line(O0, pt(1, 0)));
        expect(s).toMatchObject({ kind: 'line', lo: F.zero, hi: F.one, chiral: false });
        const chiral = at(F, 'reflect', T('perp', C, line(A, B)), line(O0, pt(1, 0)));
        expect(chiral).toMatchObject({ kind: 'line', lo: null, hi: null, chiral: true });
      }
    },
    'a circle without an anchor → an image without one': () => {
      for (const F of FIELDS) {
        const img = at(F, 'apply', T('translate', O0, A), circ(B, num(3)));
        expect(img.kind === 'circle' && 'anchor' in img).toBe(false);
        const anchored = at(F, 'apply', T('translate', O0, A), circ(B, C));
        expect(anchored.kind === 'circle' && anchored.anchor !== undefined).toBe(true);
      }
    },
  },
};
