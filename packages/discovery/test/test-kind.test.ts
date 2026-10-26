/**
 * ADR-0035: a claim kind added later joins the finder without finder changes. The test-only
 * kind test_isosceles(A, B, C) (AB = AC; claims' test helper, in no default registry) is given
 * to the job in an extended kind registry: it is enumerated by plain enumeration (it has no
 * finder hints), deduplicated by its own symmetry (B ↔ C), screened, confirmed by the local
 * test, reported, and never hidden as a construction fact (no guarantee names it).
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { TEST_ISOSCELES } from '../../claims/test/helpers/test-kind';
import { find } from '../src/find';
import { REGISTRY, show, triangle } from './helpers';

describe('a test-only claim kind in the finder (ADR-0035)', () => {
  const f = triangle();
  const kinds = claimKindRegistry([TEST_ISOSCELES]);
  const r = find(
    { kind: 'find', doc: f.doc, seed: 4, budget: { n: 20, tests: 400, results: 400 } },
    { registry: REGISTRY, kinds },
  );

  it('is searched, deduplicated by its symmetry, confirmed and reported', () => {
    if (r.kind !== 'found') throw new Error(r.kind);
    const report = r.kinds.find((k) => k.kind === 'test_isosceles');
    // 9 points, apex first, the other two unordered: 9 · C(8, 2) = 252 candidates.
    expect(report).toEqual({
      kind: 'test_isosceles',
      checked: 252,
      total: 252,
      more: false,
      exact: true,
    });
    const mine = r.facts.filter((x) => x.kind === 'test_isosceles').map((x) => show(f.doc, x));
    expect(mine).toContain('test_isosceles(O, A, B)');
    expect(mine).toContain('test_isosceles(M_a, B, C)');
    // B ↔ C is one candidate: never both orders.
    expect(mine).not.toContain('test_isosceles(O, B, A)');
    expect(new Set(mine).size).toBe(mine.length);
    for (const x of r.facts.filter((y) => y.kind === 'test_isosceles'))
      expect(x.verdict.kind).toBe('holds');
  });

  it('without the kind in the registry it is not searched at all', () => {
    const plain = find(
      { kind: 'find', doc: f.doc, seed: 4, budget: { n: 10, tests: 5 } },
      { registry: REGISTRY },
    );
    if (plain.kind !== 'found') throw new Error(plain.kind);
    expect(plain.kinds.map((k) => k.kind)).not.toContain('test_isosceles');
  });
});
