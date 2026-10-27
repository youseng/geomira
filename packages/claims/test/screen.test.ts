/**
 * ADR-0035 decision 5: the finder's screen decides a claim about the figure's objects by the
 * numeric rung on one shared set of perturbations. On the L12 corpora: true theorems are TRUE
 * (or, never false, ill-conditioned); false claims are never TRUE; degenerate claims are never
 * true or false. Its seed decides its perturbations (deterministic), and it reports undefined
 * objects and invalid arguments as such.
 */
import { describe, expect, it } from 'vitest';
import { rational } from '@geomira/num/rational';
import { emptyDocument } from '@geomira/kernel/document';
import { claimKind } from '../src/kinds';
import { screenFigure, type Screen } from '../src/screen';
import { c, REGISTRY } from './helpers/build';
import { baseFigure, type Entry } from './helpers/corpus';
import { DEGENERATE_CLAIMS } from './helpers/corpus-degenerate';
import { FALSE_CLAIMS } from './helpers/corpus-false';
import { TRUE_THEOREMS } from './helpers/corpus-true';
import { objectify } from './helpers/objectify';

function decideEntry(e: Entry, seed = 7): string {
  const f = baseFigure();
  const id = e.build(f);
  const o = objectify(f.doc, id);
  const s = screenFigure(o.doc, REGISTRY, seed);
  const kind = claimKind(o.kind);
  if ('reason' in s || kind === undefined) throw new Error(e.name);
  return s.decide(kind, o.args).kind;
}

describe('the screen (ADR-0035)', () => {
  it('true theorems are true (never false) in the current figure', () => {
    for (const e of TRUE_THEOREMS) {
      const k = decideEntry(e);
      expect(['true', 'ill-conditioned'], `${e.name}: ${k}`).toContain(k);
    }
    expect(TRUE_THEOREMS.filter((e) => decideEntry(e) === 'true').length).toBeGreaterThan(
      TRUE_THEOREMS.length - 3,
    );
  });

  it('false claims are never true', () => {
    for (const e of FALSE_CLAIMS) expect(decideEntry(e), e.name).not.toBe('true');
    expect(FALSE_CLAIMS.filter((e) => decideEntry(e) === 'false').length).toBeGreaterThan(
      FALSE_CLAIMS.length / 2,
    );
  });

  it('degenerate claims are never true or false', () => {
    for (const e of DEGENERATE_CLAIMS) {
      let k: string;
      try {
        k = decideEntry(e);
      } catch {
        continue; // a claim on an image of an Undefined map has no object to objectify
      }
      expect(['true', 'false'], `${e.name}: ${k}`).not.toContain(k);
    }
  });

  it('is deterministic for a seed; reports undefined objects and invalid arguments', () => {
    // X: the intersection of two parallel lines (Undefined).
    const f = baseFigure().def(
      'X',
      'intersect',
      c('line', 'A', 'B'),
      c('parallel', 'C', c('line', 'A', 'B')),
    );
    const col = claimKind('collinear');
    const len = claimKind('length');
    if (col === undefined || len === undefined) throw new Error('kinds');
    const s1 = screenFigure(f.doc, REGISTRY, 3) as Screen;
    const s2 = screenFigure(f.doc, REGISTRY, 3) as Screen;
    const [A, B, C, O, X] = ['A', 'B', 'C', 'O', 'X'].map((n) => ({ id: f.id(n) }));
    if (A === undefined || B === undefined || C === undefined || O === undefined || X === undefined)
      throw new Error('ids');
    expect(s1.decide(col, [A, B, C])).toEqual(s2.decide(col, [A, B, C]));
    expect(s1.decide(col, [A, B, C]).kind).toBe('false');
    expect(s1.decide(col, [A, B, X]).kind).toBe('undefined');
    expect(s1.decide(col, [A, { id: f.id('w') }, C]).kind).toBe('invalid');
    expect(s1.decide(col, [A, A, C]).kind).toBe('degenerate');
    expect(s1.decide(col, [A, { id: 9999 }, C])).toMatchObject({ kind: 'undefined' });
    const one = { lit: rational(1n) };
    expect(s1.decide(len, [O, A, O, B, one]).kind).toBe('true');
    expect(s1.argValues(col, [A, B, C])).toHaveLength(3);
    expect(s1.free.map((x) => x.kind)).toEqual(Array(7).fill('point'));
    expect(s1.seed).toBe(3);
  });

  it('a figure beyond the double range has no screen', () => {
    const doc = emptyDocument();
    const big = {
      ...doc,
      nextId: doc.nextId + 1,
      objects: [
        {
          id: doc.nextId,
          name: 'A',
          def: {
            kind: 'call' as const,
            tool: 'point',
            args: [
              { kind: 'lit' as const, value: rational(10n ** 400n) },
              { kind: 'lit' as const, value: rational(0n) },
            ],
            selectors: [],
          },
          style: {},
          layers: ['main'],
        },
      ],
    };
    expect('reason' in screenFigure(big, REGISTRY, 1)).toBe(true);
  });
});
