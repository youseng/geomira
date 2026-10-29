/**
 * Theorems of Run 16c (ADR-0043), on random figures over FloatField and exactly over
 * RationalField (helpers/theorem-runner.ts). Classical results only:
 *   - the base points of a pencil: two conics through A, B, C, D meet a fourth time at D, which
 *     other(A, B, C) gives without square roots; the diagonal triangle of the four common points
 *     (the meets of opposite sides of the complete quadrangle) is self-polar for both conics;
 *   - a circle meets a conic in four points whose opposite chords are equally inclined to the
 *     conic's axes (the pencil of the circle and the conic contains the pair of chords, whose
 *     quadratic part differs from the conic's by a multiple of x² + y²);
 *   - the foci: the reflective property (the tangent at P bisects the lines PF₁ and PF₂: the
 *     reflection in it takes one to the other), the focal sum (ellipse) or difference
 *     (hyperbola) is the same for every point, the polar of a focus is its directrix with
 *     |PF| = e·dist(P, directrix) for every point; for a parabola e = 1, exactly over Q, and the
 *     focus of the image of y = x² under a similarity is the image of (0, 1/4).
 */
import { describe } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import { coeffsOf } from '../src/conic';
import { vCross, vDot, vSub } from '../src/geom';
import type { Vec } from '../src/value';
import { onLine } from './helpers/circle-properties';
import { asConic, onConic } from './helpers/conic-properties';
import { num, pt as lit } from './helpers/doc';
import { asPoint, samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, d2, root, sameSize, theoremTests, type Theorem } from './helpers/theorem-runner';

const pt = <T>(f: Figure<T>, n: string): Vec<T> => asPoint(f.get(n));
const other3 = (p: Expr, q: Expr, r: Expr): Selector => ({ kind: 'other', p, rest: [q, r] });
const near = (p: Expr): Selector => ({ kind: 'near', p });

/** Im(a·b·c̄²) = 0 relative to |a||b||c|² (exact over Q). */
function bisects<T>(f: Figure<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): boolean {
  const F = f.F;
  const ab = {
    x: F.sub(F.mul(a.x, b.x), F.mul(a.y, b.y)),
    y: F.add(F.mul(a.x, b.y), F.mul(a.y, b.x)),
  };
  const cc = { x: F.sub(F.mul(c.x, c.x), F.mul(c.y, c.y)), y: F.neg(F.mul(F.add(c.x, c.x), c.y)) };
  const im = F.add(F.mul(ab.x, cc.y), F.mul(ab.y, cc.x));
  const n = F.mul(F.mul(vDot(F, a, a), vDot(F, b, b)), F.mul(vDot(F, c, c), vDot(F, c, c)));
  if (F.kind !== 'float') return F.eq(im, F.zero);
  return F.isZero(F.div(F.mul(im, im), n), 'dimensionless', f.ctx);
}

/**
 * Lines with directions u and v are equally inclined to the axes of the conic k: their
 * bisectors are parallel to the axes, Im(u·v·conj((a − c) + 2bi)) = 0.
 */
function equallyInclined<T>(f: Figure<T>, u: Vec<T>, v: Vec<T>, k: string): boolean {
  const K = asConic<T>(f.get(k));
  const F = f.F;
  const w = { x: F.sub(K.a, K.c), y: F.add(K.b, K.b) };
  // Im(u·v·w̄) = Im(uv)·Re(w) − Re(uv)·Im(w).
  const uv = {
    x: F.sub(F.mul(u.x, v.x), F.mul(u.y, v.y)),
    y: F.add(F.mul(u.x, v.y), F.mul(u.y, v.x)),
  };
  const im = F.sub(F.mul(uv.y, w.x), F.mul(uv.x, w.y));
  if (F.kind !== 'float') return F.eq(im, F.zero);
  const n = F.mul(F.mul(vDot(F, u, u), vDot(F, v, v)), vDot(F, w, w));
  return F.isZero(F.div(F.mul(im, im), n), 'dimensionless', f.ctx);
}

