import { describe, expect, it } from 'vitest';
import { lit, ref } from '@geomira/kernel/expr';
import { rational } from '@geomira/num/rational';
import { claimProblem } from '../src/check';
import { CLAIM_KINDS } from '../src/kinds';

describe('claimProblem (the static claim check the language reports, ADR-0009)', () => {
  const two = lit(rational(2n));
  it('accepts well-formed claims of every kind', () => {
    for (const k of CLAIM_KINDS) {
      const args = k.params.map((p) => (p === 'integer' || p === 'number' ? two : ref(1)));
      expect(claimProblem({ kind: k.name, args }), k.name).toBeUndefined();
    }
  });

  it('reports unknown kinds, counts and forms', () => {
    expect(claimProblem({ kind: 'nope', args: [] })).toBe('unknown claim "nope"');
    expect(claimProblem({ kind: 'collinear', args: [ref(1), ref(2)] })).toBe(
      'collinear takes at least 3 arguments, got 2',
    );
    expect(claimProblem({ kind: 'parallel', args: [ref(1), ref(2), ref(3)] })).toBe(
      'parallel takes 2 arguments, got 3',
    );
    expect(claimProblem({ kind: 'length', args: [ref(1), ref(2), ref(3), ref(4), ref(5)] })).toBe(
      'length: argument 5 must be an exact number',
    );
    expect(claimProblem({ kind: 'equal', args: [two, ref(1)] })).toBe(
      'equal: argument 1 must be an object',
    );
  });
});
