/**
 * Theorems through an inversion (Run 14, ADR-0032), on random figures over FloatField and
 * exactly over RationalField (helpers/theorem-runner.ts; ill-conditioned float figures are
 * skipped and counted, never passed):
 *   - the √(bc) map of triangle ABC swaps B and C and maps the circumcircle to line BC (and
 *     line BC back to the circumcircle);
 *   - the orthocenter inversion maps the circumcircle to the nine-point circle and each
 *     vertex to the foot of its altitude;
 *   - Ptolemy, through the inversion at A: for A, B, C, D on one circle the images B*, C*, D*
 *     are collinear (exactly over Q), and one of AB·CD, AC·BD, AD·BC is the sum of the other
 *     two (the products are B*C*, C*D*, B*D* times AB·AC·AD; floats);
 *   - incidence and tangency are kept: a point on a curve maps to a point on the image curve;
 *     a tangent line and its circle map to tangent curves (two parallel lines when the touch
 *     point is the center).
 * The checks state what they compare; nothing here is a verdict of the claim tester.
 */
import type { Field } from '@geomira/num/field';
import { describe } from 'vitest';
import { call } from '../src/expr';
import { vCross, vDot, vSub } from '../src/geom';
import type { Value, Vec } from '../src/value';
import { num } from './helpers/doc';
import { asPoint, samePoints, type Figure } from './helpers/figure';
import { LAW_TIMEOUT } from './helpers/laws';
import { ALL, SIDES, theoremTests, type Theorem } from './helpers/theorem-runner';

/** x = 0 relative to the magnitude m (exactly in exact fields). */
function zeroRel<T>(f: Figure<T>, x: T, m: number): boolean {
  if (f.F.kind !== 'float') return f.F.eq(x, f.F.zero);
  return Math.abs(f.F.toNumber(x)) <= 1e-8 * Math.max(1, m);
}

const n2 = <T>(F: Field<T>, v: Vec<T>): number => F.toNumber(vDot(F, v, v));

/** Whether point P lies on the curve (line or circle) value k. */
function onCurve<T>(f: Figure<T>, P: Vec<T>, k: Value<T>): boolean {
  const F = f.F;
  if (k.kind === 'line') {
    const w = vSub(F, P, k.p);
    return zeroRel(f, vCross(F, w, k.d), Math.sqrt(n2(F, w) * n2(F, k.d)));
  }
  if (k.kind !== 'circle') return false;
  const w = vSub(F, P, k.c);
  return zeroRel(f, F.sub(vDot(F, w, w), k.r2), F.toNumber(k.r2) + n2(F, w));
}

/** Whether two curves (lines or circles) are tangent, two parallel lines counting as tangent. */
function tangent<T>(f: Figure<T>, a: Value<T>, b: Value<T>): boolean {
  const F = f.F;
  if (a.kind === 'line' && b.kind === 'line')
    return zeroRel(f, vCross(F, a.d, b.d), Math.sqrt(n2(F, a.d) * n2(F, b.d)));
  if (a.kind === 'circle' && b.kind === 'line') return tangent(f, b, a);
  if (a.kind === 'line' && b.kind === 'circle') {
    const c = vCross(F, vSub(F, b.c, a.p), a.d);
    const dd = vDot(F, a.d, a.d);
    const m = F.toNumber(F.mul(b.r2, dd));
    return zeroRel(f, F.sub(F.mul(c, c), F.mul(b.r2, dd)), m);
  }
  if (a.kind !== 'circle' || b.kind !== 'circle') return false;
  const s = vDot(F, vSub(F, a.c, b.c), vSub(F, a.c, b.c));
  const e = F.sub(F.sub(s, a.r2), b.r2);
  const four = F.add(F.add(F.one, F.one), F.add(F.one, F.one));
  const m = (F.toNumber(s) + F.toNumber(a.r2) + F.toNumber(b.r2)) ** 2;
  return zeroRel(f, F.sub(F.mul(e, e), F.mul(four, F.mul(a.r2, b.r2))), m);
}

/** Whether two circles (names) have the same center and radius. */
function sameCircles<T>(f: Figure<T>, a: string, b: string): boolean {
  const [u, v] = [f.get(a), f.get(b)];
  if (u.kind !== 'circle' || v.kind !== 'circle') return false;
  const F = f.F;
  const m = F.toNumber(u.r2) + n2(F, u.c);
  return (
    zeroRel(f, F.sub(u.c.x, v.c.x), Math.sqrt(m)) &&
    zeroRel(f, F.sub(u.c.y, v.c.y), Math.sqrt(m)) &&
    zeroRel(f, F.sub(u.r2, v.r2), m)
  );
}

const dist = (F: Field<number>, P: Vec<number>, Q: Vec<number>): number =>
  Math.sqrt(n2(F, vSub(F, P, Q)));

