/**
 * ADR-0036: branch-fix diagnosis. Every assignment that makes the claim hold is listed, in the
 * brief's order (nothing moves first, then one flip with later steps first), each with what
 * moves and the rewritten definitions; selectors come from the host's chooser when one is given;
 * a cap on 2^k is stated; a claim without branch choices says so.
 */
import { describe, expect, it } from 'vitest';
import { testClaim } from '@geomira/claims/job';
import { ref } from '@geomira/kernel/expr';
import {
  along,
  c,
  Figure,
  n,
  near,
  oppositeSide,
  orient,
  sameSide,
} from '../../claims/test/helpers/build';
import {
  assignmentOrder,
  branchFix,
  MAX_ASSIGNMENTS,
  runBranchFix,
  type BranchFixResult,
} from '../src/branch-fix';
import { sitesOf } from '../src/branch-sites';
import type { Chooser } from '../src/types';
import { REGISTRY } from './helpers';

function fixes(
  f: Figure,
  claim: number,
  regime: 'local' | 'global',
  choose?: Chooser,
  n0 = 40,
): BranchFixResult {
  const r = branchFix(
    { kind: 'branchFix', doc: f.doc, claim, regime, seed: 3, n: n0 },
    { registry: REGISTRY, ...(choose === undefined ? {} : { choose }) },
  );
  if (r.kind !== 'fixes') throw new Error(JSON.stringify(r));
  return r;
}

function verdict(f: Figure, claim: number, regime: 'local' | 'global'): string {
  const r = testClaim(
    { kind: 'testClaim', regime, doc: f.doc, claim, seed: 3, n: 60 },
    { registry: REGISTRY },
  );
  return r.kind === 'verdict' ? r.verdict.kind : r.kind;
}

/** Two circles of radius 5, centres 8 apart, meeting at (4, ±3); Q below AB. */
function circles(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 8, 0)
    .point('Q', 4, -10)
    .def('c1', 'circle', 'A', n(5))
    .def('c2', 'circle', 'B', n(5))
    .def('ab', 'line', 'A', 'B')
    .def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'));
}

describe('the order of assignments', () => {
  it('nothing flipped, then one flip (later sites first), then more', () => {
    const T = true;
    const F = false;
    expect(assignmentOrder(3, 64)).toEqual([
      [F, F, F],
      [F, F, T],
      [F, T, F],
      [T, F, F],
      [F, T, T],
      [T, F, T],
      [T, T, F],
      [T, T, T],
    ]);
    expect(assignmentOrder(10, MAX_ASSIGNMENTS)).toHaveLength(64);
    expect(assignmentOrder(0, 64)).toEqual([[]]);
  });
});

