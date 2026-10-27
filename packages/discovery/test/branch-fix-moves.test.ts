/**
 * ADR-0036 decision 5: what moves. A value moved when it differs beyond the band: points and
 * circles by the length band, a line by its offset (length) and by its turn (dimensionless),
 * at any scale. A flip lists the flipped point and the lines and points built on it.
 */
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { Figure, n, orient } from '../../claims/test/helpers/build';
import { branchFix, valueChanged } from '../src/branch-fix';
import { REGISTRY } from './helpers';

const line = (dx: number, dy: number, px = 0, py = 0): Value<number> => ({
  kind: 'line',
  p: { x: px, y: py },
  d: { x: dx, y: dy },
  lo: null,
  hi: null,
  chiral: false,
});

describe('what moves', () => {
  it('a line that turns has moved, at any scale', () => {
    // Scale 1000: the length band is 1000 times the dimensionless one. A turn of 1e-5 rad
    // about the anchor moves the line's far parts by about 1e-2 across the figure.
    const big = { scale: 1000 };
    expect(valueChanged(line(1, 0), line(1, 1e-5), big)).toBe(true);
    expect(valueChanged(line(1, 0), line(2, 0), big)).toBe(false);
    expect(valueChanged(line(1, 0), line(1, 0, 0, 1), { scale: 1 })).toBe(true);
    expect(valueChanged(line(1, 0), line(1, 0, 5, 0), { scale: 1 })).toBe(false);
  });

  it('undefined and kind changes are moves; equal points are not', () => {
    const p: Value<number> = { kind: 'point', x: 1, y: 2 };
    expect(valueChanged(p, undefined, { scale: 1 })).toBe(true);
    expect(valueChanged(undefined, undefined, { scale: 1 })).toBe(false);
    expect(valueChanged(p, line(1, 0), { scale: 1 })).toBe(true);
    expect(valueChanged(p, { kind: 'point', x: 1, y: 2 }, { scale: 1 })).toBe(false);
  });

  it('a flip moves the point and the line built on it', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 8, 0)
      .def('c1', 'circle', 'A', n(5))
      .def('c2', 'circle', 'B', n(5))
      .def('X', 'intersect', 'c1', 'c2', orient(-1))
      .def('U', 'intersect', 'c1', 'c2', orient(1))
      .def('g', 'line', 'A', 'X');
    const id = f.claim('equal', 'X', 'U');
    const r = branchFix(
      { kind: 'branchFix', doc: f.doc, claim: id, regime: 'local', seed: 3, n: 10 },
      { registry: REGISTRY },
    );
    if (r.kind !== 'fixes') throw new Error(r.kind);
    const flipX = r.fixes.find((x) => x.flipped.includes(f.id('X')));
    expect(flipX?.moves).toEqual([f.id('X'), f.id('g')]);
  });
});
