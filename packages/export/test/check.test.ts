import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { checkCoordinates, parseWrites } from '../src/check';
import type { AsyDecl, AsyPlan } from '../src/asy-plan';
import { AsyNames } from '../src/asy-names';
import type { AsyType } from '../src/asy-map';

function plan(decls: readonly [number, AsyType][]): AsyPlan {
  const ds: AsyDecl[] = decls.map(([id, type]) => ({
    id,
    name: `o${String(id)}`,
    ident: `o${String(id)}`,
    type,
    code: '',
    constructive: true,
    dependent: true,
    variants: [],
    helpers: [],
  }));
  return { decls: ds, byId: new Map(ds.map((d) => [d.id, d])), names: new AsyNames() };
}

const P: Value<number> = { kind: 'point', x: 1, y: 2 };
const SEG: Value<number> = {
  kind: 'line',
  p: { x: 0, y: 0 },
  d: { x: 4, y: 0 },
  lo: 0,
  hi: 1,
  chiral: false,
};
const LINE: Value<number> = {
  kind: 'line',
  p: { x: 0, y: 1 },
  d: { x: 1, y: 1 },
  lo: null,
  hi: null,
  chiral: false,
};
const CIRC: Value<number> = { kind: 'circle', c: { x: 1, y: 1 }, r2: 4, arc: null };
const NUM: Value<number> = { kind: 'number', v: 0.5 };
const REFL: Value<number> = {
  kind: 'transform',
  t: { type: 'similarity', anti: true, a: { re: 1, im: 0 }, b: { re: 0, im: 0 } },
};
const POLY: Value<number> = {
  kind: 'polygon',
  pts: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ],
};

const ALL = plan([
  [1, 'pair'],
  [2, 'gmline'],
  [3, 'gmline'],
  [4, 'gmcircle'],
  [5, 'real'],
  [6, 'transform'],
  [7, 'path'],
]);
const VALUES = new Map<number, Value<number>>([
  [1, P],
  [2, SEG],
  [3, LINE],
  [4, CIRC],
  [5, NUM],
  [6, REFL],
  [7, POLY],
]);
const GOOD = [
  '1 1 2',
  // the same segment, written from the other direction would fail; this one is equal
  '2 0 0 4 0 1 0 1 1',
  // another point of the line and another (same-sense) direction length
  '3 2 3 0.5 0.5 0 0 0 0',
  '4 1 1 2',
  '5 0.5',
  '6 0 0 1 0 0 -1',
  '7 0 0 1 0 0 1',
].join('\n');

describe('checkCoordinates', () => {
  it('passes Asymptote output equal to the kernel values (any other output lines ignored)', () => {
    const r = checkCoordinates(ALL, VALUES, 10, `some asy chatter\n${GOOD}\n`);
    expect(r.problems).toEqual([]);
    expect(r.checked).toBe(7);
    expect(r.constructive).toBe(7);
    expect(r.worst).toBe(0);
  });

  it('accepts errors up to EXPORT_TOL·scale and refuses larger ones', () => {
    const near = GOOD.replace('1 1 2', '1 1.000005 2');
    expect(checkCoordinates(ALL, VALUES, 10, near).problems).toEqual([]);
    const far = GOOD.replace('1 1 2', '1 1.00002 2');
    expect(checkCoordinates(ALL, VALUES, 10, far).problems).toEqual([
      { id: 1, name: 'o1', reason: 'off by 2.00e-6 of the scale' },
    ]);
  });

  it.each([
    [
      'a line in the other sense',
      '3 2 3 0.5 0.5',
      '3 2 3 -0.5 -0.5',
      'the direction has the other sense',
    ],
    ['a line off the carrier', '3 2 3 0.5 0.5', '3 2 3.1 0.5 0.5', 'off by'],
    ['a segment with another end', '2 0 0 4 0 1 0 1 1', '2 0 0 5 0 1 0 1 1', 'off by'],
    ['a segment as a line', '2 0 0 4 0 1 0 1 1', '2 0 0 4 0 0 0 0 0', 'the range differs'],
    ['a circle of another radius', '4 1 1 2', '4 1 1 2.1', 'off by'],
    ['another number', '5 0.5', '5 0.6', 'off by'],
    ['a different map', '6 0 0 1 0 0 -1', '6 0 0 1 0 0 1', 'off by'],
    ['a different vertex', '7 0 0 1 0 0 1', '7 0 0 1 0 0 2', 'off by'],
    ['too few vertices', '7 0 0 1 0 0 1', '7 0 0 1 0', 'a different number of vertices'],
    ['a point with three numbers', '1 1 2', '1 1 2 3', 'not a point'],
  ])('refuses %s', (_name, from, to, reason) => {
    const r = checkCoordinates(ALL, VALUES, 10, GOOD.replace(from, to));
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.reason).toContain(reason);
  });

  it('refuses a variable written twice, never, or one that was not declared', () => {
    expect(checkCoordinates(ALL, VALUES, 10, `${GOOD}\n1 1 2`).problems[0]?.reason).toBe(
      'written 2 times',
    );
    expect(checkCoordinates(ALL, VALUES, 10, GOOD.replace('\n5 0.5', '')).problems[0]?.reason).toBe(
      'written 0 times',
    );
    expect(checkCoordinates(ALL, VALUES, 10, `${GOOD}\n99 1`).problems).toEqual([
      { id: 99, name: '?', reason: 'written but not declared' },
    ]);
  });

  it('refuses a value of a kind that has no variable', () => {
    const v = new Map(VALUES);
    v.set(1, { kind: 'undefined', reason: 'x' });
    expect(checkCoordinates(ALL, v, 10, GOOD).problems[0]?.reason).toBe(
      'a undefined has no variable',
    );
  });

  it('parseWrites reads id lines with finite numbers only', () => {
    const w = parseWrites('1 2 3\nfoo 1\n2 nan\n 3 1e-7 -2.5E+3 \n');
    expect([...w.entries()]).toEqual([
      [1, [[2, 3]]],
      [3, [[1e-7, -2500]]],
    ]);
  });
});
