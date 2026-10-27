/**
 * ADR-0035 decision 13: special positions over every kind of free input, not only free points.
 * A glider on a line (its parameter t), on a circle by angle, on a circle by two literals
 * (stereographic) and a param(min, max, v) are each moved alone, within their own units; each
 * position found moves exactly that input, and its target is false now and true there.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '@geomira/claims/eval-claim';
import { exprEquals } from '@geomira/kernel/expr';
import { c, Figure, n } from '../../claims/test/helpers/build';
import { withFact } from '../src/find';
import { hunt, type HuntResult, type Position } from '../src/hunt';
import { movedSlots } from '../src/solve';
import { REGISTRY, show } from './helpers';

function positions(f: Figure, seed = 1): HuntResult {
  const r = hunt({ kind: 'hunt', doc: f.doc, seed }, { registry: REGISTRY });
  if (r.kind !== 'positions') throw new Error(r.kind);
  return r;
}

/** The position's target: false in the figure, true at the position. */
function checkTarget(f: Figure, p: Position): void {
  const now = withFact(f.doc, p.target);
  const there = withFact(p.doc, p.target);
  expect(evalClaim(now.doc, now.id, REGISTRY).value, show(f.doc, p.target)).toBe('false');
  expect(evalClaim(there.doc, there.id, REGISTRY).value, show(f.doc, p.target)).toBe('true');
  const changed = p.doc.objects.filter(
    (o, i) => !exprEquals(o.def, f.doc.objects[i]?.def ?? o.def),
  );
  expect(changed.map((o) => o.id)).toEqual([p.object]);
}

function movedBy(f: Figure, r: HuntResult, name: string): Position[] {
  return r.positions.filter((p) => p.object === f.id(name));
}

describe('special positions of gliders and params', () => {
  it('a glider on a line slides to the midpoint', () => {
    const f = new Figure()
      .point('B', 0, 0)
      .point('C', 6, 0)
      .def('l', 'line', 'B', 'C')
      .add('P', c('on', 'l', n('1/5')))
      .def('M', 'midpoint', 'B', 'C');
    const r = positions(f);
    const mine = movedBy(f, r, 'P');
    expect(mine.some((p) => show(f.doc, p.target) === 'equal(P, M)')).toBe(true);
    for (const p of r.positions) checkTarget(f, p);
  });

  it('a glider on a circle by angle turns onto a drawn point (within half the figure)', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('X', 5, 0)
      .def('k', 'circle', 'O', 'X')
      .add('Q', c('on', 'k', n(20)));
    const r = positions(f);
    expect(movedBy(f, r, 'Q').some((p) => show(f.doc, p.target) === 'equal(X, Q)')).toBe(true);
    for (const p of r.positions) checkTarget(f, p);
  });

  it('a stereographic glider on a circle moves by its two literals', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('X', 5, 0)
      .def('k', 'circle', 'O', 'X')
      .add('R', c('on', 'k', n(1), n(2)));
    const r = positions(f);
    for (const p of r.positions) checkTarget(f, p);
    expect(movedBy(f, r, 'R').length).toBeGreaterThan(0);
  });

  it('a param moves its value inside [min, max], never its bounds', () => {
    const f = new Figure()
      .point('O', 0, 0)
      .point('X', 5, 0)
      .add('s', c('param', n(1), n(10), n(3)))
      .def('k', 'circle', 'O', 's');
    const r = positions(f);
    const mine = movedBy(f, r, 's');
    expect(mine.some((p) => show(f.doc, p.target) === 'on(X, k)')).toBe(true);
    for (const p of mine) {
      const o = p.doc.objects.find((x) => x.id === f.id('s'));
      const args = o?.def.kind === 'call' ? o.def.args : [];
      expect(args[0]).toEqual(n(1));
      expect(args[1]).toEqual(n(10));
    }
    for (const p of r.positions) checkTarget(f, p);
  });

  it('the moved slots of each input kind', () => {
    const slots = (kind: Parameters<typeof movedSlots>[0]['kind']) =>
      movedSlots({ kind, id: 1, path: [], slots: [] });
    expect(slots('point')).toEqual([0, 1]);
    expect(slots('stereo')).toEqual([0, 1]);
    expect(slots('line-glider')).toEqual([0]);
    expect(slots('angle-glider')).toEqual([0]);
    expect(slots('param')).toEqual([2]);
    expect(slots('radius')).toEqual([]);
  });

  it('a literal radius is not a moved input; an empty document has no positions', () => {
    const f = new Figure().point('O', 0, 0).point('X', 4, 1).def('k', 'circle', 'O', n(5));
    const r = positions(f);
    expect(r.positions.some((p) => p.object === f.id('k'))).toBe(false);
    for (const p of r.positions) checkTarget(f, p);
    const empty = hunt({ kind: 'hunt', doc: new Figure().doc, seed: 1 }, { registry: REGISTRY });
    expect(empty).toMatchObject({ kind: 'positions', positions: [], targets: 0 });
  });
});
