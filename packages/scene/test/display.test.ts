import { describe, expect, it } from 'vitest';
import { layout, MARGIN_PX, MAX_ARC_RADIUS } from '../src/display';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };

function figure(): Doc {
  const t = new Doc().point('A', 0, 2).point('B', -2, 0).point('C', 2, 0);
  t.add('l', t.call('line', 'B', 'C'));
  t.add('w', t.call('circumcircle', 'A', 'B', 'C'));
  t.add('p', t.call('polygon', 'A', 'B', 'C'));
  return t;
}

describe('layout: scene → screen paths', () => {
  it('maps every primitive to screen paths in draw order', () => {
    const d = layout(figure().scene(), view);
    expect(d.problem).toBeNull();
    expect(d.items.map((i) => [i.name, i.paths.map((p) => p.kind)])).toEqual([
      ['p', ['poly', 'poly', 'poly']],
      ['w', ['arc']],
      ['l', ['poly']],
      ['A', ['dot']],
      ['B', ['dot']],
      ['C', ['dot']],
    ]);
    const a = d.items.find((i) => i.name === 'A')?.paths[0];
    expect(a).toEqual({ kind: 'dot', c: { x: 200, y: 50 }, r: 3.5 });
    const line = d.items.find((i) => i.name === 'l')?.paths[0];
    expect(line).toEqual({
      kind: 'poly',
      pts: [
        { x: -MARGIN_PX, y: 150 },
        { x: 400 + MARGIN_PX, y: 150 },
      ],
      closed: false,
    });
    expect(d.items[0]?.fill).toHaveLength(3);
  });

  it('off-surface items are left out; an invalid view gives an empty list with the reason', () => {
    const far = { ...view, viewport: { cx: 100, cy: 100, zoom: 50 } };
    expect(layout(figure().scene(), far).items).toEqual([]);
    const bad = layout(figure().scene(), { ...view, viewport: { cx: 0, cy: 0, zoom: 0 } });
    expect(bad.items).toEqual([]);
    expect(bad.problem).toMatch(/zoom/);
  });

  it('a huge circle becomes a polyline within the margin; screen coordinates stay bounded', () => {
    const t = new Doc().point('O', 0, -1e6).point('X', 0, 0);
    t.add('w', t.call('circle', 'O', 'X'));
    const d = layout(t.scene(), { ...view, viewport: { cx: 0, cy: 0, zoom: 1e3 } });
    const w = d.items.find((i) => i.name === 'w');
    expect(1e6 * 1e3).toBeGreaterThan(MAX_ARC_RADIUS);
    expect(w?.paths.every((p) => p.kind === 'poly')).toBe(true);
    for (const p of w?.paths ?? [])
      if (p.kind === 'poly')
        for (const q of p.pts) {
          expect(Math.abs(q.x - 200)).toBeLessThanOrEqual(200 + MARGIN_PX + 1e-6);
          expect(Math.abs(q.y - 150)).toBeLessThanOrEqual(150 + MARGIN_PX + 1e-6);
          expect(Math.abs(q.y - 150)).toBeLessThan(1); // the circle is flat here: y ≈ 0
        }
  });
});
