import { describe, expect, it } from 'vitest';
import { emptyDocument } from '@geomira/kernel/document';
import type { SampleOutcome } from '../src/rungs';
import { globalVerdict, localVerdict, newCollector, record } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';

/**
 * Bug found in the pre-beta review (claims, item 5): ADR-0008 decision 14 says verdict texts
 * state the rejected counts, but only HOLDS ACROSS did. Every verdict text now states them.
 */
const COMMON = { seed: 4, n: 10, tested: 10, attempts: 17, hardToSatisfy: false };
const TRUE: SampleOutcome = { kind: 'true', rung: 'exact over Q' };
const FALSE: SampleOutcome = { kind: 'false', rung: 'exact over Q' };
const REJECTED: SampleOutcome = { kind: 'rejected', reason: 'assume acute: not satisfied' };

function collect(t: number, f: number, rejected: number) {
  const c = newCollector();
  const outcomes = [
    ...Array.from({ length: t }, () => TRUE),
    ...Array.from({ length: f }, () => FALSE),
    ...Array.from({ length: rejected }, () => REJECTED),
  ];
  for (const o of outcomes) record(c, o, () => emptyDocument());
  return c;
}

const CURRENT = { value: 'true', rung: 'exact over Q' } as const;

describe('every verdict text states the rejected samples (review item 5)', () => {
  it('local HOLDS, FALSE and MIXED', () => {
    expect(localVerdict(collect(10, 0, 7), COMMON, CURRENT).text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 10/10; 7 samples rejected by hypotheses) · seed 4',
    );
    expect(localVerdict(collect(0, 10, 7), COMMON, CURRENT).text).toBe(
      'FALSE (exact over Q, 10/10 false; true in the current figure only; 7 samples rejected by hypotheses) · seed 4',
    );
    expect(localVerdict(collect(6, 4, 7), COMMON, CURRENT).text).toBe(
      'MIXED (exact over Q, 6 true and 4 false of 10; 7 samples rejected by hypotheses) · seed 4',
    );
  });

  it('INCONCLUSIVE, local and global', () => {
    const c = collect(1, 0, 400);
    const k = { ...COMMON, tested: 1, attempts: 401 };
    expect(localVerdict(c, k, CURRENT).text).toBe(
      'INCONCLUSIVE (1 of 1 figures valid; 400 samples rejected by hypotheses) · only 1 of 10 figures satisfied the hypotheses · seed 4',
    );
    expect(globalVerdict(c, k, { failing: 0, unrepaired: 0, k: 0 }).text).toBe(
      'INCONCLUSIVE (1 of 1 figures valid; 400 samples rejected by hypotheses) · only 1 of 10 figures satisfied the hypotheses · seed 4',
    );
  });

  it('global ORIENTATION-DEPENDENT and CONFIGURATION-DEPENDENT, in the text and the line', () => {
    const c = collect(6, 4, 7);
    const orient = globalVerdict(c, COMMON, { failing: 4, unrepaired: 0, k: 2 });
    expect(orient.text).toBe(
      'ORIENTATION-DEPENDENT (4 of 10 fail and hold with the selectors flipped; flipping its 2 orientation-dependent selectors together repairs every failure; 7 samples rejected by hypotheses) · seed 4',
    );
    expect(verdictLine(orient).text).toBe(
      'Orientation-dependent (global test, n = 10, exact over Q: 4 of 10 fail and hold with the selectors flipped; flipping its orientation-dependent selectors together repairs every failure; 7 samples rejected by hypotheses)',
    );
    const conf = globalVerdict(c, COMMON, { failing: 4, unrepaired: 4, k: 0 });
    expect(conf.text).toBe(
      'CONFIGURATION-DEPENDENT (4 of 10 fail; no orientation-dependent selector; 7 samples rejected by hypotheses) · seed 4',
    );
    expect(verdictLine(conf).text).toBe(
      'Configuration-dependent (global test, n = 10, exact over Q: 4 of 10 fail; no orientation-dependent selector; 7 samples rejected by hypotheses)',
    );
  });

  it('no rejected sample: no note', () => {
    expect(localVerdict(collect(10, 0, 0), COMMON, CURRENT).text).toBe(
      'HOLDS IN THIS CONFIGURATION (exact over Q, 10/10) · seed 4',
    );
  });
});
