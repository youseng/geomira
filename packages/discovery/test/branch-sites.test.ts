/**
 * ADR-0036 decisions 1 and 3: branch sites and how an assignment is written. A site whose
 * filter picks neither candidate now has no current choice (it is still a site); a nested call
 * whose arguments are not objects gets the low-level selector the kernel confirms even when a
 * chooser is given; a kept site with a firm selector (other(P)) is left as written; nearestTo
 * says −1 when there is nothing to compare.
 */
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { FloatField } from '@geomira/num/float-field';
import { sameConstruction } from '@geomira/kernel/construction-key';
import {
  along,
  c,
  Figure,
  n,
  near,
  orient,
  other,
  sameSide,
} from '../../claims/test/helpers/build';
import { assign, nearestTo, repeatsIn, sitesOf } from '../src/branch-sites';
import type { Chooser } from '../src/types';
import { REGISTRY } from './helpers';

function circles(): Figure {
  return new Figure()
    .point('A', 0, 0)
    .point('B', 8, 0)
    .def('c1', 'circle', 'A', n(5))
    .def('c2', 'circle', 'B', n(5))
    .def('ab', 'line', 'A', 'B');
}

function claimArgs(f: Figure, id: number) {
  return f.doc.claims.find((x) => x.id === id)?.args ?? [];
}

/** A chooser that must not be called (the test fails if it is). */
const never: Chooser = () => {
  throw new Error('the chooser was called');
};

function valueOf(doc: Figure['doc'], name: string) {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) throw new Error('context');
  const o = doc.objects.find((x) => x.name === name);
  return o === undefined
    ? undefined
    : evaluate(doc, REGISTRY, FloatField, ctx.ctx).values.get(o.id);
}

