/**
 * L17 (SPEC §17) for conics (ADR-0042): on, tangent and conconic are POLYNOMIAL KINDS; a closure
 * of rational conic tools (conic, on(k, u, v), other(P), pole, polar, tangent, conic_to_circle)
 * is eligible for the mod-p rung, a sign-based selector or circle_to_centre's square root is not;
 * and the rung used agrees with that static decision over the conic corpus.
 */
import { webcrypto } from 'node:crypto';
import { cryptoSource } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import { POLYNOMIAL_KINDS } from '../../src/kinds';
import { prepare } from '../../src/prepare';
import type { Verdict } from '../../src/verdict';
import { along, c, Figure, n, orient, other, REGISTRY } from '../helpers/build';
import { baseFigure, type Entry } from '../helpers/corpus';
import { CONIC_FALSE, CONIC_TRUE } from '../helpers/corpus-conics';

const ENTROPY = cryptoSource((b) => webcrypto.getRandomValues(b));

function exclusions(f: Figure, id: number): readonly string[] {
  const p = prepare(f.doc, id, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared.analysis.modpExclusions;
}

function local(f: Figure, id: number, budgetBits = 8): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 3, n: 12 },
    { registry: REGISTRY, entropy: ENTROPY, budgetBits },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

/** k through five points, no three collinear. */
function withConic(): Figure {
  return new Figure()
    .point('A', 1, 3)
    .point('B', 0, 0)
    .point('C', 4, 0)
    .point('D', 5, 4)
    .point('E', -1, 2)
    .def('k', 'conic', 'A', 'B', 'C', 'D', 'E');
}

describe('L17: conic claims and the mod-p rung', () => {
  it('on, tangent and conconic are polynomial kinds', () => {
    for (const k of ['on', 'tangent', 'conconic']) expect(POLYNOMIAL_KINDS).toContain(k);
  });

  it('rational conic tools (other(P) included) are eligible', () => {
    const f = withConic()
      .def('X', 'intersect', c('line', 'A', 'C'), 'k', other('A'))
      .add('P', c('on', 'k', n(2), n(-1)))
      .def('T', 'pole', c('line', 'A', 'B'), 'k')
      .def('g', 'conic_to_circle', 'k');
    expect(exclusions(f, f.claim('conconic', 'A', 'B', 'C', 'D', 'X', 'P'))).toEqual([]);
    expect(exclusions(f, f.claim('tangent', c('line', 'T', 'A'), 'k'))).toEqual([]);
    expect(exclusions(f, f.claim('on', c('apply', 'g', 'P'), c('apply', 'g', 'k')))).toEqual([]);
  });

  it('sign-based selectors on a conic and circle_to_centre are excluded', () => {
    const f = withConic().def('X', 'intersect', c('line', 'A', 'C'), 'k', along(1));
    expect(exclusions(f, f.claim('on', 'X', 'k'))[0]).toMatch(/sign-based selector along\(\+\)/);
    const g = withConic().def('Y', 'tangent_point', 'D', 'k', orient(-1));
    expect(exclusions(g, g.claim('on', 'Y', 'k'))[0]).toMatch(/sign-based selector orient\(-\)/);
    const h = withConic()
      .def('w', 'circumcircle', 'A', 'B', 'C')
      .def('M', 'centroid', 'A', 'B', 'C')
      .def('t', 'circle_to_centre', 'w', 'M')
      .def('M_1', 'apply', 't', 'M');
    expect(exclusions(h, h.claim('on', 'M_1', 'w'))[0]).toMatch(/circle_to_centre/);
  });

  it('an eligible conic claim falls through to mod p past a tiny budget, and HOLDS', () => {
    const M = c('midpoint', 'B', 'C');
    const f = withConic().def('X', 'intersect', c('line', 'A', M), 'k', other('A'));
    const v = local(f, f.claim('conconic', 'A', 'B', 'C', 'D', 'E', 'X'));
    expect(v.rungs).toEqual({ 'exact mod p': 12 });
    expect(v.kind).toBe('holds');
  });

  function check(e: Entry, expected: 'holds' | 'false'): void {
    const f = baseFigure();
    const id = e.build(f);
    const ex = exclusions(f, id);
    const v = local(f, id);
    if (ex.length > 0)
      expect(v.rungs['exact mod p'], `${e.name}: ${ex.join('; ')}`).toBeUndefined();
    else expect(Object.keys(v.rungs), e.name).toContain('exact mod p');
    if (expected === 'holds') expect(v.kind, `${e.name}: ${v.text}`).toBe('holds');
    else expect(['false', 'mixed'], `${e.name}: ${v.text}`).toContain(v.kind);
  }

  it('over the conic corpus: the identity test agrees and respects the whitelist', () => {
    for (const e of CONIC_TRUE) check(e, 'holds');
    for (const e of CONIC_FALSE) check(e, 'false');
  }, 60_000);
});
