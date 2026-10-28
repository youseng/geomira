/**
 * Property tests of Run 16a's projective tools (ADR-0040), spread into tools.property.test.ts's
 * PROPERTIES (whose meta-test checks that every registry tool has one). Both constructors are
 * rational, so their identities are checked exactly over Q (law L3 compares the floats).
 */
import type { Field } from '@geomira/num/field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { num } from './doc';
import { vCross, vSub } from '../../src/geom';
import { samePoints, type Figure } from './figure';
import type { V11Property } from './v11-properties';

const EXACT = [RationalField] as Field<unknown>[];

/** Whether the value of `x` is a point at infinity whose direction is that of line `l`. */
function idealOf<T>(f: Figure<T>, x: string, l: string): boolean {
  const [v, m] = [f.get(x), f.get(l)];
  return (
    v.kind === 'ideal_point' &&
    m.kind === 'line' &&
    f.F.isZero(vCross(f.F, v.d, m.d), 'dimensionless', f.ctx)
  );
}

/** Whether two lines have one carrier. */
function sameLine<T>(f: Figure<T>, a: string, b: string): boolean {
  const [l, m] = [f.get(a), f.get(b)];
  if (l.kind !== 'line' || m.kind !== 'line') return false;
  const F = f.F;
  return (
    F.isZero(vCross(F, l.d, m.d), 'dimensionless', f.ctx) &&
    F.isZero(vCross(F, l.d, vSub(F, m.p, l.p)), 'area', f.ctx)
  );
}

/** Whether point `x` lies on line `l`'s carrier. */
function onLine<T>(f: Figure<T>, x: string, l: string): boolean {
  const [v, m] = [f.get(x), f.get(l)];
  return (
    v.kind === 'point' &&
    m.kind === 'line' &&
    f.F.isZero(vCross(f.F, m.d, vSub(f.F, v, m.p)), 'area', f.ctx)
  );
}

export const PROJECTIVE_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['projective', 'apply'],
    name: 'projective(A, B, C, D, B, C, D, A) takes A to B, B to C, C to D and D to A',
    build: (b, [A, B, C, D]) => {
      const f = b.call('f', 'projective', A, B, C, D, B, C, D, A);
      b.call('W', 'apply', f, A);
      b.call('X', 'apply', f, B);
      b.call('Y', 'apply', f, C);
      b.call('Z', 'apply', f, D);
    },
    required: ['W', 'X', 'Y', 'Z'],
    check: (f) =>
      samePoints(f, 'W', 'B') &&
      samePoints(f, 'X', 'C') &&
      samePoints(f, 'Y', 'D') &&
      samePoints(f, 'Z', 'A'),
    fields: EXACT,
  },
  {
    tools: ['send_to_infinity', 'apply', 'line'],
    name: 'send_to_infinity(AB) sends A to infinity; C** = C; the image of line CD contains C* and D*',
    build: (b, [A, B, C, D]) => {
      const l = b.call('l', 'line', A, B);
      const f = b.call('f', 'send_to_infinity', l);
      b.call('A_s', 'apply', f, A);
      const Cs = b.call('C_s', 'apply', f, C);
      b.call('D_s', 'apply', f, D);
      b.call('C_t', 'apply', f, Cs);
      b.call('k', 'apply', f, call('line', [C, D]));
    },
    required: ['C_s', 'D_s', 'C_t', 'k'],
    check: (f) =>
      f.get('A_s').kind === 'ideal_point' &&
      samePoints(f, 'C_t', 'C') &&
      onLine(f, 'C_s', 'k') &&
      onLine(f, 'D_s', 'k'),
    // Exact: images near infinity are far from the figure, beyond EPS·scale² in floats (L3 checks them).
    fields: EXACT,
  },
  {
    tools: ['send_to_infinity', 'intersect', 'line'],
    name: 'the image of the point at infinity of CD lies on l = AB; line(P, X∞) is the parallel to CD',
    build: (b, [A, B, C, D]) => {
      const l = b.call('l', 'line', A, B);
      const cd = b.call('cd', 'line', C, D);
      const X = b.call('X', 'intersect', cd, call('parallel', [A, cd]));
      b.call('X_s', 'apply', call('send_to_infinity', [l]), X);
      b.call('m', 'line', B, X);
    },
    required: ['X_s', 'm'],
    check: (f) => idealOf(f, 'X', 'cd') && onLine(f, 'X_s', 'l') && idealOf(f, 'X', 'm'),
    fields: EXACT,
  },
  {
    tools: ['harmonic_conjugate', 'divide'],
    name: 'harmonic_conjugate is an involution on line AB: the conjugate of D is C; swapping A, B keeps D',
    build: (b, [A, B]) => {
      const C = b.call('C2', 'divide', A, B, num('2/7'));
      const D = b.call('D2', 'harmonic_conjugate', A, B, C);
      b.call('E2', 'harmonic_conjugate', A, B, D);
      b.call('F2', 'harmonic_conjugate', B, A, C);
    },
    required: ['D2', 'E2', 'F2'],
    check: (f) => samePoints(f, 'E2', 'C2') && samePoints(f, 'F2', 'D2'),
    fields: EXACT,
  },
  {
    tools: ['harmonic_conjugate', 'line'],
    name: 'the line form is an involution in the pencil of AB, AC (through A)',
    build: (b, [A, B, C, D]) => {
      const [a, c] = [b.call('a', 'line', A, B), b.call('c', 'line', A, C)];
      const d = b.call('d', 'line', A, D);
      const e = b.call('e', 'harmonic_conjugate', a, c, d);
      b.call('g', 'harmonic_conjugate', a, c, e);
      b.call('Q', 'intersect', e, call('line', [B, C]));
    },
    required: ['e', 'g'],
    check: (f) => sameLine(f, 'g', 'd'),
    fields: EXACT,
  },
];
