import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { clipCircle, clipLine, clipPolygon, inside, intersectSpans, wrap } from '../src/clip';

const R = { minX: -1, minY: -1, maxX: 1, maxY: 1 };
const TAU = 2 * Math.PI;

describe('clipLine', () => {
  it('a full line through the box gives the chord; one beside it gives null', () => {
    expect(clipLine({ x: -5, y: 0 }, { x: 1, y: 0 }, null, null, R)).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(clipLine({ x: -5, y: 2 }, { x: 1, y: 0 }, null, null, R)).toBeNull();
  });

  it('a line exactly through a corner touches it in one point', () => {
    const u = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    const seg = clipLine({ x: 0, y: 2 }, u, null, null, R);
    expect(seg).not.toBeNull();
    expect(seg?.[0].x).toBeCloseTo(1, 12);
    expect(seg?.[0].y).toBeCloseTo(1, 12);
    expect(seg?.[1].x).toBeCloseTo(1, 12);
  });

  it('segments and rays keep their range; an empty range is invisible', () => {
    const u = { x: 1, y: 0 };
    expect(clipLine({ x: 0, y: 0 }, u, 0, 0.5, R)).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
    ]);
    expect(clipLine({ x: 0, y: 0 }, u, 0, null, R)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    expect(clipLine({ x: 0, y: 0 }, u, null, -2, R)).toBeNull();
    expect(clipLine({ x: 0, y: 0 }, u, 1, 0, R)).toBeNull();
  });

  it('a carrier 1e308 away or overflowing ends is invisible, never non-finite', () => {
    const u = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    expect(clipLine({ x: 1e308, y: -1e308 }, u, null, null, R)).toBeNull();
    expect(clipLine({ x: 0, y: 1e308 }, { x: 1, y: 0 }, null, null, R)).toBeNull();
  });

  it('property: clipped ends are finite, inside the box, and on the line', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        (x, y, a) => {
          const u = { x: Math.cos(a), y: Math.sin(a) };
          const seg = clipLine({ x, y }, u, null, null, R);
          for (const q of seg ?? []) {
            expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true);
            expect(Math.abs(q.x)).toBeLessThanOrEqual(1 + 1e-6);
            expect(Math.abs(q.y)).toBeLessThanOrEqual(1 + 1e-6);
            expect(Math.abs((q.x - x) * u.y - (q.y - y) * u.x)).toBeLessThan(1e-6);
          }
        },
      ),
    );
  });
});

describe('clipCircle', () => {
  it('inside → the full span; disjoint → none; containing the box → none', () => {
    expect(clipCircle({ x: 0, y: 0 }, 0.5, null, R)).toEqual({
      kind: 'spans',
      spans: [{ from: 0, to: TAU }],
    });
    expect(clipCircle({ x: 5, y: 0 }, 1, null, R)).toEqual({ kind: 'none' });
    expect(clipCircle({ x: 0, y: 0 }, 10, null, R)).toEqual({ kind: 'none' });
  });

  it('a circle through the box gives the arcs inside it', () => {
    const c = clipCircle({ x: 1, y: 1 }, 1, null, R);
    expect(c.kind).toBe('spans');
    if (c.kind !== 'spans') return;
    expect(c.spans).toHaveLength(1);
    expect(c.spans[0]?.from).toBeCloseTo(Math.PI, 12);
    expect(c.spans[0]?.to).toBeCloseTo(1.5 * Math.PI, 12);
  });

  it('an arc is intersected with the visible spans', () => {
    const half = clipCircle({ x: 0, y: 0 }, 0.5, { from: 0, to: Math.PI }, R);
    expect(half).toEqual({ kind: 'spans', spans: [{ from: 0, to: Math.PI }] });
    const wrapping = clipCircle({ x: 0, y: 0 }, 0.5, { from: -Math.PI / 2, to: Math.PI / 2 }, R);
    expect(wrapping).toEqual({
      kind: 'spans',
      spans: [
        { from: 0, to: Math.PI / 2 },
        { from: 1.5 * Math.PI, to: TAU },
      ],
    });
    const closed = clipCircle({ x: 0, y: 0 }, 0.5, { from: 1, to: 1 }, R);
    const total = closed.kind === 'spans' ? closed.spans.reduce((a, x) => a + x.to - x.from, 0) : 0;
    expect(total).toBeCloseTo(TAU, 12); // ends that coincide: the whole circle
  });

  it('a huge circle whose edge crosses the box (radius 1e12) gives a finite, thin span', () => {
    const c = clipCircle({ x: 0, y: -1e12 }, 1e12, null, R);
    expect(c.kind).toBe('spans');
    if (c.kind !== 'spans') return;
    for (const s of c.spans) {
      expect(Number.isFinite(s.from) && Number.isFinite(s.to)).toBe(true);
      expect(s.to - s.from).toBeLessThan(1e-11);
    }
  });

  it('property: every span midpoint lies inside the box', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -3, max: 3, noNaN: true }),
        fc.double({ min: -3, max: 3, noNaN: true }),
        fc.double({ min: 0.01, max: 5, noNaN: true }),
        (x, y, r) => {
          const c = clipCircle({ x, y }, r, null, R);
          if (c.kind === 'none') return;
          for (const s of c.spans) {
            const m = (s.from + s.to) / 2;
            const p = { x: x + r * Math.cos(m), y: y + r * Math.sin(m) };
            expect(inside({ minX: -1.001, minY: -1.001, maxX: 1.001, maxY: 1.001 }, p)).toBe(true);
          }
        },
      ),
    );
  });

  it('spans: wrap and intersect', () => {
    expect(wrap(-Math.PI / 2)).toBeCloseTo(1.5 * Math.PI, 12);
    expect(wrap(TAU)).toBe(0);
    expect(intersectSpans({ from: 0, to: 1 }, { from: 2, to: 3 })).toEqual([]);
    expect(intersectSpans({ from: 0, to: TAU }, { from: 6, to: 7 })).toEqual([
      { from: 0, to: 7 - TAU },
      { from: 6, to: TAU },
    ]);
  });
});

describe('clipPolygon (Sutherland–Hodgman)', () => {
  it('keeps a polygon inside, cuts one across, drops one outside', () => {
    const inner = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0, y: 0.5 },
    ];
    expect(clipPolygon(inner, R)).toEqual(inner);
    const big = [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ];
    expect(clipPolygon(big, R)).toHaveLength(4);
    expect(
      clipPolygon(
        big.map((p) => ({ x: p.x + 20, y: p.y })),
        R,
      ),
    ).toEqual([]);
  });

  it('overflowing coordinates give an invisible polygon, never non-finite vertices', () => {
    const pts = [
      { x: -1.7e308, y: -1.7e308 },
      { x: 1.7e308, y: -1.7e308 },
      { x: 0, y: 1.7e308 },
    ];
    for (const p of clipPolygon(pts, R)) expect(Number.isFinite(p.x + p.y)).toBe(true);
  });
});
