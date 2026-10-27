/**
 * ADR-0035 decision 12 (b)–(f): the preliminary order of confirmed facts. Exact rungs before
 * numeric, tagged before untagged, fewer objects first, the latest object later in the
 * construction first, the kind's registry order, then the claim key.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { Verdict } from '@geomira/claims/verdict';
import { preliminary } from '../src/rank';
import type { FoundFact } from '../src/types';

const KINDS = claimKindRegistry();

function fact(key: string, over: Partial<FoundFact> = {}): FoundFact {
  return {
    kind: 'collinear',
    args: [],
    key,
    objects: [1, 2, 3],
    verdict: { kind: 'holds' } as unknown as Verdict,
    rungs: 'exact over Q, 1/1',
    exact: true,
    ...over,
  };
}

describe('the preliminary order', () => {
  const order = new Map([1, 2, 3, 4, 5, 6].map((id) => [id, id]));
  const keys = (fs: FoundFact[]) => preliminary(fs, KINDS, order).map((f) => f.key);

  it('exact before numeric; tagged before untagged', () => {
    expect(keys([fact('n', { exact: false }), fact('e')])).toEqual(['e', 'n']);
    expect(keys([fact('u'), fact('t', { tag: { name: 'Euler line', hint: 'h' } })])).toEqual([
      't',
      'u',
    ]);
  });

  it('fewer objects, then the newest object first, then the registry order', () => {
    expect(keys([fact('four', { objects: [1, 2, 3, 4] }), fact('three')])).toEqual([
      'three',
      'four',
    ]);
    expect(
      keys([fact('old', { objects: [1, 2, 3] }), fact('new', { objects: [1, 2, 6] })]),
    ).toEqual(['new', 'old']);
    expect(keys([fact('par', { kind: 'parallel' }), fact('col')])).toEqual(['col', 'par']);
  });

  it('the claim key last, both ways', () => {
    expect(keys([fact('b'), fact('a')])).toEqual(['a', 'b']);
    expect(keys([fact('a'), fact('b')])).toEqual(['a', 'b']);
    expect(keys([fact('a'), fact('a')])).toEqual(['a', 'a']);
  });
});
