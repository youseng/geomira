/**
 * ADR-0062: box selection takes the objects WHOLLY inside the box (a window, not a crossing),
 * shape by shape, in draw order; an unbounded line is never taken; a hidden object is not in
 * the scene.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { inBox, shapeInBox } from '../src/box';
import type { Shape } from '../src/types';
import type { Rect } from '../src/viewport';
import { Doc } from './helpers/docs';

/** The figure of these tests: three points and one object of each kind a box can or cannot take. */
function figure() {
  const d = new Doc().point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
  d.add('l', d.call('line', 'A', 'B'));
  d.add('s', d.call('segment', 'A', 'C'));
  d.add('r', d.call('ray', 'A', 'B'));
  d.add('ω', d.call('circle', 'A', 'B'));
  d.add('k', d.call('circle', 'C', 0.5));
  d.add('p', d.call('polygon', 'A', 'B', 'C'));
  d.point('H', 9, 9, { style: { hidden: true } });
  const scene = d.scene();
  const names = (ids: readonly number[]) =>
    ids.map((id) => d.doc.objects.find((o) => o.id === id)?.name);
  return { scene, names };
}

const rect = (minX: number, minY: number, maxX: number, maxY: number): Rect => ({
  minX,
  minY,
  maxX,
  maxY,
});

describe('the objects wholly inside a box', () => {
  const { scene, names } = figure();

  it('points by their place; a segment by both ends; a polygon by every vertex', () => {
    expect(names(inBox(scene, rect(-1, -1, 2, 4)))).toEqual(['k', 's', 'A', 'C']);
    expect(names(inBox(scene, rect(-1, -1, 5, 4)))).toEqual(['p', 'k', 's', 'A', 'B', 'C']);
  });

  it('a circle only when its whole disc fits', () => {
    expect(names(inBox(scene, rect(0, 2, 2, 4)))).toEqual(['k', 'C']);
    expect(names(inBox(scene, rect(-5, -5, 5, 5)))).toContain('ω');
    expect(names(inBox(scene, rect(-3.9, -5, 5, 5)))).not.toContain('ω');
  });

  it('never an unbounded line or a ray, however large the box', () => {
    const all = names(inBox(scene, rect(-1e6, -1e6, 1e6, 1e6)));
    expect(all).not.toContain('l');
    expect(all).not.toContain('r');
    // Draw order: the polygon, the circles, the segment, then the points on top.
    expect(all).toEqual(['p', 'ω', 'k', 's', 'A', 'B', 'C']);
  });

  it('a hidden object is not drawn, so it is not selected', () => {
    expect(names(inBox(scene, rect(8, 8, 10, 10)))).toEqual([]);
  });

  it('an empty or inverted box takes nothing; a box of one point takes the point there', () => {
    expect(inBox(scene, rect(2, 2, 1, 1))).toEqual([]);
    expect(inBox(scene, rect(NaN, 0, 1, 1))).toEqual([]);
    expect(names(inBox(scene, rect(0, 0, 0, 0)))).toEqual(['A']);
  });
});

describe('shape by shape', () => {
  const unit = rect(0, 0, 10, 10);

  it('an ellipse by its bounding box; a hyperbola and a parabola never', () => {
    const conic = (type: 'ellipse' | 'hyperbola' | 'parabola', cx: number): Shape => ({
      kind: 'conic',
      type,
      c: { x: cx, y: 5 },
      u: { x: 0, y: 1 },
      a: 4,
      b: 1,
    });
    // Its long axis is vertical: half-extents (1, 4).
    expect(shapeInBox(conic('ellipse', 5), unit)).toBe(true);
    expect(shapeInBox(conic('ellipse', 0.5), unit)).toBe(false);
    expect(shapeInBox(conic('hyperbola', 5), unit)).toBe(false);
    expect(shapeInBox(conic('parabola', 5), unit)).toBe(false);
  });

  it('marks, texts and distances by their anchors', () => {
    const p = { x: 1, y: 1 };
    const q = { x: 11, y: 1 };
    expect(shapeInBox({ kind: 'text', at: p, text: 't' }, unit)).toBe(true);
    expect(
      shapeInBox({ kind: 'angle_mark', b: p, from: 0, to: 1, arcs: 1, right: false }, unit),
    ).toBe(true);
    expect(shapeInBox({ kind: 'segment_mark', p, q, ticks: 1 }, unit)).toBe(false);
    expect(shapeInBox({ kind: 'distance', p, q: p }, unit)).toBe(true);
    expect(
      shapeInBox({ kind: 'line', p, u: { x: 1, y: 0 }, lo: 0, hi: 5, outside: true }, unit),
    ).toBe(false);
  });

  it('law: a larger box never loses an object (monotone)', () => {
    const { scene } = figure();
    const num = fc.double({ min: -8, max: 8, noNaN: true });
    fc.assert(
      fc.property(
        num,
        num,
        num,
        num,
        fc.double({ min: 0, max: 5, noNaN: true }),
        (a, b, c, d, g) => {
          const small = rect(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d));
          const large = rect(small.minX - g, small.minY - g, small.maxX + g, small.maxY + g);
          const inLarge = new Set(inBox(scene, large));
          for (const id of inBox(scene, small)) expect(inLarge.has(id)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
