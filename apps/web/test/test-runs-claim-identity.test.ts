/**
 * A verdict belongs to a claim's statement, not only to its id (pre-beta review). Undo rolls
 * the document back with its id counter, so the next claim reuses the id of an undone one:
 * the Claims panel showed the undone claim's "Holds in this configuration … 200 true" on a
 * different, new claim.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { runsFor, type ClaimRuns } from '../src/test-runs';
import { registry } from './helpers';

const FIGURE = '@version 1\nA = (1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)\n';

function docOf(claim: string) {
  const r = parse(`${FIGURE}${claim}\n`, registry);
  const c = r.doc.claims[0];
  if (c === undefined) throw new Error('no claim');
  return { doc: r.doc, id: c.id };
}

describe('the runs shown for a claim', () => {
  const tested = docOf('claim angle(B, H, C) + angle(B, A, C) = 180');
  const runs: ReadonlyMap<number, ClaimRuns> = new Map([
    [tested.id, { doc: tested.doc, local: { status: 'running', job: 1, done: 0, n: 200 } }],
  ]);

  it('another claim with the same id gets no runs', () => {
    const other = docOf('claim collinear(A, B, H)');
    expect(other.id).toBe(tested.id);
    expect(runsFor(runs, other.doc, other.id)).toBeUndefined();
  });

  it('the same statement keeps its runs (marked stale elsewhere if the figure changed)', () => {
    const same = docOf('claim angle(B, H, C) + angle(B, A, C) = 180');
    expect(runsFor(runs, same.doc, same.id)).toBe(runs.get(tested.id));
    expect(runsFor(runs, tested.doc, tested.id)).toBe(runs.get(tested.id));
  });

  it('a claim that no longer exists gets no runs', () => {
    expect(runsFor(runs, parse(FIGURE, registry).doc, tested.id)).toBeUndefined();
  });
});
