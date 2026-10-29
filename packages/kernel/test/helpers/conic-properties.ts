/**
 * Property tests of Run 16b's conic tools (ADR-0042), spread into tools.property.test.ts's
 * PROPERTIES (whose meta-test checks that every registry tool has one). The figures are the four
 * random points A, B, C, D and E, D's mirror image in AB (generically no three collinear). Every
 * conic tool is rational, so its identities hold exactly over Q; circle_to_centre needs a square
 * root and is checked in floats.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call, type Expr } from '../../src/expr';
import { coeffsOf, qValue } from '../../src/conic';
import { requireOnConic } from '../../src/conic-incidence';
import { vCross, vSub } from '../../src/geom';
import type { Conic, Vec } from '../../src/value';
import { num, type Builder } from './doc';
import { asPoint, samePoints, type Figure, type Pts } from './figure';
import type { V11Property } from './v11-properties';

const EXACT = [RationalField] as Field<unknown>[];
const BOTH = [RationalField, FloatField] as Field<unknown>[];
const FLOAT = [FloatField] as Field<unknown>[];

export function asConic<T>(v: { readonly kind: string }): Conic<T> {
  if (v.kind !== 'conic') throw new Error(`expected a conic, got ${v.kind}`);
  return v as Conic<T>;
}

/** Whether point x lies on conic k (exactly over Q; the kernel's banded gap in floats). */
export function onConic<T>(f: Figure<T>, x: string, k: string): boolean {
  const P: Vec<T> = asPoint(f.get(x));
  const K = asConic<T>(f.get(k));
  if (f.F.kind !== 'float') return f.F.eq(qValue(f.F, coeffsOf(K), P), f.F.zero);
  return requireOnConic(f.F, P, K, f.ctx, 'off') === undefined;
}

/** Whether point x lies on line l's carrier. */
function onLine<T>(f: Figure<T>, x: string, l: string): boolean {
  const [v, m] = [f.get(x), f.get(l)];
  return (
    v.kind === 'point' &&
    m.kind === 'line' &&
    f.F.isZero(vCross(f.F, m.d, vSub(f.F, v, m.p)), 'area', f.ctx)
  );
}

/** Whether two named lines have one carrier. */
function sameLine<T>(f: Figure<T>, a: string, b: string): boolean {
  const [l, m] = [f.get(a), f.get(b)];
  if (l.kind !== 'line' || m.kind !== 'line') return false;
  const F = f.F;
  return (
    F.isZero(vCross(F, l.d, m.d), 'dimensionless', f.ctx) &&
    F.isZero(vCross(F, l.d, vSub(F, m.p, l.p)), 'area', f.ctx)
  );
}

/** Whether a conic is a circle: a = c and b = 0 (exactly, or within EPS when not `exact`). */
function isCircle<T>(f: Figure<T>, k: string, exact: boolean): boolean {
  const K = asConic<T>(f.get(k));
  const zero = (x: T) => (exact ? f.F.eq(x, f.F.zero) : f.F.isZero(x, 'dimensionless', f.ctx));
  return zero(f.F.sub(K.a, K.c)) && zero(K.b);
}

/** Whether two conics have the same coefficients (exactly over Q, within EPS in floats). */
function sameConics<T>(f: Figure<T>, a: string, b: string): boolean {
  const [K, L] = [asConic<T>(f.get(a)), asConic<T>(f.get(b))];
  const pairs: [T, T][] = [
    [K.a, L.a],
    [K.b, L.b],
    [K.c, L.c],
    [K.d, L.d],
    [K.e, L.e],
    [K.f, L.f],
  ];
  return pairs.every(([x, y]) => f.F.isZero(f.F.sub(x, y), 'dimensionless', f.ctx));
}

/** Whether point x lies on circle c (|X − O|² − r² as an area). */
function onCircleOf<T>(f: Figure<T>, x: string, c: string): boolean {
  const [X, C] = [asPoint(f.get(x)), f.get(c)];
  if (C.kind !== 'circle') return false;
  const w = vSub(f.F, X, C.c);
  const gap = f.F.sub(f.F.add(f.F.mul(w.x, w.x), f.F.mul(w.y, w.y)), C.r2);
  return f.F.isZero(gap, 'area', f.ctx);
}

/** k through A, B, C, D and E = D's mirror image in AB. */
export function withConic(b: Builder, [A, B, C, D]: Pts): { k: Expr; E: Expr } {
  const E = b.call('E', 'reflect', D, call('line', [A, B]));
  return { E, k: b.call('k', 'conic', A, B, C, D, E) };
}

