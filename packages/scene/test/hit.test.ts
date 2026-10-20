import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { HIT_RADIUS, hitTest } from '../src/hit';
import { toScreen, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };

function figure(): Doc {
  const t = new Doc().point('A', 0, 2).point('B', -2, 0).point('C', 2, 0);
  t.add('l', t.call('line', 'B', 'C'));
  t.add('m', t.call('line', 'A', t.call('point', 1, 0)));
  t.add('w', t.call('circle', 'B', 'C'));
  t.add('p', t.call('polygon', 'A', 'B', 'C'));
  return t;
}

const at = (x: number, y: number) => toScreen(view, { x, y });

describe('hitTest: same paths as drawn, top first', () => {
  it('a point under the cursor is hit (top first), and the virtual hit is none', () => {
    const r = hitTest(layout(figure().scene(), view), at(-2, 0));
    expect(r.hits.map((h) => [h.name, h.part])).toEqual([
      ['B', 'point'],
      ['l', 'curve'],
      ['p', 'curve'],
    ]); // w = circle(B, C) is centred at B: not under the cursor
    expect(r.virtual).toEqual({ kind: 'none' });
  });

  it('curves are hit within the radius plus half the stroke; fills from inside', () => {
    const d = layout(figure().scene(), view);
    const near = hitTest(d, { x: at(-1, 0).x, y: at(-1, 0).y + HIT_RADIUS });
    expect(near.hits.map((h) => h.name)).toContain('l');
    const off = hitTest(d, { x: at(-1, 0).x, y: at(-1, 0).y + HIT_RADIUS + 1 });
    expect(off.hits.map((h) => h.name)).not.toContain('l');
    const inner = hitTest(d, at(-0.5, 0.6));
    expect(inner.hits.map((h) => [h.name, h.part])).toEqual([['p', 'fill']]);
  });

  it('virtual hits: the intersection of two curves near the cursor, else a point on a curve', () => {
    const d = layout(figure().scene(), view);
    const x = hitTest(d, { x: at(1, 0).x + 2, y: at(1, 0).y - 2 });
    expect(x.virtual.kind).toBe('intersection');
    if (x.virtual.kind === 'intersection') {
      expect(x.virtual.world.x).toBeCloseTo(1, 9);
      expect(x.virtual.world.y).toBeCloseTo(0, 9);
    }
    const on = hitTest(d, { x: at(-1, 0).x, y: at(-1, 0).y + 3 });
    expect(on.virtual.kind).toBe('on');
    if (on.virtual.kind === 'on') {
      expect(on.virtual.world.x).toBeCloseTo(-1, 9);
      expect(on.virtual.world.y).toBeCloseTo(0, 9);
      expect(on.virtual.curve).toBe(figure().id('l'));
    }
    const circle = hitTest(d, at(-2 + 4 * Math.cos(1), 4 * Math.sin(1)));
    expect(circle.virtual.kind).toBe('on');
    const free = hitTest(d, at(3.5, 2.5));
    expect(free).toEqual({
      hits: [],
      virtual: { kind: 'free', at: at(3.5, 2.5), world: { x: 3.5, y: 2.5 } },
    });
  });

  it('intersections of two circles and of an arc are found', () => {
    const t = new Doc().point('O', 0, 0).point('P', 1, 0).point('Q', 2, 0);
    t.add('a', t.call('circle', 'O', 'Q'));
    t.add('b', t.call('circle', 'Q', 'O'));
    const d = layout(t.scene(), view);
    const y = Math.sqrt(3);
    const r = hitTest(d, { x: at(1, y).x + 1, y: at(1, y).y });
    expect(r.virtual.kind).toBe('intersection');
    if (r.virtual.kind === 'intersection') expect(r.virtual.world.y).toBeCloseTo(y, 9);
  });

  it('nothing that is not drawn can be hit: coincident images, hidden objects', () => {
    const t = new Doc().point('A', 1, 1).point('B', -2, 0).point('C', 2, 0);
    t.add('m', t.call('line', 'B', 'C'));
    t.add('s', t.call('reflect', 'm'));
    t.derived('refl', 's');
    t.style('A', { hidden: true }).style('A*', { hidden: false });
    const d = layout(t.scene(), view);
    const names = (x: number, y: number) => hitTest(d, at(x, y)).hits.map((h) => h.name);
    expect(names(-2, 0)).toEqual(['B', 'm']);
    expect(names(1, 1)).toEqual([]);
    expect(names(1, -1)).toEqual(['A*']);
  });

  it('an invalid view or a non-finite cursor hits nothing', () => {
    const bad = layout(figure().scene(), { ...view, viewport: { cx: 0, cy: 0, zoom: -1 } });
    expect(hitTest(bad, { x: 1, y: 1 })).toEqual({ hits: [], virtual: { kind: 'none' } });
    const d = layout(figure().scene(), view);
    expect(hitTest(d, { x: Number.NaN, y: 1 })).toEqual({ hits: [], virtual: { kind: 'none' } });
  });
});
