/**
 * Property tests of Run 14's inversion tools (ADR-0032), spread into tools.property.test.ts's
 * PROPERTIES (whose meta-test checks that every registry tool has one), and of ADR-0034's
 * feet_inversion and sqrt_bc2. inversion and every preset but sqrt_bc and sqrt_bc2 are
 * rational, so their identities are checked exactly over Q; sqrt_bc and sqrt_bc2 need square
 * roots (Inexact over Q on random figures: the theorem tests use Heronian ones) and are
 * checked in floats here.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { vCross, vDot, vSub } from '../../src/geom';
import { onCircle } from './circle-properties';
import { num, q } from './doc';
import { asPoint, samePoints, type Figure } from './figure';
import type { V11Property } from './v11-properties';

const EXACT = [RationalField] as Field<unknown>[];
const BOTH = [RationalField, FloatField] as Field<unknown>[];
const FLOAT = [FloatField] as Field<unknown>[];

/** X* lies on ray AX (or the opposite ray for k < 0) with AX⃗·AX*⃗ = k. */
function invertedAt<T>(f: Figure<T>, a: string, x: string, xs: string, k: string): boolean {
  const F = f.F;
  const [A, X, Y] = [a, x, xs].map((n) => asPoint(f.get(n)));
  if (A === undefined || X === undefined || Y === undefined) return false;
  const [u, w] = [vSub(F, X, A), vSub(F, Y, A)];
  const kk = F.fromRational(q(k));
  if (isInexact(kk)) return false;
  return (
    F.isZero(vCross(F, u, w), 'area', f.ctx) && F.isZero(F.sub(vDot(F, u, w), kk), 'area', f.ctx)
  );
}

export const MOBIUS_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['inversion', 'apply', 'compose', 'inverse'],
    name: 'inversion(A, 5): B* on ray AB with AB·AB* = 5; applying it twice, or its inverse, gives B back',
    build: (b, [A, B]) => {
      const j = b.call('j', 'inversion', A, num(5));
      const Bs = b.call('X', 'apply', j, B);
      b.call('Y', 'apply', j, Bs);
      b.call('Z', 'apply', call('inverse', [j]), Bs);
      b.call('W', 'apply', call('compose', [j, j]), B);
    },
    required: ['X'],
    check: (f) =>
      invertedAt(f, 'A', 'B', 'X', '5') &&
      samePoints(f, 'Y', 'B') &&
      samePoints(f, 'Z', 'B') &&
      samePoints(f, 'W', 'B'),
    fields: EXACT,
  },
  {
    tools: ['inversion', 'inversion_fixing'],
    name: 'inversion(c) fixes the points of c; inversion_fixing(D, c) maps c to itself',
    build: (b, [A, B, C, D]) => {
      const c = b.call('c', 'circle', A, B);
      b.call('X', 'apply', call('inversion', [c]), B);
      const P = b.call('P', 'other', call('line', [B, C]), c, B);
      b.call('Y', 'apply', call('inversion_fixing', [D, c]), P);
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'B') && onCircle(f, 'Y', 'c'),
    fields: BOTH,
  },
  {
    tools: ['sqrt_bc'],
    name: 'sqrt_bc(A, B, C) swaps B and C',
    build: (b, [A, B, C]) => {
      const s = b.call('s', 'sqrt_bc', A, B, C);
      b.call('X', 'apply', s, B);
      b.call('Y', 'apply', s, C);
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'C') && samePoints(f, 'Y', 'B'),
    fields: FLOAT,
  },
  {
    tools: ['sqrt_bc2'],
    name: 'sqrt_bc2(A, B, C) maps B to the midpoint of AC and that midpoint back to B',
    build: (b, [A, B, C]) => {
      const s = b.call('s', 'sqrt_bc2', A, B, C);
      b.call('M', 'midpoint', A, C);
      b.call('X', 'apply', s, B);
      b.call('Y', 'apply', s, b.ref('M'));
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'M') && samePoints(f, 'Y', 'B'),
    fields: FLOAT,
  },
  {
    tools: ['feet_inversion'],
    name: 'feet_inversion(A, B, C) maps B to the foot from C, and back',
    build: (b, [A, B, C]) => {
      const f = b.call('f', 'feet_inversion', A, B, C);
      b.call('F_c', 'foot', C, A, B);
      b.call('X', 'apply', f, B);
      b.call('Y', 'apply', f, b.ref('F_c'));
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'F_c') && samePoints(f, 'Y', 'B'),
    fields: BOTH,
  },
  {
    tools: ['orthocenter_inversion'],
    name: 'orthocenter_inversion(A, B, C) maps A to the foot of its altitude, and back',
    build: (b, [A, B, C]) => {
      const h = b.call('h', 'orthocenter_inversion', A, B, C);
      b.call('X', 'apply', h, A);
      b.call('F_a', 'foot', A, B, C);
      b.call('Y', 'apply', h, b.ref('F_a'));
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'F_a') && samePoints(f, 'Y', 'A'),
    fields: BOTH,
  },
  {
    tools: ['inversion_swap'],
    name: 'inversion_swap(O, A, B) swaps A and B for O = the midpoint (negative power) and O = 2B − A',
    build: (b, [A, B]) => {
      const M = b.call('M', 'midpoint', A, B);
      const O = b.call('O', 'apply', call('reflect', [B]), A);
      b.call('X', 'apply', call('inversion_swap', [M, A, B]), A);
      b.call('Y', 'apply', call('inversion_swap', [O, A, B]), B);
    },
    required: ['X', 'Y'],
    check: (f) => samePoints(f, 'X', 'B') && samePoints(f, 'Y', 'A'),
    fields: BOTH,
  },
];
