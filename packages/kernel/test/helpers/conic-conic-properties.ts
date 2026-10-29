/**
 * Property tests of Run 16c (ADR-0043), spread into tools.property.test.ts's PROPERTIES. The
 * figures are the four random points A, B, C, D, with E (D's mirror image in AB) and G (C's in
 * AD) as fifth points of two conics through A, B, C, D.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call, type Expr, type Selector } from '../../src/expr';
import type { Builder } from './doc';
import { samePoints, type Figure, type Pts } from './figure';
import { onConic, withConic } from './conic-properties';
import type { V11Property } from './v11-properties';

const BOTH = [RationalField, FloatField] as Field<unknown>[];
const FLOAT = [FloatField] as Field<unknown>[];
const other3 = (p: Expr, q: Expr, r: Expr): Selector => ({ kind: 'other', p, rest: [q, r] });

/** k = conic(A, B, C, D, E) and m = conic(A, B, C, D, G). */
function twoConics(b: Builder, p: Pts): { k: Expr; m: Expr } {
  const { k } = withConic(b, p);
  const [A, , C, D] = p;
  const G = b.call('G', 'reflect', C, call('line', [A, D]));
  return { k, m: b.call('m', 'conic', p[0], p[1], p[2], p[3], G) };
}

export const CONIC_CONIC_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['intersect'],
    name: 'conic ∩ conic: other(A, B, C) of two conics through A, B, C, D is D in either order, on both',
    build: (b, p) => {
      const { k, m } = twoConics(b, p);
      const [A, B, C] = p;
      b.add('X', call('intersect', [k, m], [other3(A, B, C)]));
      b.add('Y', call('intersect', [m, k], [other3(B, C, A)]));
    },
    required: ['k', 'm', 'X', 'Y'],
    check: (f) =>
      samePoints(f, 'X', 'D') &&
      samePoints(f, 'Y', 'D') &&
      onConic(f, 'X', 'k') &&
      onConic(f, 'X', 'm'),
    fields: BOTH,
  },
  {
    tools: ['intersect'],
    name: 'conic ∩ conic in floats: near(B) is B and far_from(B) is one of A, C, D, whichever order',
    build: (b, p) => {
      const { k, m } = twoConics(b, p);
      const B = p[1];
      b.add('X', call('intersect', [k, m], [{ kind: 'near', p: B }]));
      b.add('Y', call('intersect', [m, k], [{ kind: 'far_from', p: B }]));
    },
    required: ['k', 'm', 'X', 'Y'],
    check: (f) => samePoints(f, 'X', 'B') && ['A', 'C', 'D'].some((n) => samePoints(f, 'Y', n)),
    fields: FLOAT,
  },
  {
    tools: ['foci', 'conic_center'],
    name: 'foci(k, near(A)) and foci(k, other(F)): their midpoint is conic_center(k), and other(other(F)) = F',
    build: (b, p) => {
      const { k } = withConic(b, p);
      const F = b.add('F', call('foci', [k], [{ kind: 'near', p: p[0] }]));
      const H = b.add('H', call('foci', [k], [{ kind: 'other', p: F }]));
      b.add('J', call('foci', [k], [{ kind: 'other', p: H }]));
      b.call('O', 'conic_center', k);
      b.call('M', 'midpoint', F, H);
    },
    required: ['k', 'F', 'H', 'J', 'O', 'M'],
    check: <T>(f: Figure<T>) =>
      f.get('O').kind === 'point' && samePoints(f, 'M', 'O') && samePoints(f, 'J', 'F'),
    fields: FLOAT,
  },
  {
    tools: ['foci', 'circle'],
    name: 'foci of a circle is its center',
    build: (b, [A, B]) => {
      const c = b.call('c', 'circle', A, B);
      b.call('F', 'foci', c);
    },
    required: ['c', 'F'],
    check: (f) => samePoints(f, 'F', 'A'),
    fields: BOTH,
  },
];
