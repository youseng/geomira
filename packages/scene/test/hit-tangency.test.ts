/**
 * Virtual hits at a tangency (ADR-0028): two drawn curves that touch meet in a double point,
 * which screen floats put a hair inside or outside. A click there must offer the
 * intersection every time, not a glider on one of the curves about half the time.
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { hitTest } from '../src/hit';
import { intersections, TOUCH_PX, type Piece } from '../src/hit-geom';
import { toScreen, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

const seg = (id: number, ax: number, ay: number, bx: number, by: number): Piece => ({
  id,
  kind: 'seg',
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
});
const arc = (id: number, cx: number, cy: number, r: number): Piece => ({
  id,
  kind: 'arc',
  c: { x: cx, y: cy },
  r,
  from: 0,
  to: 2 * Math.PI,
});

describe('intersections: a near-tangency within TOUCH_PX is the double point', () => {
  it('a segment touching a circle, from either side of the float noise', () => {
    for (const r of [50 * (1 - 1e-12), 50, 50 * (1 + 1e-12), 50 - TOUCH_PX / 2]) {
      const x = intersections([seg(1, 0, 100, 200, 100)], [arc(2, 100, 50, r)]);
      expect(x.length).toBeGreaterThan(0);
      for (const p of x) expect(Math.hypot(p.p.x - 100, p.p.y - 100)).toBeLessThanOrEqual(TOUCH_PX);
    }
    // A clear gap is not a touch.
    expect(intersections([seg(1, 0, 100, 200, 100)], [arc(2, 100, 50, 50 - 3)])).toEqual([]);
  });

  it('two circles touching outside and inside, from either side of the float noise', () => {
    for (const e of [-1e-10, 0, 1e-10, TOUCH_PX / 2]) {
      const out = intersections([arc(1, 0, 0, 30)], [arc(2, 50 + e, 0, 20)]);
      expect(out.length).toBeGreaterThan(0);
      for (const p of out) expect(Math.hypot(p.p.x - 30, p.p.y)).toBeLessThanOrEqual(TOUCH_PX);
      const inside = intersections([arc(1, 0, 0, 30)], [arc(2, 10 - e, 0, 20)]);
      expect(inside.length).toBeGreaterThan(0);
      for (const p of inside) expect(Math.hypot(p.p.x - 30, p.p.y)).toBeLessThanOrEqual(TOUCH_PX);
    }
    expect(intersections([arc(1, 0, 0, 30)], [arc(2, 53, 0, 20)])).toEqual([]);
    expect(intersections([arc(1, 0, 0, 30)], [arc(2, 7, 0, 20)])).toEqual([]);
  });

  it('the touch point lies on both arcs only if it is on both spans', () => {
    const half: Piece = { id: 2, kind: 'arc', c: { x: 50, y: 0 }, r: 20, from: 0, to: 1 };
    expect(intersections([arc(1, 0, 0, 30)], [half])).toEqual([]);
  });
});

const view: View = { viewport: { cx: 1.5, cy: 1.5, zoom: 60 }, size: { width: 800, height: 600 } };

describe('hitTest at the touch point of an incircle with a side', () => {
  it('is the intersection of the side and the incircle, for 60 triangles', () => {
    const kinds: string[] = [];
    for (let k = 0; k < 60; k++) {
      const [ax, ay, cx] = [-1 + (k % 6) * 0.37, 3 + (k % 5) * 0.21, 4 + (k % 7) * 0.13];
      const t = new Doc().point('A', ax, ay).point('B', 0, 0).point('C', cx, 0);
      t.add('a', t.call('segment', 'B', 'C'));
      t.add('i', t.call('incircle', 'A', 'B', 'C'));
      const i = t.values().get(t.id('i'));
      if (i?.kind !== 'circle') throw new Error('no incircle');
      const hit = hitTest(layout(t.scene(), view), toScreen(view, { x: i.c.x, y: 0 }));
      kinds.push(hit.virtual.kind);
      if (hit.virtual.kind === 'intersection') {
        expect([hit.virtual.a, hit.virtual.b].sort()).toEqual([t.id('a'), t.id('i')].sort());
        expect(hit.virtual.world.x).toBeCloseTo(i.c.x, 6);
        expect(Math.abs(hit.virtual.world.y)).toBeLessThan(TOUCH_PX / view.viewport.zoom);
      }
    }
    expect(kinds.filter((k) => k !== 'intersection')).toEqual([]);
  });

  it('two circles drawn tangent to each other meet at the touch point', () => {
    const kinds: string[] = [];
    for (let k = 0; k < 40; k++) {
      const r = 1 + k * 0.0731;
      const t = new Doc().point('O', 0, 0).point('P', 2 + r, 0);
      t.add('c', t.call('circle', 'O', 2));
      t.add('d', t.call('circle', 'P', r));
      const hit = hitTest(layout(t.scene(), view), toScreen(view, { x: 2, y: 0 }));
      kinds.push(hit.virtual.kind);
    }
    expect(kinds.filter((k) => k !== 'intersection')).toEqual([]);
  });
});