/** Ptolemy's equality: the largest of the three products is the sum of the other two. */
function ptolemy<T>(f: Figure<T>): boolean {
  const g = (n: string) => asPoint(f.get(n));
  const [A, B, C, D, Bs, Cs, Ds] = ['A', 'B', 'C', 'Q', 'B*', 'C*', 'Q*'].map(g);
  if (!A || !B || !C || !D || !Bs || !Cs || !Ds) return false;
  const F = f.F;
  const collinear = zeroRel(
    f,
    vCross(F, vSub(F, Cs, Bs), vSub(F, Ds, Bs)),
    n2(F, vSub(F, Cs, Bs)) + n2(F, vSub(F, Ds, Bs)),
  );
  if (F.kind !== 'float') return collinear;
  const Fn = F as unknown as Field<number>;
  const [P, Q, R, S] = [A, B, C, D] as unknown as Vec<number>[];
  if (!P || !Q || !R || !S) return false;
  const prods = [
    dist(Fn, P, Q) * dist(Fn, R, S),
    dist(Fn, P, R) * dist(Fn, Q, S),
    dist(Fn, P, S) * dist(Fn, Q, R),
  ].sort((x, y) => x - y);
  const [x = 0, y = 0, z = 0] = prods;
  return collinear && Math.abs(x + y - z) <= 1e-8 * z;
}

const THEOREMS: readonly Theorem[] = [
  {
    name: 'the √(bc) map swaps B and C and maps the circumcircle to line BC',
    modes: SIDES,
    build: (b, [A, B, C]) => {
      const s = b.call('s', 'sqrt_bc', A, B, C);
      b.call('X', 'apply', s, B);
      b.call('Y', 'apply', s, C);
      b.call('k', 'apply', s, call('circumcircle', [A, B, C]));
      b.call('m', 'apply', s, call('line', [B, C]));
      b.call('w', 'circumcircle', A, B, C);
    },
    required: ['X', 'Y', 'k', 'm', 'w'],
    check: (f) =>
      samePoints(f, 'X', 'C') &&
      samePoints(f, 'Y', 'B') &&
      f.get('k').kind === 'line' &&
      onCurve(f, asPoint(f.get('B')), f.get('k')) &&
      onCurve(f, asPoint(f.get('C')), f.get('k')) &&
      sameCircles(f, 'm', 'w'),
  },
  {
    name: 'the orthocenter inversion maps the circumcircle to the nine-point circle, A to its foot',
    modes: ALL,
    build: (b, [A, B, C]) => {
      const h = b.call('h', 'orthocenter_inversion', A, B, C);
      b.call('k', 'apply', h, call('circumcircle', [A, B, C]));
      b.call('n', 'ninepoint_circle', A, B, C);
      b.call('X', 'apply', h, A);
      b.call('H_a', 'foot', A, B, C);
    },
    required: ['k', 'n', 'X', 'H_a'],
    check: (f) => sameCircles(f, 'k', 'n') && samePoints(f, 'X', 'H_a'),
  },
  {
    name: 'Ptolemy through the inversion at A: B*, C*, D* collinear; a product is the sum of two',
    modes: ALL,
    build: (b, [A, B, C, , E]) => {
      const w = b.call('w', 'circumcircle', A, B, C);
      const D = b.call('Q', 'other', call('line', [C, E]), w, C);
      const j = b.call('j', 'inversion', A, num(1));
      for (const [n, P] of [
        ['B*', B],
        ['C*', C],
        ['Q*', D],
      ] as const)
        b.add(n.replace('*', '_s'), call('apply', [j, P]));
    },
    required: ['Q', 'B_s', 'C_s', 'Q_s'],
    check: (f) =>
      ptolemy({
        F: f.F,
        ctx: f.ctx,
        get: (n) => f.get(n.endsWith('*') ? n.replace('*', '_s') : n),
      }),
  },
  {
    name: 'incidence and tangency are kept: P on c and l, the tangent at P, under inversion(D, E)',
    modes: ALL,
    build: (b, [A, B, C, D, E]) => {
      const c = b.call('c', 'circle', A, B);
      const P = b.call('P', 'other', call('line', [B, C]), c, B);
      const t = b.call('t', 'tangent', P, c);
      const l = b.call('l', 'line', P, D);
      const j = b.call('j', 'inversion', call('circle', [D, E]));
      b.call('P_s', 'apply', j, P);
      b.call('c_s', 'apply', j, c);
      b.call('t_s', 'apply', j, t);
      b.call('l_s', 'apply', j, l);
    },
    required: ['P_s', 'c_s', 't_s', 'l_s'],
    check: (f) => {
      const P = asPoint(f.get('P_s'));
      return (
        onCurve(f, P, f.get('c_s')) &&
        onCurve(f, P, f.get('t_s')) &&
        onCurve(f, P, f.get('l_s')) &&
        tangent(f, f.get('c_s'), f.get('t_s'))
      );
    },
  },
];

describe('theorems through an inversion', { timeout: LAW_TIMEOUT }, () => {
  theoremTests(THEOREMS, 1914);
});
