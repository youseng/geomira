/**
 * L17 (SPEC §17): rung whitelist. Non-polynomial kinds, and closures with sign-based
 * selectors or square roots / trigonometry, never use the mod-p rung; the decision is
 * static (the closure), never "wait for an Inexact" (note A). Every check runs with a
 * cryptographic source and a tiny exact budget, so that every eligible sample falls
 * through to mod p.
 */
import { webcrypto } from 'node:crypto';
import { cryptoSource } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import { POLYNOMIAL_KINDS } from '../../src/kinds';
import { prepare } from '../../src/prepare';
import type { Verdict } from '../../src/verdict';
import { along, c, Figure, n, orient, other, REGISTRY, sameSide } from '../helpers/build';
import { baseFigure, type Entry } from '../helpers/corpus';
import { FALSE_CLAIMS } from '../helpers/corpus-false';
import { TRUE_THEOREMS } from '../helpers/corpus-true';

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

function tri(): Figure {
  return new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0).point('D', 5, 4);
}

describe('L17: static eligibility of the mod-p rung', () => {
  it('a polynomial claim over a rational closure (other(P) included) is eligible', () => {
    const f = tri()
      .def('w', 'circumcircle', 'A', 'B', 'C')
      .def('X', 'intersect', c('line', 'A', 'D'), 'w', other('A'));
    expect(exclusions(f, f.claim('on', 'X', 'w'))).toEqual([]);
  });

  it('non-polynomial kinds are excluded', () => {
    const f = tri().def('H', 'orthocenter', 'A', 'B', 'C');
    expect(exclusions(f, f.claim('angle_sum', 'B', 'H', 'C', 'B', 'A', 'C', n(180)))).toEqual([
      'angle_sum is not a polynomial kind',
    ]);
    expect(POLYNOMIAL_KINDS).not.toContain('angle_sum');
  });

  it('sign-based selectors are excluded (every selector but other(P))', () => {
    const f = tri().def(
      'X',
      'intersect',
      c('circle', 'A', 'B'),
      c('circle', 'C', 'B'),
      sameSide('D', c('line', 'A', 'C')),
    );
    expect(exclusions(f, f.claim('collinear', 'X', 'A', 'B'))[0]).toMatch(
      /^X: .* uses the sign-based selector same_side/,
    );
    const g = tri().def('X', 'intersect', c('line', 'A', 'B'), c('circle', 'C', 'B'), along(1));
    expect(exclusions(g, g.claim('collinear', 'X', 'A', 'B'))[0]).toMatch(
      /sign-based selector along\(\+\)/,
    );
    const h = tri().def('X', 'intersect', c('circle', 'A', 'B'), c('circle', 'C', 'B'), orient(-1));
    expect(exclusions(h, h.claim('collinear', 'X', 'A', 'B'))[0]).toMatch(
      /sign-based selector orient\(-\)/,
    );
  });

  it('square roots and trigonometry are excluded, even where an exact argument would make them rational mod p', () => {
    const f = tri()
      .add('k', c('sqrt', n('9/4')))
      .def('P', 'divide', 'A', 'B', 'k');
    expect(exclusions(f, f.claim('collinear', 'A', 'B', 'P'))).toEqual([
      'k: sqrt(9/4) needs a square root or trigonometry',
    ]);
    const g = tri().add('P', c('rotate', 'A', 'B', n(90)));
    expect(
      exclusions(g, g.claim('perpendicular', c('line', 'B', 'A'), c('line', 'B', 'P')))[0],
    ).toMatch(/rotate\(A, B, 90\) needs a square root or trigonometry/);
    const h = tri().def('I', 'incenter', 'A', 'B', 'C');
    expect(exclusions(h, h.claim('collinear', 'A', 'I', 'B'))[0]).toMatch(/incenter/);
    const t = tri();
    expect(
      exclusions(t, t.claim('dangle_lines', c('line', 'A', 'B'), c('line', 'A', 'C'), n(30))),
    ).toEqual(['∡(l, m) = 30° needs cos and sin of θ']);
    expect(
      exclusions(t, t.claim('dangle_lines', c('line', 'A', 'B'), c('line', 'A', 'C'), n(45))),
    ).toEqual([]);
  });

  it('only the claim closure counts: a radical object the claim does not use is irrelevant', () => {
    const f = tri().def('I', 'incenter', 'A', 'B', 'C').def('M', 'midpoint', 'A', 'B');
    expect(exclusions(f, f.claim('collinear', 'A', 'M', 'B'))).toEqual([]);
  });
});

describe('L17: the rung used agrees with the static decision', () => {
  it('excluded closures never use mod p; eligible ones fall through to it past a tiny budget', () => {
    const k = tri()
      .add('k', c('sqrt', n('9/4')))
      .def('P', 'divide', 'A', 'B', 'k');
    const radical = local(k, k.claim('collinear', 'A', 'B', 'P'));
    expect(radical.rungs['exact mod p']).toBeUndefined();
    expect(radical.kind).toBe('holds');
    const f = tri().def('M', 'midpoint', 'A', 'B');
    const eligible = local(f, f.claim('collinear', 'A', 'M', 'B'));
    expect(eligible.rungs).toEqual({ 'exact mod p': 12 });
    expect(eligible.kind).toBe('holds');
    expect(local(f, f.claim('collinear', 'A', 'M', 'B'), 4096).rungs).toEqual({
      'exact over Q': 12,
    });
  });

  it('without a cryptographic source the mod-p rung is skipped (numeric instead)', () => {
    const f = tri().def('M', 'midpoint', 'A', 'B');
    const id = f.claim('collinear', 'A', 'M', 'B');
    const r = testClaim(
      { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 3, n: 12 },
      { registry: REGISTRY, budgetBits: 8 },
    );
    expect(r.kind === 'verdict' ? r.verdict.rungs : r).toEqual({ numeric: 12 });
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

  it('over the true corpus: the identity test agrees (HOLDS) and respects the whitelist', () => {
    for (const e of TRUE_THEOREMS) check(e, 'holds');
  });

  it('over the false corpus: the identity test finds the failure and respects the whitelist', () => {
    for (const e of FALSE_CLAIMS) check(e, 'false');
  });
});
