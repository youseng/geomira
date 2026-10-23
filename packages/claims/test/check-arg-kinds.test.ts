/**
 * claimProblem with the arguments' static kinds (bug-fix round, ADR-0028): an argument whose
 * every possible kind misses its parameter is refused statically, with the tester's own
 * message, so `claim l = m` or `claim radius(ω) = radius(γ)` is an error where it is written
 * instead of an "invalid" verdict at test time. Without kinds the check is as before.
 */
import { describe, expect, it } from 'vitest';
import { lit, ref, type Expr } from '@geomira/kernel/expr';
import type { ValueKind } from '@geomira/kernel/value';
import { rational } from '@geomira/num/rational';
import { claimProblem } from '../src/check';

const KINDS: Readonly<Record<number, readonly ValueKind[] | undefined>> = {
  1: ['point'],
  2: ['number'],
  3: ['line'],
  4: ['circle'],
  5: ['line', 'circle'],
  6: undefined,
};
const kindsOf = (e: Expr): readonly ValueKind[] | undefined =>
  e.kind === 'ref' ? KINDS[e.id] : e.kind === 'lit' ? ['number'] : undefined;

describe('claimProblem with static kinds', () => {
  it('refuses an argument no kind of which fits, with the message of the tester', () => {
    expect(claimProblem({ kind: 'equal', args: [ref(2), ref(2)] }, kindsOf)).toBe(
      'invalid claim: equal needs point as argument 1, not number',
    );
    expect(claimProblem({ kind: 'equal', args: [ref(1), ref(3)] }, kindsOf)).toBe(
      'invalid claim: equal needs point as argument 2, not line',
    );
    expect(claimProblem({ kind: 'on', args: [ref(1), ref(1)] }, kindsOf)).toBe(
      'invalid claim: on needs curve as argument 2, not point',
    );
    expect(claimProblem({ kind: 'tangent', args: [ref(2), ref(4)] }, kindsOf)).toBe(
      'invalid claim: tangent needs curve as argument 1, not number',
    );
  });

  it('accepts arguments that may fit, and unknown kinds', () => {
    expect(claimProblem({ kind: 'equal', args: [ref(1), ref(6)] }, kindsOf)).toBeUndefined();
    expect(claimProblem({ kind: 'on', args: [ref(1), ref(5)] }, kindsOf)).toBeUndefined();
    expect(claimProblem({ kind: 'tangent', args: [ref(3), ref(4)] }, kindsOf)).toBeUndefined();
    const two = lit(rational(2n));
    expect(
      claimProblem({ kind: 'length', args: [ref(1), ref(1), ref(1), ref(1), two] }, kindsOf),
    ).toBeUndefined();
  });

  it('without kinds, only the form is checked (as before)', () => {
    expect(claimProblem({ kind: 'equal', args: [ref(2), ref(2)] })).toBeUndefined();
  });
});
