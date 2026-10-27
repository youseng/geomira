/** ADR-0035 decisions 10–11: what the results say, never more. */
import { describe, expect, it } from 'vitest';
import type { Verdict } from '@geomira/claims/verdict';
import { capLines, grouped, rungText } from '../src/text';
import { DEFAULT_FIND_BUDGET } from '../src/types';

function verdict(rungs: Verdict['rungs'], t: number, tested: number): Verdict {
  return { rungs, tally: { true: t }, tested } as unknown as Verdict;
}

describe('texts', () => {
  it('groups thousands', () => {
    expect([grouped(0), grouped(999), grouped(18000), grouped(2_000_000), grouped(-1234)]).toEqual([
      '0',
      '999',
      '18,000',
      '2,000,000',
      '-1,234',
    ]);
  });

  it('rungs: one, or several with counts; exact only when every rung is exact', () => {
    expect(rungText(verdict({ 'exact over Q': 200 }, 200, 200))).toEqual({
      text: 'exact over Q, 200/200',
      exact: true,
    });
    expect(rungText(verdict({ 'exact over Q': 150, numeric: 50 }, 200, 200))).toEqual({
      text: 'exact over Q 150, numeric 50; 200/200',
      exact: false,
    });
    expect(rungText(verdict({ numeric: 190 }, 190, 200))).toEqual({
      text: 'numeric, 190/200',
      exact: false,
    });
    expect(rungText(verdict({ 'exact mod p': 3, 'exact over Q': 7 }, 10, 10)).exact).toBe(true);
  });

  it('caps: budget, time, totals bounded or approximate, tests, results', () => {
    const lines = capLines({
      kind: 'found',
      seed: 1,
      budget: DEFAULT_FIND_BUDGET,
      facts: [],
      beyondResults: 0,
      construction: { count: 0, shown: [] },
      unconfirmed: [],
      untested: 3,
      kinds: [
        {
          kind: 'collinear',
          checked: 4000,
          total: 18000,
          more: false,
          exact: true,
          stop: 'budget',
        },
        { kind: 'concyclic', checked: 64, total: 2_000_000, more: true, exact: true, stop: 'time' },
        { kind: 'x', checked: 5, total: 9, more: false, exact: false, stop: 'budget' },
        { kind: 'equal', checked: 9, total: 9, more: false, exact: true },
      ],
      notSearched: [{ kind: 'ratio', reason: 'eight points' }],
      stopped: true,
    });
    expect(lines).toEqual([
      'checked 4,000 of 18,000 collinear candidates: budget',
      'checked 64 of more than 2,000,000 concyclic candidates: time budget',
      'checked 5 of at most 9 x candidates: budget',
      'ratio not searched: eight points',
      'tested 0 of 3 facts: time budget',
      'stopped at the time budget',
    ]);
  });
});
