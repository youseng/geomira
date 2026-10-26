/**
 * ADR-0035 decisions 8–10: candidates. Plain enumeration yields each claim once under the
 * kind's symmetries (increasing on transposition positions, distinct objects), counts exactly
 * (or bounded, said so); measure pairing finds the pairs whose measures fit the relation,
 * wraps periodic measures, skips measures that say nothing (zero lengths, flat angles).
 */
import { describe, expect, it } from 'vitest';
import { FLOOR_MAX, TRUE_FACTOR } from '@geomira/num/tolerance';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { ClaimKindSpec } from '@geomira/claims/kind';
import type { Value } from '@geomira/kernel/value';
import { rational } from '@geomira/num/rational';
import { claimKey } from '@geomira/claims/symmetry';
import { objectKey } from '../src/terms';
import {
  countPlain,
  measureCandidates,
  plainCandidates,
  poolsOf,
  WINDOW,
  type Ticking,
} from '../src/candidates';

const K = claimKindRegistry();
function kind(name: string): ClaimKindSpec {
  const k = K.get(name);
  if (k === undefined) throw new Error(name);
  return k;
}

function lengthMeasure() {
  const m = kind('length').finder?.measure;
  if (m === undefined) throw new Error('length measure');
  return m;
}

function run<T>(g: Ticking<T>): T {
  for (;;) {
    const r = g.next();
    if (r.done === true) return r.value;
  }
}

const P = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
const L = (x: number, y: number, dx: number, dy: number): Value<number> => ({
  kind: 'line',
  p: { x, y },
  d: { x: dx, y: dy },
  lo: null,
  hi: null,
  chiral: false,
});

function pools(vs: Value<number>[]) {
  const values = new Map(vs.map((v, i) => [i + 1, v]));
  return poolsOf([...values.keys()], values, 10);
}

describe('candidates (ADR-0035)', () => {
  it('the window is TRUE_FACTOR·FLOOR_MAX', () => {
    expect(WINDOW).toBe(TRUE_FACTOR * FLOOR_MAX);
  });

  it('collinear: each triple of distinct points once; counted exactly', () => {
    const p = pools([P(0, 0), P(1, 0), P(2, 1), P(3, 5), P(4, 4)]);
    const cs = [...plainCandidates(kind('collinear'), p)];
    expect(cs).toHaveLength(10);
    expect(new Set(cs.map((c) => c.key)).size).toBe(10);
    for (const c of cs) expect(new Set(c.objects).size).toBe(3);
    expect(run(countPlain(kind('collinear'), p, 1000))).toEqual({
      total: 10,
      more: false,
      exact: true,
    });
    expect(run(countPlain(kind('collinear'), p, 4))).toEqual({ total: 4, more: true, exact: true });
  });

  it('on: every point with every curve; parallel: unordered pairs of lines', () => {
    const p = pools([P(0, 0), P(1, 0), L(0, 0, 1, 0), L(0, 1, 1, 0), L(0, 2, 0, 1)]);
    expect([...plainCandidates(kind('on'), p)]).toHaveLength(6);
    expect([...plainCandidates(kind('parallel'), p)]).toHaveLength(3);
    expect([...plainCandidates(kind('concurrent'), p)]).toHaveLength(1);
  });

  it('dangle_lines: every ordered pair of lines and every searched angle', () => {
    const p = pools([L(0, 0, 1, 0), L(0, 1, 1, 1)]);
    const cs = [...plainCandidates(kind('dangle_lines'), p)];
    expect(cs).toHaveLength(2 * 6);
    expect(cs[0]?.args[2]).toMatchObject({ lit: { num: 30n, den: 1n } });
  });

  it('length by measure: equal segments and doubled ones, zero lengths skipped', () => {
    const p = pools([P(0, 0), P(3, 4), P(10, 0), P(16, 8), P(0, 0)]);
    const r = run(measureCandidates(kind('length'), lengthMeasure(), p, 1000, 1000));
    const facts = r.list.map((c) =>
      c.args.map((a) => ('id' in a ? a.id : `k${String(a.lit.num)}`)).join(' '),
    );
    // |P1P2| = 5, |P3P4| = 10 = 2·5; P1 and P5 coincide: no zero-length group.
    expect(facts).toContain('3 4 1 2 k2');
    expect(
      r.list.every(
        (c) => !(c.objects.includes(1) && c.objects.includes(5) && c.objects.length === 2),
      ),
    ).toBe(true);
    expect(r.more).toBe(false);
  });

  it('directed angles by measure wrap modulo π; flat angles say nothing', () => {
    const p = pools([P(0, 0), P(1, 0), P(0, 1), P(5, 5), P(6, 5), P(5, 6), P(9, 9), P(10, 9)]);
    const m = kind('dangle').finder?.measure;
    if (m === undefined) throw new Error('measure');
    const r = run(measureCandidates(kind('dangle'), m, p, 100_000, 100_000));
    expect(r.list.length).toBeGreaterThan(0);
    const keys = new Set(r.list.map((c) => c.key));
    expect(keys.size).toBe(r.list.length);
    // ∡(P2 P1 P3) = 90° = ∡(P5 P4 P6): found.
    const want = claimKey(kind('dangle'), [
      { lit: rational(1n) },
      ...[2, 1, 3, 5, 4, 6].map((id) => ({ key: objectKey(id) })),
    ]);
    expect(keys.has(want)).toBe(true);
  });

  it('the pairing limit is stated', () => {
    const p = pools([P(0, 0), P(1, 0), P(2, 0), P(3, 0), P(4, 0), P(0, 1), P(1, 1)]);
    const r = run(measureCandidates(kind('length'), lengthMeasure(), p, 3, 1000));
    // Three kept, every match counted (the report says checked 3 of the count).
    expect(r.list).toHaveLength(3);
    expect(r.total).toBeGreaterThan(3);
    expect(r.more).toBe(false);
    const cut = run(measureCandidates(kind('length'), lengthMeasure(), p, 3, 5));
    expect(cut).toMatchObject({ total: 5, more: true });
  });
});
