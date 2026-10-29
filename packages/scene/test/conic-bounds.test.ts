/**
 * Run 16c audit: "fit to the figure" with a hyperbola. Its bounds took the hyperbola's centre,
 * which is not on the curve: the near-parabolic hyperbola through (0, 0), (±1, 1), (2, 4),
 * (−2, 3.999) has its centre near (0, −6000), so the default view of a figure 4 units wide was
 * centred 6000 units away. A hyperbola now counts its vertex nearest the rest of the figure, both
 * vertices when it is alone.
 */
import { describe, expect, it } from 'vitest';
import { sceneBounds } from '../src/bounds';
import { Doc } from './helpers/docs';

function conicDoc(pts: readonly (readonly [number, number])[]): Doc {
  const t = new Doc();
  pts.forEach(([x, y], i) => t.point('ABCDE'[i] ?? 'Z', x, y));
  t.add('k', t.call('conic', 'A', 'B', 'C', 'D', 'E'));
  return t;
}

describe('the bounds of a hyperbola', () => {
  it('a near-parabolic hyperbola: the bounds are its points and its near vertex', () => {
    const t = conicDoc([
      [0, 0],
      [1, 1],
      [-1, 1],
      [2, 4],
      [-2, 3.999],
    ]);
    const r = sceneBounds(t.scene());
    expect(r).not.toBeNull();
    if (r === null) return;
    expect([r.minX, r.maxX, r.maxY]).toEqual([-2, 2, 4]);
    expect(r.minY).toBeGreaterThan(-0.1);
  });

  it('a hyperbola alone: both vertices', () => {
    const t = conicDoc([
      [1, 1],
      [2, 0.5],
      [-1, -1],
      [4, 0.25],
      [0.5, 2],
    ]);
    for (const n of ['A', 'B', 'C', 'D', 'E']) t.style(n, { hidden: true });
    const r = sceneBounds(t.scene());
    expect(
      r === null ? r : [r.minX, r.maxX, r.minY, r.maxY].map((x) => Math.round(x * 1e9) / 1e9),
    ).toEqual([-1, 1, -1, 1]);
  });
});
