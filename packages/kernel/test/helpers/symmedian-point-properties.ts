/**
 * Property test of symmedian_point (ADR-0033), spread into tools.property.test.ts's PROPERTIES.
 * The tool is rational, so the identities are checked exactly over Q (and in floats).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { onLine } from './circle-properties';
import { samePoints } from './figure';
import type { V11Property } from './v11-properties';

const BOTH = [RationalField, FloatField] as Field<unknown>[];

export const SYMMEDIAN_POINT_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['symmedian_point', 'isogonal', 'centroid', 'symmedian'],
    name: 'symmedian_point(A, B, C) = isogonal(centroid(A, B, C), A, B, C), on the three symmedians, in any order',
    build: (b, [A, B, C]) => {
      b.call('K', 'symmedian_point', A, B, C);
      b.call('X', 'isogonal', call('centroid', [A, B, C]), A, B, C);
      b.call('K_1', 'symmedian_point', C, A, B);
      b.call('s_a', 'symmedian', A, B, C);
      b.call('s_b', 'symmedian', B, C, A);
      b.call('s_c', 'symmedian', C, A, B);
    },
    required: ['K', 'X'],
    check: (f) =>
      samePoints(f, 'K', 'X') &&
      samePoints(f, 'K', 'K_1') &&
      onLine(f, 'K', 's_a') &&
      onLine(f, 'K', 's_b') &&
      onLine(f, 'K', 's_c'),
    fields: BOTH,
  },
];
