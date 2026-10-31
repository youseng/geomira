/**
 * Theorems of ADR-0045 (common tangents and centres of similitude), on random figures over
 * FloatField and, where the construction is rational, exactly over RationalField
 * (helpers/theorem-runner.ts). Classical results only:
 *   - the two external common tangents of two circles meet at the exsimilicenter, the two internal
 *     ones at the insimilicenter (the homotheties that take one circle to the other fix them);
 *   - Monge's theorem: the three exsimilicenters of three circles are collinear, and so are an
 *     exsimilicenter and the two insimilicenters that do not share its pair of circles;
 *   - every common tangent is tangent to both curves (the distance from a circle's centre is its
 *     radius; for a conic, the line's dual quadratic form ℓᵀ·adj(M)·ℓ vanishes) and touches the
 *     first curve at tangent_point(c1, c2) with the same selectors.
 * Selectors: along(−) / along(+) keep the external / internal pair (structural labels), orient(±)
 * a side; after orient(±) alone the internal tangent touches c1 nearer the second centre
 * (|T − O₂|² is smaller by 4r₁r₂), so far_from(O₂) / near(O₂) decide too.
 */
import { FloatField } from '@geomira/num/float-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import { coeffsOf, matrixOf } from '../src/conic';
import { vCross, vDot, vSub } from '../src/geom';
import { adj3 } from '../src/transform/projective';
import type { Line } from '../src/value';
import { asCircle, asLine, onCircle, onLine } from './helpers/circle-properties';
import { asConic, onConic } from './helpers/conic-properties';
import { Builder, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { asPoint, type Figure } from './helpers/figure';
import { LAW_TIMEOUT, lawCount } from './helpers/laws';
import { ALL, collinear, theoremTests, type Theorem } from './helpers/theorem-runner';

const ORIENT = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });
const ALONG = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const near = (p: Expr): Selector => ({ kind: 'near', p });
const far = (p: Expr): Selector => ({ kind: 'far_from', p });

/** dist(O, l)² − r² relative to r² (zero: l is tangent to the circle). */
function tangentToCircle<T>(f: Figure<T>, l: string, c: string): boolean {
  const [L, C] = [asLine<T>(f.get(l)), asCircle<T>(f.get(c))];
  const F = f.F;
  const x = vCross(F, vSub(F, C.c, L.p), L.d);
  const gap = F.sub(F.div(F.mul(x, x), vDot(F, L.d, L.d)), C.r2);
  return F.isZero(F.div(gap, C.r2), 'dimensionless', f.ctx);
}

/** ℓᵀ·adj(M)·ℓ for ℓ = (a, b, c), a·x + b·y + c = 0 the line, relative to its size. */
function tangentToConic<T>(f: Figure<T>, l: string, k: string): boolean {
  const F = f.F;
  const L: Line<T> = asLine(f.get(l));
  const [a, b] = [F.neg(L.d.y), L.d.x];
  const c = F.neg(F.add(F.mul(a, L.p.x), F.mul(b, L.p.y)));
  const A = adj3(F, matrixOf(coeffsOf(asConic<T>(f.get(k)))));
  const v = [a, b, c];
  let q = F.zero;
  let n = F.zero;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const t = F.mul(F.mul(v[i] ?? F.zero, v[j] ?? F.zero), A[3 * i + j] ?? F.zero);
      q = F.add(q, t);
      n = F.add(n, F.mul(t, t));
    }
  if (F.kind !== 'float') return F.eq(q, F.zero);
  return F.isZero(F.div(F.mul(q, q), n), 'dimensionless', f.ctx);
}

/** The point named p is the meet of the lines named l and m (both through it). */
function meetAt<T>(f: Figure<T>, l: string, m: string, p: string): boolean {
  const P = f.get(p);
  if (P.kind !== 'point') return false;
  return onLine(f, p, l) && onLine(f, p, m);
}

function twoCircles(b: Builder, A: Expr, B: Expr): [Expr, Expr] {
  return [b.call('c_1', 'circle', A, num('1/4')), b.call('c_2', 'circle', B, num('1/8'))];
}

