/**
 * A polygon's edges go through the same placement check as lines (ADR-0023, extended by
 * ADR-0028): an edge a + t·(b − a) whose points near the view are off by more than
 * PLACEMENT_PX makes the polygon "not drawable at this zoom", listed and not drawn, never a
 * zero-length or misplaced edge.
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view = (zoom: number): View => ({
  viewport: { cx: 0, cy: 0, zoom },
  size: { width: 640, height: 480 },
});

function huge() {
  const t = new Doc().point('A', -1e17, 3).point('B', 1e17, -3).point('C', 0, 1e17);
  t.add('t', t.call('polygon', 'A', 'B', 'C'));
  t.add('s', t.call('segment', 'A', 'B'));
  t.point('O', 0, 0);
  return t;
}

describe('polygon edges that cannot be placed at the zoom', () => {
  it('an edge 10¹⁷ long across the view: the polygon is listed, not drawn', () => {
    const d = layout(huge().scene(), view(50));
    expect(d.items.map((i) => i.name)).toEqual(['O']);
    expect(d.undrawable.map((u) => u.name)).toEqual(['t', 's']);
  });

  it('a polygon whose far edges pass outside the view is drawn as before', () => {
    const t = new Doc().point('A', -1e6, -1).point('B', 1e6, -1).point('C', 0, 1e6);
    t.add('t', t.call('polygon', 'A', 'B', 'C'));
    const d = layout(t.scene(), view(50));
    expect(d.items.map((i) => i.name)).toContain('t');
    expect(d.undrawable).toEqual([]);
  });

  it('an ordinary polygon at zooms from 2⁻²⁰ to 2³⁰ is never listed', () => {
    const t = new Doc().point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
    t.add('t', t.call('polygon', 'A', 'B', 'C'));
    for (let e = -20; e <= 30; e += 5)
      expect(layout(t.scene(), view(2 ** e)).undrawable).toEqual([]);
  });
});