/** dist(P, l)² as cross²/|d|². */
function dist2<T>(f: Figure<T>, P: Vec<T>, l: string): T {
  const L = f.get(l);
  if (L.kind !== 'line') throw new Error(`expected a line, got ${L.kind}`);
  const c = vCross(f.F, vSub(f.F, P, L.p), L.d);
  return f.F.div(f.F.mul(c, c), vDot(f.F, L.d, L.d));
}

const THEOREMS: readonly Theorem[] = [
  {
    name: 'base points: two conics through A, B, C, D meet a fourth time at other(A, B, C) = D',
    modes: ALL,
    build: (b, [A, B, C, D, E, F]) => {
      const k1 = b.call('k_1', 'conic', A, B, C, D, E);
      const k2 = b.call('k_2', 'conic', A, B, C, D, F);
      b.add('S', call('intersect', [k1, k2], [other3(A, B, C)]));
      b.add('T', call('intersect', [k2, k1], [other3(C, D, A)]));
    },
    required: ['k_1', 'k_2', 'S', 'T'],
    check: (f) => samePoints(f, 'S', 'D') && samePoints(f, 'T', 'B'),
  },
  {
    name: 'base points: near(D) and far_from(…) select common points in floats',
    modes: ['float'],
    build: (b, [A, B, C, D, E, F]) => {
      const k1 = b.call('k_1', 'conic', A, B, C, D, E);
      const k2 = b.call('k_2', 'conic', A, B, C, D, F);
      b.add('S', call('intersect', [k1, k2], [near(D)]));
    },
    required: ['k_1', 'k_2', 'S'],
    check: (f) => samePoints(f, 'S', 'D'),
  },
  {
    name: 'the diagonal triangle of the four common points is self-polar for both conics',
    modes: ALL,
    build: (b, [A, B, C, D, E, F]) => {
      const k1 = b.call('k_1', 'conic', A, B, C, D, E);
      const k2 = b.call('k_2', 'conic', A, B, C, D, F);
      const S = b.add('S', call('intersect', [k1, k2], [other3(A, B, C)]));
      const X = b.call('X', 'intersect', call('line', [A, B]), call('line', [C, S]));
      b.call('Y', 'intersect', call('line', [A, C]), call('line', [B, S]));
      b.call('Z', 'intersect', call('line', [A, S]), call('line', [B, C]));
      b.call('p_1', 'polar', X, k1);
      b.call('p_2', 'polar', X, k2);
    },
    required: ['k_1', 'k_2', 'S', 'X', 'Y', 'Z', 'p_1', 'p_2'],
    check: (f) => ['p_1', 'p_2'].every((p) => onLine(f, 'Y', p) && onLine(f, 'Z', p)),
  },
  {
    name: 'a circle meets a conic in four points whose opposite chords are equally inclined to its axes',
    modes: ALL,
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const w = b.call('w', 'circle', A, B, C);
      b.add('S', call('intersect', [k, w], [other3(A, B, C)]));
    },
    required: ['k', 'w', 'S'],
    check: <T>(f: Figure<T>) => {
      const [A, B, C, S] = ['A', 'B', 'C', 'S'].map((n) => pt(f, n)) as [
        Vec<T>,
        Vec<T>,
        Vec<T>,
        Vec<T>,
      ];
      const w = f.get('w');
      // On the circle relative to its size (a nearly flat ABC has a huge circle).
      const on = w.kind === 'circle' && sameSize(f, d2(f.F, S, w.c), w.r2);
      const F = f.F;
      return (
        on &&
        onConic(f, 'S', 'k') &&
        equallyInclined(f, vSub(F, B, A), vSub(F, S, C), 'k') &&
        equallyInclined(f, vSub(F, C, A), vSub(F, S, B), 'k') &&
        equallyInclined(f, vSub(F, S, A), vSub(F, C, B), 'k')
      );
    },
  },
  {
    name: 'the reflective property: the tangent at a point of a conic bisects the lines to the foci',
    modes: ['float'],
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const F1 = b.add('F_1', call('foci', [k], [near(A)]));
      b.add('F_2', call('foci', [k], [{ kind: 'other', p: F1 }]));
      b.call('t', 'tangent', B, k);
    },
    required: ['k', 'F_1', 'F_2', 't'],
    check: <T>(f: Figure<T>) => {
      const t = f.get('t');
      if (t.kind !== 'line') return false;
      const B = pt(f, 'B');
      return bisects(f, vSub(f.F, pt(f, 'F_1'), B), vSub(f.F, pt(f, 'F_2'), B), t.d);
    },
  },
  {
    name: 'the focal sum (ellipse) or difference (hyperbola) is the same at every point',
    modes: ['float'],
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const F1 = b.add('F_1', call('foci', [k], [near(A)]));
      b.add('F_2', call('foci', [k], [{ kind: 'other', p: F1 }]));
      b.call('P', 'on', k, num(3), num(-2));
    },
    required: ['k', 'F_1', 'F_2', 'P'],
    check: <T>(f: Figure<T>) => {
      const F = f.F;
      const K = asConic<T>(f.get('k'));
      const q = coeffsOf(K);
      const ellipse = F.toNumber(F.sub(F.mul(q[0], q[2]), F.mul(q[1], q[1]))) > 0;
      const [F1, F2] = [pt(f, 'F_1'), pt(f, 'F_2')];
      const focal = (X: Vec<T>) => {
        const [r1, r2] = [root(F, d2(F, X, F1)), root(F, d2(F, X, F2))];
        const v = ellipse ? F.add(r1, r2) : F.sub(r1, r2);
        return ellipse || F.toNumber(v) >= 0 ? v : F.neg(v);
      };
      return ['A', 'B', 'C', 'P'].every((n) => sameSize(f, focal(pt(f, n)), focal(pt(f, 'E'))));
    },
  },
  {
    name: 'focus and directrix: the polar of a focus is the directrix, |PF| = e·dist(P, directrix)',
    modes: ['float'],
    build: (b, [A, B, C, D, E]) => {
      const k = b.call('k', 'conic', A, B, C, D, E);
      const F1 = b.add('F_1', call('foci', [k], [near(A)]));
      b.call('d', 'polar', F1, k);
    },
    required: ['k', 'F_1', 'd'],
    check: <T>(f: Figure<T>) => {
      const F = f.F;
      const F1 = pt(f, 'F_1');
      // |PF|²·dist(Q, d)² = |QF|²·dist(P, d)² for every two points P, Q.
      const e2 = (X: Vec<T>): [T, T] => [d2(F, X, F1), dist2(f, X, 'd')];
      const [a0, b0] = e2(pt(f, 'E'));
      return ['A', 'B', 'C', 'D'].every((n) => {
        const [a, c] = e2(pt(f, n));
        return sameSize(f, F.mul(a, b0), F.mul(a0, c));
      });
    },
  },
  {
    name: 'the parabola: the image of (0, 1/4) is the focus of the image of y = x², and |PF| = dist(P, directrix)',
    modes: ALL,
    build: (b, [A, B]) => {
      const T = b.call('T', 'spiral', lit(0, 0), lit(1, 0), A, B);
      const img = (x: number | string, y: number | string, n: string) =>
        b.call(n, 'apply', T, lit(x, y));
      const P = [
        img(0, 0, 'P_0'),
        img(1, 1, 'P_1'),
        img(-1, 1, 'P_2'),
        img(2, 4, 'P_3'),
        img(-3, 9, 'P_4'),
      ];
      const k = b.call('k', 'conic', ...P);
      const F = b.add('F_0', call('foci', [k], [near(A)]));
      img(0, '1/4', 'G');
      b.call('d', 'polar', F, k);
      b.call('X', 'on', k, num(5), num(-3));
    },
    required: ['T', 'k', 'F_0', 'G', 'd', 'X'],
    check: <T>(f: Figure<T>) => {
      const F = f.F;
      const X = pt(f, 'X');
      return (
        samePoints(f, 'F_0', 'G') &&
        sameSize(f, d2(F, X, pt(f, 'F_0')), dist2(f, X, 'd')) &&
        onConic(f, 'X', 'k')
      );
    },
  },
];

describe('conic ∩ conic and foci theorems (Run 16c)', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 1629);
});