export const CONIC_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['conic', 'on'],
    name: 'conic(A, B, C, D, E) passes through the five points; on(k, u, v) lies on it, on(k, 1, 0) is A',
    build: (b, p) => {
      const { k } = withConic(b, p);
      b.call('G', 'on', k, num(3), num(2));
      b.call('H', 'on', k, num(1), num(0));
    },
    required: ['k', 'G', 'H'],
    check: (f) =>
      ['A', 'B', 'C', 'D', 'E', 'G'].every((x) => onConic(f, x, 'k')) && samePoints(f, 'H', 'A'),
    fields: BOTH,
  },
  {
    tools: ['conic_center', 'reflect'],
    name: "the reflection of A in conic_center(k) lies on k (a central conic's symmetry)",
    build: (b, p) => {
      const { k } = withConic(b, p);
      const O = b.call('O', 'conic_center', k);
      b.call('A_o', 'reflect', p[0], O);
    },
    required: ['k', 'O', 'A_o'],
    check: (f) => onConic(f, 'A_o', 'k'),
    fields: BOTH,
  },
  {
    tools: ['intersect', 'other', 'line'],
    name: 'line AC meets k at A and C: other(AC, k, A) = intersect(AC, k, other(A)) = C, and along(±) gives A or C',
    build: (b, p) => {
      const { k } = withConic(b, p);
      const l = b.call('l', 'line', p[0], p[2]);
      b.call('X', 'other', l, k, p[0]);
      b.add('Y', call('intersect', [l, k], [{ kind: 'other', p: p[0] }]));
      b.add('Z', call('intersect', [k, l], [{ kind: 'along', sign: 1 }]));
    },
    required: ['k', 'X', 'Y', 'Z'],
    check: (f) =>
      samePoints(f, 'X', 'C') &&
      samePoints(f, 'Y', 'C') &&
      (samePoints(f, 'Z', 'A') || samePoints(f, 'Z', 'C')),
    fields: BOTH,
  },
  {
    tools: ['tangent', 'polar', 'pole'],
    name: 'tangent(A, k) is polar(A, k); pole(tangent(A, k), k) = A; pole(polar(D, k), k) = D',
    build: (b, p) => {
      const { k } = withConic(b, p);
      const t = b.call('t', 'tangent', p[0], k);
      b.call('u', 'polar', p[0], k);
      b.call('P', 'pole', t, k);
      b.call('Q', 'pole', call('polar', [p[3], k]), k);
    },
    required: ['k', 't', 'u', 'P', 'Q'],
    check: (f) =>
      sameLine(f, 't', 'u') &&
      onLine(f, 'A', 't') &&
      samePoints(f, 'P', 'A') &&
      f.get('Q').kind === 'point' &&
      samePoints(f, 'Q', 'D'),
    fields: BOTH,
  },
  {
    tools: ['tangent_point', 'tangent_from'],
    name: 'from P = pole(AB, k) the tangents touch at A and B: tangent_point(P, k, other(A)) = B, tangent_from(P, k, other(A)) passes through P and B',
    build: (b, p) => {
      const { k } = withConic(b, p);
      const P = b.call('P', 'pole', call('line', [p[0], p[1]]), k);
      b.add('T', call('tangent_point', [P, k], [{ kind: 'other', p: p[0] }]));
      b.add('s', call('tangent_from', [P, k], [{ kind: 'other', p: p[0] }]));
    },
    required: ['k', 'P', 'T', 's'],
    check: (f) => samePoints(f, 'T', 'B') && onLine(f, 'P', 's') && onLine(f, 'B', 's'),
    fields: EXACT,
  },
  {
    tools: ['conic_to_circle', 'apply'],
    name: 'conic_to_circle(k) sends k to a circle (a = c, b = 0) through the images of A…E',
    build: (b, p) => {
      const { k, E } = withConic(b, p);
      const g = b.call('g', 'conic_to_circle', k);
      b.call('k_1', 'apply', g, k);
      ['A', 'B', 'C', 'D'].forEach((n, i) => b.call(`${n}_1`, 'apply', g, p[i] ?? E));
      b.call('E_1', 'apply', g, E);
    },
    required: ['k', 'g', 'k_1', 'A_1', 'B_1', 'C_1', 'D_1', 'E_1'],
    check: (f) =>
      isCircle(f, 'k_1', true) &&
      ['A_1', 'B_1', 'C_1', 'D_1', 'E_1'].every((x) => onConic(f, x, 'k_1')),
    fields: EXACT,
  },
  {
    tools: ['circle_to_centre', 'apply', 'center'],
    name: 'circle_to_centre(c, P) sends P to the center and c onto itself (B on c: B* on c)',
    build: (b, [A, B]) => {
      const c = b.call('c', 'circle', A, B);
      const P = b.call('P', 'midpoint', A, B);
      const g = b.call('g', 'circle_to_centre', c, P);
      b.call('P_1', 'apply', g, P);
      b.call('O', 'center', c);
      b.call('B_1', 'apply', g, B);
      b.call('k', 'apply', g, c);
    },
    required: ['g', 'P_1', 'B_1', 'k'],
    check: (f) =>
      samePoints(f, 'P_1', 'O') &&
      onCircleOf(f, 'B_1', 'c') &&
      onConic(f, 'B', 'k') &&
      isCircle(f, 'k', false),
    fields: FLOAT,
  },
  {
    tools: ['apply', 'reflect'],
    name: 'a similarity sends conic(A, …, E) to conic(A*, …, E*) (the normal form is unique)',
    build: (b, p) => {
      const { k, E } = withConic(b, p);
      const s = b.call('s', 'reflect', call('line', [p[2], p[3]]));
      const imgs = [...p, E].map((x, i) => b.call(`P_${String(i)}`, 'apply', s, x));
      b.call('k_1', 'apply', s, k);
      b.call('k_2', 'conic', ...imgs);
    },
    required: ['k', 'k_1', 'k_2'],
    check: (f) => sameConics(f, 'k_1', 'k_2'),
    fields: EXACT,
  },
];
