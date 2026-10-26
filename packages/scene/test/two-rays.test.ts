/**
 * The two rays `outside` (ADR-0032 decision 8) in the scene: drawn as two clipped pieces (and
 * hit exactly there, L8), never across the gap; placed by the nearer end; a pair of rays and
 * the segment between its ends never coincide; images of an inversion's own circle and of
 * points on it coincide with their sources (SPEC §13), while the center's image is listed as
 * unavailable with its reason. Fixture: R, the image of segment((−1, 0), (2, 0)) under
 * inversion((0, 0), 4): the rays x ≤ −4 and x ≥ 2 of the x-axis.
 */
import { describe, expect, it } from 'vitest';
import { coincides } from '../src/coincide';
import { layout } from '../src/display';
import { hitTest } from '../src/hit';
import { curvePlacement } from '../src/placement';
import { toScreen, type View } from '../src/viewport';
import { Doc, valuesOf } from './helpers/docs';

const VIEW: View = { viewport: { cx: 0, cy: 0, zoom: 20 }, size: { width: 400, height: 300 } };

function rays(): Doc {
  const t = new Doc().point('O', 0, 0).point('D', -1, 0).point('E', 2, 0);
  t.add('R', t.call('apply', t.call('inversion', 'O', 4), t.call('segment', 'D', 'E')));
  return t;
}

describe('two rays in the scene (ADR-0032)', () => {
  it('are drawn as two pieces, hit on the rays and not in the gap', () => {
    const d = layout(rays().scene(), VIEW);
    const item = d.items.find((i) => i.name === 'R');
    expect(item?.paths.length).toBe(2);
    const hit = (x: number) =>
      hitTest(d, toScreen(VIEW, { x, y: 0 })).hits.some((h) => h.id === item?.id);
    expect([-6, -4.2, 2.2, 6].map(hit)).toEqual([true, true, true, true]);
    expect([-3, 0.5, 1.5].map(hit)).toEqual([false, false, false]);
  });

  it('are placed by the nearer end, not across the gap', () => {
    const shape = {
      kind: 'line' as const,
      p: { x: 0, y: 0 },
      u: { x: 1, y: 0 },
      lo: -4,
      hi: 2,
      outside: true as const,
    };
    const rect = { minX: -1.5, maxX: 1.5, minY: -1, maxY: 1 };
    expect(curvePlacement(shape, rect, 20)).toBe('outside');
    const segment = { kind: 'line' as const, p: shape.p, u: shape.u, lo: -4, hi: 2 };
    expect(curvePlacement(segment, rect, 20)).toBe('ok');
  });

  it('never coincide with the segment between their ends', () => {
    const t = rays();
    t.add(
      'S',
      t.call(
        'apply',
        t.call('homothety', 'O', 1),
        t.call('segment', t.call('point', -4, 0), t.call('point', 2, 0)),
      ),
    );
    const v = valuesOf(t.doc);
    const [R, S] = [v.get(t.id('R')), v.get(t.id('S'))];
    if (R === undefined || S === undefined) throw new Error('values');
    const ctx = { scale: 8 };
    expect(coincides(R, R, ctx)).toBe(true);
    expect(coincides(R, S, ctx)).toBe(false);
    expect(coincides(S, R, ctx)).toBe(false);
  });

  it('an inversion layer: the circle and its points are hidden as coincident, the center is unavailable', () => {
    const t = new Doc().point('O', 0, 0).point('A', 2, 0).point('B', 1, 1);
    t.add('w', t.call('circle', 'O', 'A'));
    t.add('f', t.call('inversion', 'w'));
    t.derived('inv', 'f');
    const scene = t.scene();
    const name = (id: number) => t.doc.objects.find((o) => o.id === id)?.name;
    const coincident = scene.coincident.map(name).sort();
    expect(coincident).toEqual(['A*', 'w*']);
    expect(scene.unavailable.map((u) => [u.name, u.reason])).toEqual([
      ['O*', 'apply: the point is the center of inversion: its image is at infinity'],
    ]);
    expect(scene.primitives.some((p) => p.name === 'B*')).toBe(true);
  });
});
