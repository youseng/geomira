/**
 * A test-only claim kind (ADR-0035, in the style of SPEC §18 E2's test-only value kind):
 * test_isosceles(A, B, C) means AB = AC, built from the length kind's own algebra. It is in no
 * registry but the ones tests build, so it shows that a kind added later runs through the
 * tester and the finder without changing them.
 */
import { rational } from '@geomira/num/rational';
import { isInexact } from '@geomira/num/field';
import { numOf, undef } from '@geomira/kernel/value';
import type { ClaimKindSpec } from '../../src/kind';
import { claimKind } from '../../src/kinds';

const ONE = rational(1n);

function length(): ClaimKindSpec {
  const k = claimKind('length');
  if (k === undefined) throw new Error('length');
  return k;
}

export const TEST_ISOSCELES: ClaimKindSpec = {
  name: 'test_isosceles',
  params: ['point', 'point', 'point'],
  polynomial: true,
  test: 'floor',
  doc: 'test_isosceles(A, B, C): AB = AC.',
  algebra: (F, args, ctx) => {
    const [a, b, c] = args;
    const one = F.fromRational(ONE);
    if (a === undefined || b === undefined || c === undefined) return undef('three points');
    if (isInexact(one)) return one;
    return length().algebra(F, [a, b, a, c, numOf(one, ONE)], ctx);
  },
  residual: (args, ctx) => {
    const [a, b, c] = args;
    if (a === undefined || b === undefined || c === undefined) return Infinity;
    return length().residual([a, b, a, c, numOf(1, ONE)], ctx);
  },
  symmetry: [{ perm: [0, 2, 1] }],
};