describe('branch fixes (ADR-0036)', () => {
  it('MIXED by near(P): keeping the candidate with a firm selector fixes it, nothing moves', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('L1', -7, '1/10')
      .point('L2', 7, '1/10')
      .point('P', '1/50', 4)
      .def('k', 'circle', 'O', n(5))
      .def('l', 'line', 'L1', 'L2')
      .def('X', 'intersect', 'l', 'k', near('P'))
      .def('R', 'intersect', 'l', 'k', along(1));
    const id = f.claim('equal', 'X', 'R');
    expect(verdict(f, id, 'local')).toBe('mixed');
    const r = fixes(f, id, 'local');
    expect(r.sites).toEqual([f.id('X'), f.id('R')]);
    const first = r.fixes[0];
    expect(first?.flipped).toEqual([]);
    expect(first?.moves).toEqual([]);
    expect(first?.verdict.kind).toBe('holds');
    expect(first?.edits.map((e) => e.id)).toEqual([f.id('X')]);
    for (const x of r.fixes) expect(x.verdict.kind).toBe('holds');
  });

  it('ORIENTATION-DEPENDENT: the chooser writes a reflection-equivariant selector, nothing moves', () => {
    // Radius 7, so the global sampler's figures keep the circles meeting. X is the upper point
    // by orient(+); Z the upper one by a reflection-equivariant selector.
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 8, 0)
      .point('Q', 4, -10)
      .def('c1', 'circle', 'A', n(7))
      .def('c2', 'circle', 'B', n(7))
      .def('ab', 'line', 'A', 'B')
      .def('X', 'intersect', 'c1', 'c2', orient(1))
      .def('Z', 'intersect', 'c1', 'c2', oppositeSide('Q', 'ab'));
    const id = f.claim('equal', 'X', 'Z');
    expect(verdict(f, id, 'global')).toBe('orientation-dependent');
    // A stand-in for the editor's chooser: same_side(Q, ab) when it singles out the target.
    const choose: Chooser = (doc, _values, _registry, _tool, _argIds, click) => {
      const q = doc.objects.find((o) => o.name === 'Q');
      const ab = doc.objects.find((o) => o.name === 'ab');
      if (q === undefined || ab === undefined) return { ok: false, reason: 'no Q' };
      return click.y < 0
        ? { ok: true, selectors: [{ kind: 'same_side', q: ref(q.id), l: ref(ab.id) }] }
        : { ok: true, selectors: [{ kind: 'opposite_side', q: ref(q.id), l: ref(ab.id) }] };
    };
    const r = fixes(f, id, 'global', choose);
    const first = r.fixes[0];
    expect(first?.flipped).toEqual([]);
    expect(first?.moves).toEqual([]);
    expect(first?.verdict.kind).toBe('holds-across');
    const x = first?.doc.objects.find((o) => o.name === 'X');
    expect(x?.def.kind === 'call' ? x.def.selectors.map((s0) => s0.kind) : []).toEqual([
      'opposite_side',
    ]);
    expect(r.regime).toBe('global');
  });

  it('one flip moves that point (and what depends on it); later steps are tried first', () => {
    const f = circles()
      .def('X', 'intersect', 'c1', 'c2', orient(-1))
      .def('U', 'intersect', 'c1', 'c2', orient(1))
      .def('K', 'midpoint', 'X', 'A');
    // X is the lower point, U the upper: equal(X, U) holds once exactly one of them flips.
    const id = f.claim('equal', 'X', 'U');
    const r = fixes(f, id, 'local', undefined, 20);
    expect(r.fixes.map((x) => x.flipped)).toEqual([[f.id('U')], [f.id('X')]]);
    expect(r.fixes[0]?.moves).toEqual([f.id('U')]);
    expect(r.fixes[1]?.moves).toEqual([f.id('X'), f.id('K')]);
    expect(r.note).toBeUndefined();
  });

  it('a claim without branch choices says so; a missing claim is invalid', () => {
    const f = circles();
    const id = f.claim('collinear', 'A', 'B', c('midpoint', 'A', 'B'));
    expect(fixes(f, id, 'local')).toMatchObject({
      fixes: [],
      checked: 0,
      note: "no branch choice in this claim's construction",
    });
    expect(
      branchFix(
        { kind: 'branchFix', doc: f.doc, claim: 999, regime: 'local', seed: 1 },
        { registry: REGISTRY },
      ).kind,
    ).toBe('invalid');
  });

  it('more than MAX_ASSIGNMENTS assignments: the cap is stated', () => {
    const f = circles();
    for (let i = 0; i < 7; i++) f.def(`X_${String(i)}`, 'intersect', 'c1', 'c2', orient(1));
    const id = f.claim('collinear', ...Array.from({ length: 7 }, (_, i) => `X_${String(i)}`));
    const r = fixes(f, id, 'local', undefined, 6);
    expect(r.total).toBe(128);
    expect(r.checked).toBe(64);
    expect(r.note).toBe('checked 64 of 128 assignments: cap');
  });

  it('sites: the current candidate, nested calls included', () => {
    const f = circles().def('X', 'intersect', 'c1', 'c2', orient(1));
    const id = f.claim('equal', c('intersect', 'c1', 'c2', orient(-1)), 'X');
    const claim = f.doc.claims.find((x) => x.id === id);
    const sites = sitesOf(f.doc, REGISTRY, claim?.args ?? []);
    expect(sites.map((x) => x.object)).toEqual([f.id('X')]);
    expect(sites[0]?.current).toBeGreaterThanOrEqual(0);
    expect(sites[0]?.was?.y).toBeCloseTo(3, 12);
  });

  it('cancel and stop', () => {
    const f = circles().def('X', 'intersect', 'c1', 'c2', orient(1));
    const id = f.claim('equal', 'X', 'Y');
    const job = {
      kind: 'branchFix' as const,
      doc: f.doc,
      claim: id,
      regime: 'global' as const,
      seed: 1,
      n: 10,
    };
    const a = runBranchFix(job, { registry: REGISTRY });
    a.next();
    expect(a.next('cancel').value).toEqual({ kind: 'cancelled' });
    const b = runBranchFix(job, { registry: REGISTRY });
    b.next();
    expect(b.next('stop').value).toMatchObject({
      kind: 'fixes',
      note: 'checked 0 of 4 assignments: time budget',
    });
  });
});
