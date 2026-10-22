/**
 * The verdict line, its tone and its detail line, character for character, for verdicts built
 * by hand in every branch (ADR-0013 decision 2). Run 10, note A: the mutation survivors of
 * verdict-line.ts were texts and counts no test pinned.
 */
import { describe, expect, it } from 'vitest';
import type { Tally, Verdict } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';

const NONE: Tally = {
  true: 0,
  false: 0,
  degenerate: 0,
  undefined: 0,
  ambiguous: 0,
  illConditioned: 0,
  invalid: 0,
  rejected: 0,
};

function verdict(p: Partial<Verdict> & Pick<Verdict, 'regime' | 'kind'>): Verdict {
  return {
    text: '',
    seed: 7,
    n: 10,
    tested: 10,
    attempts: 10,
    tally: { ...NONE, true: 10 },
    rungs: { 'exact over Q': 10 },
    reasons: [],
    ...p,
  };
}

describe('verdict lines, exactly', () => {
  it('local holds: one rung by name; no notes', () => {
    const l = verdictLine(verdict({ regime: 'local', kind: 'holds' }));
    expect(l).toEqual({
      text: 'Holds in this configuration (local test, n = 10, exact over Q)',
      tone: 'holds',
      detail: 'seed 7 · 10 figures tested in 10 attempts · 10 true, 0 false',
    });
  });

  it('local false, true in the current figure only, with invalid figures and reasons', () => {
    const v = verdict({
      regime: 'local',
      kind: 'false',
      tally: { ...NONE, false: 6, degenerate: 1, undefined: 1, ambiguous: 1, illConditioned: 1 },
      rungs: { 'exact over Q': 2, numeric: 4 },
      reasons: [
        { reason: 'degenerate: A and B coincide', count: 1 },
        { reason: 'H is undefined (x)', count: 1 },
      ],
      current: { value: 'true', rung: 'exact over Q' },
    });
    expect(verdictLine(v)).toEqual({
      text: 'False (local test, n = 10, exact over Q 2, numeric 4; true in the current figure only; 6 of 10 figures valid)',
      tone: 'false',
      detail:
        'seed 7 · 10 figures tested in 10 attempts · 0 true, 6 false · 4 not valid · degenerate: A and B coincide ×1; H is undefined (x) ×1',
    });
    // Each invalid count adds up; invalid alone also counts.
    const only = verdictLine({ ...v, tally: { ...NONE, false: 9, invalid: 1 }, reasons: [] });
    expect(only.detail).toBe(
      'seed 7 · 10 figures tested in 10 attempts · 0 true, 9 false · 1 not valid',
    );
    // Not true in the current figure: no note.
    expect(verdictLine({ ...v, current: { value: 'false', rung: 'exact over Q' } }).text).toBe(
      'False (local test, n = 10, exact over Q 2, numeric 4; 6 of 10 figures valid)',
    );
  });

  it('local mixed and inconclusive; hypothesis notes unless the figure explains them', () => {
    const mixed = verdict({
      regime: 'local',
      kind: 'mixed',
      tested: 8,
      attempts: 200,
      hardToSatisfy: true,
      tally: { ...NONE, true: 5, false: 3, rejected: 192 },
      rungs: { numeric: 8 },
    });
    expect(verdictLine(mixed).text).toBe(
      'Mixed (local test, n = 10, numeric: 5 true, 3 false; only 8 of 10 figures satisfied the hypotheses; hard to satisfy: few figures satisfy the hypotheses)',
    );
    expect(verdictLine(mixed).tone).toBe('mixed');
    expect(verdictLine(mixed, { figureExplains: true }).text).toBe(
      'Mixed (local test, n = 10, numeric: 5 true, 3 false; only 8 of 10 figures satisfied the hypotheses)',
    );
    const inc = verdict({
      regime: 'local',
      kind: 'inconclusive',
      tally: { ...NONE, true: 1, undefined: 9 },
      rungs: {},
    });
    expect(verdictLine(inc)).toEqual({
      text: 'Inconclusive (local test, n = 10: 1 of 10 figures valid)',
      tone: 'inconclusive',
      detail: 'seed 7 · 10 figures tested in 10 attempts · 1 true, 0 false · 9 not valid',
    });
  });

  it('global holds-across: rejected and mirrored counts in the line, mirrored in the detail', () => {
    const v = verdict({
      regime: 'global',
      kind: 'holds-across',
      attempts: 13,
      mirrored: 5,
      tally: { ...NONE, true: 10, rejected: 3 },
    });
    expect(verdictLine(v)).toEqual({
      text: 'Holds across the declared configuration (global test, n = 10, exact over Q; 3 samples rejected by hypotheses; 5 mirrored)',
      tone: 'info',
      detail: 'seed 7 · 10 figures tested in 13 attempts · 10 true, 0 false · 5 mirrored',
    });
    const none = { ...v, tally: { ...NONE, true: 10 } };
    const noMirror: Verdict = { ...none };
    delete (noMirror as { mirrored?: number }).mirrored;
    expect(verdictLine(noMirror).text).toBe(
      'Holds across the declared configuration (global test, n = 10, exact over Q; 0 mirrored)',
    );
    expect(verdictLine(noMirror).detail).toBe(
      'seed 7 · 10 figures tested in 13 attempts · 10 true, 0 false · 0 mirrored',
    );
  });

  it('global orientation-dependent, named and unnamed; configuration-dependent, both reasons', () => {
    const base = { regime: 'global', tally: { ...NONE, true: 6, false: 4 }, mirrored: 5 } as const;
    const named = verdict({
      ...base,
      kind: 'orientation-dependent',
      named: {
        object: 'X',
        selector: 'orient(+)',
        call: 'intersect(…)',
        advice: 'use same_side(…)',
      },
    });
    expect(verdictLine(named).text).toBe(
      "Orientation-dependent (global test, n = 10, exact over Q: 4 of 10 fail and hold with the selectors flipped; X's `orient(+)` encodes a side; use same_side(…))",
    );
    expect(verdictLine(verdict({ ...base, kind: 'orientation-dependent' })).text).toBe(
      'Orientation-dependent (global test, n = 10, exact over Q: 4 of 10 fail and hold with the selectors flipped; flipping its orientation-dependent selectors together repairs every failure)',
    );
    const cd = (text: string) =>
      verdictLine(verdict({ ...base, kind: 'configuration-dependent', text })).text;
    expect(cd('… no orientation-dependent selector')).toBe(
      'Configuration-dependent (global test, n = 10, exact over Q: 4 of 10 fail; no orientation-dependent selector)',
    );
    expect(cd('… does not repair them')).toBe(
      'Configuration-dependent (global test, n = 10, exact over Q: 4 of 10 fail; flipping the orientation-dependent selectors does not repair them)',
    );
    for (const kind of ['orientation-dependent', 'configuration-dependent'] as const)
      expect(verdictLine(verdict({ ...base, kind })).tone).toBe('info');
  });

  it('a global inconclusive verdict says global, is information, and lists no rungs', () => {
    const v = verdict({
      regime: 'global',
      kind: 'inconclusive',
      tally: { ...NONE, ambiguous: 10 },
      rungs: {},
      mirrored: 0,
    });
    expect(verdictLine(v)).toEqual({
      text: 'Inconclusive (global test, n = 10: 0 of 10 figures valid)',
      tone: 'info',
      detail:
        'seed 7 · 10 figures tested in 10 attempts · 0 true, 0 false · 10 not valid · 0 mirrored',
    });
  });
});
