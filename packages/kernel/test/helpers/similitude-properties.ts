/**
 * Property tests of the centres of similitude (ADR-0045), spread into tools.property.test.ts's
 * PROPERTIES. The circles have rational radii (circle(A, 3), circle(B, 5)), so the exact run
 * checks each identity exactly over Q.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { vCross, vSub } from '../../src/geom';
import { num } from './doc';
import { asPoint, samePoints } from './figure';
import type { V11Property } from './v11-properties';

const BOTH = [RationalField, FloatField] as Field<unknown>[];

export const SIMILITUDE_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['exsimilicenter', 'insimilicenter'],
    name: 'the homothety of ratio ±r₂/r₁ about the exsimilicenter / insimilicenter takes O₁ to O₂, in either order of the circles',
    build: (b, [A, B]) => {
      const [c1, c2] = [b.call('c', 'circle', A, num(3)), b.call('d', 'circle', B, num(5))];
      const E = b.call('E', 'exsimilicenter', c1, c2);
      const I = b.call('I', 'insimilicenter', c1, c2);
      b.call('E_2', 'exsimilicenter', c2, c1);
      b.call('I_2', 'insimilicenter', c2, c1);
      b.call('X', 'homothety', A, E, num('5/3'));
      b.call('Y', 'homothety', A, I, num('-5/3'));
    },
    required: ['E', 'I', 'X', 'Y'],
    check: (f) =>
      samePoints(f, 'X', 'B') &&
      samePoints(f, 'Y', 'B') &&
      samePoints(f, 'E', 'E_2') &&
      samePoints(f, 'I', 'I_2'),
    fields: BOTH,
  },
  {
    tools: ['exsimilicenter', 'insimilicenter'],
    name: 'equal radii: the exsimilicenter is the point at infinity of AB (line(C, E) ∥ AB) and the insimilicenter the midpoint',
    build: (b, [A, B, C]) => {
      const [c1, c2] = [b.call('c', 'circle', A, num(2)), b.call('d', 'circle', B, num(2))];
      b.call('E', 'exsimilicenter', c1, c2);
      b.call('I', 'insimilicenter', c1, c2);
      b.call('M', 'midpoint', A, B);
      b.call('l', 'line', C, b.ref('E'));
    },
    required: ['E', 'I', 'l'],
    check: (f) => {
      const l = f.get('l');
      const [A, B] = [asPoint(f.get('A')), asPoint(f.get('B'))];
      return (
        f.get('E').kind === 'ideal_point' &&
        samePoints(f, 'I', 'M') &&
        l.kind === 'line' &&
        f.F.isZero(vCross(f.F, l.d, vSub(f.F, B, A)), 'area', f.ctx)
      );
    },
    fields: BOTH,
  },
  {
    tools: ['exsimilicenter', 'insimilicenter'],
    name: 'the centres of similitude divide O₁O₂ harmonically: (O₁, O₂; I, E) = −1',
    build: (b, [A, B]) => {
      const [c1, c2] = [b.call('c', 'circle', A, num('7/2')), b.call('d', 'circle', B, num(1))];
      b.call('E', 'exsimilicenter', c1, c2);
      b.call('I', 'insimilicenter', c1, c2);
      b.add('J', call('harmonic_conjugate', [A, B, b.ref('I')]));
    },
    required: ['E', 'I', 'J'],
    check: (f) => samePoints(f, 'J', 'E'),
    fields: BOTH,
  },
];
