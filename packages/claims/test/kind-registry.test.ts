/** ADR-0035: the claim kinds as a registry value, and test-only kinds through the tester. */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '../src/eval-claim';
import { testClaim } from '../src/job';
import { claimKindRegistry } from '../src/kind-registry';
import { CLAIM_KINDS } from '../src/kinds';
import { REGISTRY } from './helpers/build';
import { baseFigure } from './helpers/corpus';
import { TEST_ISOSCELES as ISOSCELES } from './helpers/test-kind';

describe('claimKindRegistry (ADR-0035)', () => {
  it('holds the v1 kinds, then the extras, by name', () => {
    const k = claimKindRegistry([ISOSCELES]);
    expect(k.kinds.map((x) => x.name)).toEqual([
      ...CLAIM_KINDS.map((x) => x.name),
      'test_isosceles',
    ]);
    expect(k.get('test_isosceles')).toBe(ISOSCELES);
    expect(k.get('collinear')).toBe(CLAIM_KINDS[0]);
    expect(k.get('nope')).toBeUndefined();
    expect(Object.isFrozen(k.kinds)).toBe(true);
    expect(claimKindRegistry().kinds).toEqual(CLAIM_KINDS);
  });

  it('refuses two kinds with one name', () => {
    expect(() => claimKindRegistry([{ ...ISOSCELES, name: 'collinear' }])).toThrow(TypeError);
  });

  it('a test-only kind runs through evalClaim and the local test', () => {
    const f = baseFigure().def('P', 'circumcenter', 'A', 'B', 'C');
    const id = f.claim('test_isosceles', 'P', 'A', 'B');
    const kinds = claimKindRegistry([ISOSCELES]);
    expect(evalClaim(f.doc, id, REGISTRY, { kinds })).toEqual({
      value: 'true',
      rung: 'exact over Q',
    });
    const r = testClaim(
      { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 5, n: 20 },
      { registry: REGISTRY, kinds },
    );
    expect(r.kind === 'verdict' ? r.verdict.kind : r.kind).toBe('holds');
    // Without the extra kind the claim is unknown, never true.
    expect(evalClaim(f.doc, id, REGISTRY)).toMatchObject({ value: 'undefined', status: 'invalid' });
    const g = baseFigure();
    const no = g.claim('test_isosceles', 'A', 'B', 'C');
    expect(evalClaim(g.doc, no, REGISTRY, { kinds })).toMatchObject({ value: 'false' });
  });
});