const THEOREMS: readonly Theorem[] = [
  {
    name: 'the external common tangents of two circles meet at the exsimilicenter',
    modes: ['float'],
    build: (b, [A, B]) => {
      const [c1, c2] = twoCircles(b, A, B);
      b.add('t_1', call('tangent', [c1, c2], [ALONG(-1), ORIENT(1)]));
      b.add('t_2', call('tangent', [c1, c2], [ORIENT(-1), far(B)]));
      b.call('X', 'exsimilicenter', c1, c2);
    },
    required: ['t_1', 't_2', 'X'],
    check: (f) =>
      meetAt(f, 't_1', 't_2', 'X') &&
      ['t_1', 't_2'].every((t) => tangentToCircle(f, t, 'c_1') && tangentToCircle(f, t, 'c_2')),
  },
  {
    name: 'the internal common tangents of two circles meet at the insimilicenter',
    modes: ['float'],
    build: (b, [A, B]) => {
      const [c1, c2] = twoCircles(b, A, B);
      b.add('t_1', call('tangent', [c1, c2], [ALONG(1), ORIENT(1)]));
      b.add('t_2', call('tangent', [c2, c1], [ORIENT(1), near(A)]));
      b.call('Y', 'insimilicenter', c1, c2);
    },
    required: ['t_1', 't_2', 'Y'],
    check: (f) =>
      meetAt(f, 't_1', 't_2', 'Y') &&
      ['t_1', 't_2'].every((t) => tangentToCircle(f, t, 'c_1') && tangentToCircle(f, t, 'c_2')),
  },
  {
    name: 'tangent_point(c1, c2) is the touch point on c1 of tangent(c1, c2) with the same selectors',
    modes: ['float'],
    build: (b, [A, B, C]) => {
      const [c1, c2] = twoCircles(b, A, B);
      b.add('t', call('tangent', [c1, c2], [near(C)]));
      b.add('T', call('tangent_point', [c1, c2], [near(C)]));
      b.call('t_2', 'tangent', b.ref('T'), c1);
    },
    required: ['t', 'T', 't_2'],
    check: <T>(f: Figure<T>) => {
      const [l, m] = [asLine<T>(f.get('t')), asLine<T>(f.get('t_2'))];
      return (
        onCircle(f, 'T', 'c_1') &&
        onLine(f, 'T', 't') &&
        f.F.isZero(vCross(f.F, l.d, m.d), 'area', f.ctx)
      );
    },
  },
  {
    name: 'Monge: the three exsimilicenters of three circles are collinear',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const c1 = b.call('c_1', 'circle', A, num(2));
      const c2 = b.call('c_2', 'circle', B, num(3));
      const c3 = b.call('c_3', 'circle', C, num('9/2'));
      b.call('X', 'exsimilicenter', c1, c2);
      b.call('Y', 'exsimilicenter', c2, c3);
      b.call('Z', 'exsimilicenter', c3, c1);
    },
    required: ['X', 'Y', 'Z'],
    check: (f) => collinear(f, asPoint(f.get('X')), asPoint(f.get('Y')), asPoint(f.get('Z'))),
  },
  {
    name: 'Monge: an exsimilicenter and the two other insimilicenters are collinear',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const c1 = b.call('c_1', 'circle', A, num(2));
      const c2 = b.call('c_2', 'circle', B, num(3));
      const c3 = b.call('c_3', 'circle', C, num('9/2'));
      b.call('X', 'exsimilicenter', c1, c2);
      b.call('Y', 'insimilicenter', c2, c3);
      b.call('Z', 'insimilicenter', c3, c1);
    },
    required: ['X', 'Y', 'Z'],
    check: (f) => collinear(f, asPoint(f.get('X')), asPoint(f.get('Y')), asPoint(f.get('Z'))),
  },
];

describe(
  'theorems: common tangents and centres of similitude (ADR-0045)',
  { timeout: LAW_TIMEOUT },
  () => {
    theoremTests(THEOREMS, 45045);
  },
);

/** Five points of the ellipse with centre (cx, cy), semi-axes a, b, turned by φ. */
function ellipse(b: Builder, name: string, e: readonly number[]): Expr {
  const [cx = 0, cy = 0, a = 1, bb = 1, phi = 0] = e;
  const pts = [0, 1.3, 2.4, 3.9, 5.1].map((t) => {
    const [x, y] = [a * Math.cos(t), bb * Math.sin(t)];
    return pt(
      cx + x * Math.cos(phi) - y * Math.sin(phi),
      cy + x * Math.sin(phi) + y * Math.cos(phi),
    );
  });
  return b.add(name, call('conic', pts));
}

const FLOATS = lawCount(200);

/**
 * Random ellipses (and circles) in general position: every common tangent the kernel gives is
 * tangent to both curves and touches the first at tangent_point with the same selector.
 */
describe(
  'common tangents of conics are tangent to both curves (ADR-0045)',
  { timeout: LAW_TIMEOUT },
  () => {
    for (const second of ['conic', 'circle'] as const)
      it(`an ellipse and a${second === 'conic' ? 'nother ellipse' : ' circle'}, either order`, () => {
        let defined = 0;
        for (let i = 0; i < FLOATS; i++) {
          const rng = createRng(deriveSeed(4545, i));
          const u = (lo: number, hi: number) => rng.uniform(lo, hi);
          const b = new Builder();
          const k = ellipse(b, 'k', [u(-5, 5), u(-5, 5), u(2, 6), u(0.5, 2), u(0, 3)]);
          const m =
            second === 'conic'
              ? ellipse(b, 'm', [u(-8, 8), u(-8, 8), u(2, 6), u(0.5, 2), u(0, 3)])
              : b.call('m', 'circle', pt(u(-8, 8), u(-8, 8)), num(u(0.5, 3)));
          const P = b.add('P', pt(u(-20, 20), u(-20, 20)));
          for (const [n, args] of [
            ['t', [k, m]],
            ['s', [m, k]],
          ] as const) {
            b.add(n, call('tangent', [...args], [near(P)]));
            b.add(`${n}_T`, call('tangent_point', [...args], [near(P)]));
          }
          const ctx = contextOf(b.doc);
          const ev = evalDoc(b.doc, FloatField, ctx);
          const f: Figure<number> = { F: FloatField, ctx, get: (n) => valueOf(b.doc, ev, n) };
          for (const [n, first] of [
            ['t', 'k'],
            ['s', 'm'],
          ] as const) {
            if (f.get(n).kind !== 'line') continue;
            defined += 1;
            const touches = (c: string) =>
              f.get(c).kind === 'circle' ? tangentToCircle(f, n, c) : tangentToConic(f, n, c);
            expect(touches('k') && touches('m'), `figure ${String(i)} ${n}`).toBe(true);
            expect(onLine(f, `${n}_T`, n), `figure ${String(i)} ${n}_T`).toBe(true);
            const on =
              f.get(first).kind === 'circle'
                ? onCircle(f, `${n}_T`, first)
                : onConic(f, `${n}_T`, first);
            expect(on, `figure ${String(i)}: on ${first}`).toBe(true);
          }
        }
        process.stdout.write(`common tangents (${second}): ${String(defined)} defined\n`);
        expect(defined).toBeGreaterThan(FLOATS / 2);
      });
  },
);
