/** The L12 corpus runners: local tests per entry over several seeds, with a rung table. */
import { expect } from 'vitest';
import { evalClaim } from '../../src/eval-claim';
import { testClaim } from '../../src/job';
import type { Verdict } from '../../src/verdict';
import { REGISTRY } from './build';
import { baseFigure, type Entry } from './corpus';

/** Figures per local test in the corpora. */
export const CORPUS_N = 40;

export function localVerdict(e: Entry, seed: number, n = CORPUS_N): Verdict {
  const f = baseFigure();
  const id = e.build(f);
  const r = testClaim(
    { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed, n },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(`${e.name}: ${JSON.stringify(r)}`);
  return r.verdict;
}

export function currentValue(e: Entry): ReturnType<typeof evalClaim> {
  const f = baseFigure();
  const id = e.build(f);
  return evalClaim(f.doc, id, REGISTRY);
}

/** A true theorem: HOLDS for every seed, every figure valid (zero flakes), on its rung. */
export function expectHolds(e: Entry, seeds: readonly number[]): string {
  for (const seed of seeds) {
    const v = localVerdict(e, seed);
    expect(v.kind, `${e.name}, seed ${String(seed)}: ${v.text}`).toBe('holds');
    expect(v.tally.true, `${e.name}, seed ${String(seed)}: ${v.text}`).toBe(CORPUS_N);
    expect(v.rungs, `${e.name}, seed ${String(seed)}`).toEqual({ [e.rung ?? 'numeric']: CORPUS_N });
  }
  expect(currentValue(e)).toEqual({ value: 'true', rung: e.rung });
  return `| ${e.name} | ${e.rung ?? ''} | ${String(seeds.length)} × ${String(CORPUS_N)} |`;
}
