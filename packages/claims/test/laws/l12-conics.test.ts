/**
 * L12 (SPEC §17) for the conic corpus of Run 16b (ADR-0042): true theorems HOLD for 20 seeds on
 * the exact rung, false claims are FALSE or MIXED, degenerate claims are never true or false. A
 * file of its own because a conic's exact values are large (the normal form's factor
 * (a² + 2b² + c²)/det M), so the exact rung of a hexagon on a conic takes about a second per
 * seed: each test has a minute.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { testClaim } from '../../src/job';
import { REGISTRY } from '../helpers/build';
import { baseFigure } from '../helpers/corpus';
import { CONIC_DEGENERATE, CONIC_FALSE, CONIC_TRUE } from '../helpers/corpus-conics';
import { currentValue, expectHolds, localVerdict } from '../helpers/l12';
import { lawCount } from '../helpers/laws';

const SEEDS = Array.from({ length: lawCount(20) }, (_, i) => i + 1);
const TIMEOUT = 60_000;
const rows: string[] = [];

describe('L12: the conic corpus', () => {
  it('has true, false and degenerate entries for every conic claim kind', () => {
    const kinds = (es: readonly { name: string }[]) => es.map((e) => e.name).join(' ');
    for (const k of ['conconic', 'tangent', 'on', 'La Hire']) expect(kinds(CONIC_TRUE)).toMatch(k);
    expect(CONIC_FALSE.length).toBeGreaterThanOrEqual(5);
    expect(CONIC_DEGENERATE.length).toBeGreaterThanOrEqual(2);
  });
});

describe('L12: true conic theorems hold in the local test', () => {
  for (const e of CONIC_TRUE) it(e.name, () => void rows.push(expectHolds(e, SEEDS)), TIMEOUT);
  afterAll(() => {
    console.warn(
      [
        'L12 conic theorems:',
        '| theorem | rung | seeds × figures |',
        '| --- | --- | --- |',
        ...rows,
      ].join('\n'),
    );
  });
});

describe('L12: false conic claims are FALSE or MIXED', () => {
  for (const e of CONIC_FALSE)
    it(
      e.name,
      () => {
        for (const seed of SEEDS.slice(0, 5)) {
          const v = localVerdict(e, seed);
          expect(['false', 'mixed'], `${e.name}, seed ${String(seed)}: ${v.text}`).toContain(
            v.kind,
          );
        }
        expect(currentValue(e).value).toBe('false');
      },
      TIMEOUT,
    );
});

describe('L12: degenerate conic claims are never true or false', () => {
  for (const e of CONIC_DEGENERATE)
    it(
      e.name,
      () => {
        expect(currentValue(e).value).toBe('undefined');
        for (const seed of [1, 2, 3, 4, 5]) {
          const v = localVerdict(e, seed);
          expect(v.kind).toBe('inconclusive');
          expect([v.tally.true, v.tally.false]).toEqual([0, 0]);
        }
        const f = baseFigure();
        const id = e.build(f);
        const r = testClaim(
          { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed: 9, n: 40 },
          { registry: REGISTRY },
        );
        expect(
          r.kind === 'verdict' ? [r.verdict.kind, r.verdict.tally.true, r.verdict.tally.false] : r,
        ).toEqual(['inconclusive', 0, 0]);
      },
      TIMEOUT,
    );
});