describe('branch sites', () => {
  it('a filter that picks neither candidate: a site without a current choice', () => {
    // Q is on line ab: same_side(Q, ab) holds for neither intersection point.
    const f = circles().point('Q', 3, 0).def('Y', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'));
    const id = f.claim('on', 'Y', 'c1');
    const sites = sitesOf(f.doc, REGISTRY, claimArgs(f, id));
    expect(sites).toHaveLength(1);
    expect(sites[0]?.current).toBe(-1);
    expect(sites[0]?.was).toBeUndefined();
    // Writing it keeps candidate 0 with a low-level selector: Y becomes defined.
    const d =
      sites[0] === undefined ? undefined : assign(f.doc, REGISTRY, sites, [false], undefined);
    expect(d === undefined ? undefined : valueOf(d, 'Y')?.kind).toBe('point');
  });

  it('a nested call is written with low-level selectors, even with a chooser', () => {
    // The intersection inside W's definition has a call (not an object) as an argument.
    const f = circles().add(
      'W',
      c('midpoint', c('intersect', c('circle', 'A', n(5)), 'c2', orient(1)), 'A'),
    );
    const id = f.claim('on', 'W', 'c1');
    const sites = sitesOf(f.doc, REGISTRY, claimArgs(f, id));
    expect(sites.map((s) => [s.object, s.path.length > 0])).toEqual([[f.id('W'), true]]);
    const before = valueOf(f.doc, 'W');
    const flipped = assign(f.doc, REGISTRY, sites, [true], never);
    if (flipped === undefined) throw new Error('no assignment');
    const after = valueOf(flipped, 'W');
    // The intersection flipped to (4, −3): W, the midpoint with A, moves from (2, 1.5) to (2, −1.5).
    expect(before).toMatchObject({ kind: 'point', x: 2, y: 1.5 });
    expect(after?.kind === 'point' ? [after.x, after.y] : []).toEqual([2, -1.5]);
  });

  it('a kept site with other(P) is left as written', () => {
    const f = circles()
      .def('X', 'intersect', 'c1', 'c2', orient(1))
      .def('Z', 'intersect', 'c1', 'c2', other('X'));
    const id = f.claim('equal', 'Z', 'X');
    const sites = sitesOf(f.doc, REGISTRY, claimArgs(f, id));
    expect(sites.map((s) => s.object)).toEqual([f.id('X'), f.id('Z')]);
    const kept = assign(f.doc, REGISTRY, sites, [false, false], undefined);
    const z = kept?.objects.find((o) => o.name === 'Z');
    expect(z?.def.kind === 'call' ? z.def.selectors.map((s) => s.kind) : []).toEqual(['other']);
  });

  it('nearestTo: −1 without a value or without two candidates', () => {
    expect(
      nearestTo(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        undefined,
      ),
    ).toBe(-1);
    expect(nearestTo([{ x: 0, y: 0 }], { x: 0, y: 0 })).toBe(-1);
    expect(
      nearestTo(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        { x: 0.9, y: 0 },
      ),
    ).toBe(1);
    expect(
      nearestTo(
        [
          { x: 0, y: 3 },
          { x: 0, y: -3 },
        ],
        { kind: 'line', p: { x: 0, y: 3 }, d: { x: 1, y: 0 }, lo: null, hi: null, chiral: false },
      ),
    ).toBe(0);
  });

  it('one candidate or none is not a site (line ∩ line, disjoint circles)', () => {
    const f = circles()
      .point('C', 1, 4)
      .def('m', 'line', 'A', 'C')
      .def('X', 'intersect', 'ab', 'm')
      .def('c3', 'circle', 'A', n(1))
      .def('c4', 'circle', 'B', n(1))
      .def('Y', 'intersect', 'c3', 'c4', orient(1));
    const id = f.claim('equal', 'X', 'Y');
    expect(sitesOf(f.doc, REGISTRY, claimArgs(f, id))).toEqual([]);
  });

  it('a repeat of another object is written only when nothing else picks the candidate, and reported', () => {
    // CI's case: line ∩ circle has only along(±); keeping X writes along(+), R's definition.
    const f = new Figure()
      .point('O', 0, 0)
      .point('L1', -7, '1/10')
      .point('L2', 7, '1/10')
      .point('P', '1/50', 4)
      .def('k', 'circle', 'O', n(5))
      .def('l', 'line', 'L1', 'L2')
      .def('X', 'intersect', 'l', 'k', near('P'))
      .def('R', 'intersect', 'l', 'k', along(1));
    const id = f.claim('equal', 'X', 'R');
    const xSite = sitesOf(f.doc, REGISTRY, claimArgs(f, id)).filter((s) => s.object === f.id('X'));
    const alongPlus: Chooser = () => ({ ok: true, selectors: [{ kind: 'along', sign: 1 }] });
    for (const choose of [alongPlus, undefined]) {
      const d = assign(f.doc, REGISTRY, xSite, [false], choose);
      if (d === undefined) throw new Error('no assignment');
      expect(valueOf(d, 'X')).toEqual(valueOf(f.doc, 'X'));
      expect(repeatsIn(f.doc, d, REGISTRY)).toEqual([{ object: f.id('X'), of: f.id('R') }]);
    }
  });

  it('a selector that would repeat another object gives way to one that does not', () => {
    // The chooser's same_side(Q, ab) would be W's definition; orient(+) picks the same point.
    const f = circles()
      .point('Q', 4, 10)
      .point('P', '41/10', 2)
      .def('W', 'intersect', 'c1', 'c2', sameSide('Q', 'ab'))
      .def('X', 'intersect', 'c1', 'c2', near('P'));
    const id = f.claim('equal', 'X', 'W');
    const xSite = sitesOf(f.doc, REGISTRY, claimArgs(f, id)).filter((s) => s.object === f.id('X'));
    const q = f.id('Q');
    const ab = f.id('ab');
    const repeatW: Chooser = () => ({
      ok: true,
      selectors: [{ kind: 'same_side', q: { kind: 'ref', id: q }, l: { kind: 'ref', id: ab } }],
    });
    const d = assign(f.doc, REGISTRY, xSite, [false], repeatW);
    if (d === undefined) throw new Error('no assignment');
    const x = d.objects.find((o) => o.id === f.id('X'));
    if (x === undefined) throw new Error('X');
    expect(sameConstruction(d, x.def, REGISTRY, { except: x.id })).toBeUndefined();
    expect(repeatsIn(f.doc, d, REGISTRY)).toEqual([]);
    expect(valueOf(d, 'X')).toEqual(valueOf(f.doc, 'X'));
  });
});
