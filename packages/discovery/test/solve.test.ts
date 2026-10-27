/**
 * ADR-0035 decision 13: the special-position solver. solveSmall solves small systems and says
 * undefined for singular ones; closureIds follows references; conditionsAt is undefined where
 * the figure is; solve finds a reachable position, and refuses one beyond half the figure.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { screenFigure } from '@geomira/claims/screen';
import { Figure, n } from '../../claims/test/helpers/build';
import { closureIds, conditionsAt, solve, solveSmall, type Problem } from '../src/solve';
import { REGISTRY } from './helpers';

const KINDS = claimKindRegistry();

/** The problem "make `kind(names)` true by moving the free point `mover`". */
function problem(f: Figure, kind: string, mover: string, ...names: string[]): Problem {
  const s = screenFigure(f.doc, REGISTRY, 1);
  if ('reason' in s) throw new Error(s.reason);
  const spec = KINDS.get(kind);
  const input = s.free.find((x) => x.id === f.id(mover));
  if (spec === undefined || input === undefined) throw new Error('setup');
  return {
    doc: f.doc,
    registry: REGISTRY,
    ctx: s.ctx,
    kind: spec,
    args: names.map((x) => ({ id: f.id(x) })),
    input,
    units: [10, 10],
    size: 10,
  };
}

describe('solveSmall', () => {
  it('solves 1×1, 2×2 and 3×3 systems', () => {
    expect(solveSmall([[2]], [4])).toEqual([2]);
    const two = solveSmall(
      [
        [0, 1],
        [1, 0],
      ],
      [3, 5],
    );
    expect(two).toEqual([5, 3]);
    const three = solveSmall(
      [
        [2, 1, 0],
        [1, 3, 1],
        [0, 1, 4],
      ],
      [3, 5, 5],
    );
    expect(three?.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([1, 1, 1]);
  });

  it('a singular system has no solution', () => {
    expect(
      solveSmall(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toBeUndefined();
    expect(solveSmall([[0]], [1])).toBeUndefined();
  });
});

describe('the solver', () => {
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 10, 0)
    .point('C', 3, 4)
    .def('M', 'midpoint', 'A', 'B')
    .def('k', 'circle', 'M', n(2));

  it('closureIds: the objects a claim depends on', () => {
    expect([...closureIds(f.doc, [f.id('k')])].sort()).toEqual(
      [f.id('A'), f.id('B'), f.id('M'), f.id('k')].sort(),
    );
    expect([...closureIds(f.doc, [999])]).toEqual([]);
  });

  it('moves C onto M (a reachable position)', () => {
    const x = solve(problem(f, 'equal', 'C', 'C', 'M'));
    expect(x?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([5, 0]);
  });

  it('refuses a position beyond half the figure', () => {
    const far = new Figure().point('A', 0, 0).point('B', 10, 0).point('C', 3, 4).point('D', 40, 40);
    const p = problem(far, 'equal', 'C', 'C', 'D');
    expect(solve({ ...p, units: [10, 10] })).toBeUndefined();
  });

  it('conditionsAt is undefined where an argument is undefined', () => {
    const g = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 1, 3)
      .def('O', 'circumcenter', 'A', 'B', 'C');
    const p = problem(g, 'equal', 'C', 'O', 'A');
    const keep = closureIds(g.doc, [g.id('O'), g.id('A')]);
    // C on line AB: no circumcentre.
    expect(conditionsAt(p, [2, 0], keep)).toBeUndefined();
    expect(conditionsAt(p, [1, 3], keep)).toBeDefined();
  });
});
