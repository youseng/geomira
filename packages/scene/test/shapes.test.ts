import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { sceneBounds } from '../src/bounds';
import { shapeOf, unit } from '../src/shapes';
import { Doc } from './helpers/docs';

const P = { x: 0, y: 0 };

describe('shapeOf: values → world shapes (every number finite)', () => {
  it('line ranges are rescaled to a unit direction', () => {
    const s = shapeOf({ kind: 'line', p: P, d: { x: 3, y: 4 }, lo: 0, hi: 1, chiral: false });
    expect(s).toEqual({
      kind: 'shape',
      shape: { kind: 'line', p: P, u: { x: 0.6, y: 0.8 }, lo: 0, hi: 5 },
    });
  });

  it('arcs become angles; circles get their radius', () => {
    const s = shapeOf({
      kind: 'circle',
      c: P,
      r2: 4,
      arc: { from: { x: 2, y: 0 }, to: { x: 0, y: 2 } },
    });
    expect(s).toEqual({
      kind: 'shape',
      shape: { kind: 'circle', c: P, r: 2, arc: { from: 0, to: Math.PI / 2 } },
    });
  });

  it('non-finite or degenerate numbers are unavailable, never shapes', () => {
    const bad: Value<number>[] = [
      { kind: 'point', x: Number.NaN, y: 0 },
      { kind: 'line', p: P, d: { x: 0, y: 0 }, lo: null, hi: null, chiral: false },
      { kind: 'line', p: P, d: { x: 1e300, y: 1e300 }, lo: 0, hi: 1e10, chiral: false },
      {
        kind: 'line',
        p: { x: Infinity, y: 0 },
        d: { x: 1, y: 0 },
        lo: null,
        hi: null,
        chiral: false,
      },
      { kind: 'circle', c: P, r2: 0, arc: null },
      { kind: 'circle', c: P, r2: 1, arc: { from: { x: Number.NaN, y: 0 }, to: P } },
      { kind: 'polygon', pts: [P, { x: 1, y: Infinity }, P] },
    ];
    for (const v of bad) expect(shapeOf(v).kind).toBe('unavailable');
    expect(unit({ x: Infinity, y: 0 })).toBeUndefined();
  });

  it('numbers and transforms are not drawn; unknown future kinds are unavailable', () => {
    expect(shapeOf({ kind: 'number', v: 1 })).toEqual({ kind: 'none' });
    const future = { kind: 'locus' } as unknown as Value<number>;
    expect(shapeOf(future)).toEqual({ kind: 'unavailable', reason: 'a locus cannot be drawn' });
    expect(shapeOf({ kind: 'inexact', reason: 'r' })).toEqual({ kind: 'unavailable', reason: 'r' });
  });
});

describe('sceneBounds', () => {
  it('covers points, segment ends, a point of each line, circle boxes, polygons', () => {
    const t = new Doc().point('A', 0, 0).point('B', 2, 1);
    t.add('l', t.call('line', 'A', 'B'));
    t.add('r', t.call('ray', 'B', 'A'));
    t.add('w', t.call('circle', 'A', 'B'));
    const r = Math.sqrt(5);
    expect(sceneBounds(t.scene())).toEqual({ minX: -r, minY: -r, maxX: r, maxY: r });
    expect(sceneBounds(new Doc().scene())).toBeNull();
  });
});
