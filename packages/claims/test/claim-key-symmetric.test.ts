/**
 * claimKey's fast path (ADR-0042): when a kind's generators are every adjacent transposition
 * (any order of its arguments: conconic's six points have 720 arrangements), the key is the
 * arguments sorted by the smallest-concatenation order, which must equal the smallest joined
 * arrangement over the whole orbit, prefixes included ("o1" and "o12").
 */
import { createRng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { ClaimKindSpec } from '../src/kind';
import { claimKind } from '../src/kinds';
import { claimKey, orbit, type KeyArg } from '../src/symmetry';

function bruteKey(kind: ClaimKindSpec, args: readonly KeyArg[]): string {
  const texts = args.map((a) => ('key' in a ? a.key : ''));
  const gens = (kind.symmetry ?? []).map((s) => s.perm);
  const all = orbit(args.length, gens).map((p) => p.map((i) => texts[i] ?? '').join('|'));
  return `${kind.name}(${all.sort()[0] ?? ''})`;
}

const POOL = ['o1', 'o12', 'o2', 'o', 'o10', 'o1|', 'P_1', 'P_12', 'L3', 'C10', 'C1'];

describe('claimKey over any order of the arguments', () => {
  it('equals the brute-force smallest arrangement (conconic, concyclic, collinear)', () => {
    const rng = createRng(11);
    for (const name of ['conconic', 'concyclic', 'collinear']) {
      const kind = claimKind(name);
      if (kind === undefined) throw new Error(name);
      const n = kind.params.length;
      for (let t = 0; t < 60; t++) {
        const args = Array.from({ length: n }, () => ({
          key: POOL[rng.nextInt(POOL.length)] ?? '',
        }));
        expect(claimKey(kind, args), JSON.stringify(args)).toBe(bruteKey(kind, args));
      }
    }
  });

  it('prefix keys are ordered by the joined text, not by plain string order', () => {
    const kind = claimKind('concyclic');
    if (kind === undefined) throw new Error('concyclic');
    const args = ['o1', 'o12', 'o2', 'o3'].map((key) => ({ key }));
    expect(claimKey(kind, args)).toBe('concyclic(o12|o1|o2|o3)');
  });
});
