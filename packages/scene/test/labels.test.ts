import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import type { PlacedLabel } from '../src/labels';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };

function labels(t: Doc, v: View = view): Record<string, PlacedLabel> {
  const d = layout(t.scene(), v);
  const names = new Map(d.items.map((i) => [i.id, i.name]));
  return Object.fromEntries(d.labels.map((l) => [names.get(l.id) ?? '?', l]));
}

describe('label placement: anchors and offsets (angle, pixels)', () => {
  it('a lone point: 45°, 9 px, aligned away from the anchor', () => {
    const l = labels(new Doc().point('A', 0, 0)).A;
    expect(l?.anchor).toEqual({ x: 200, y: 150 });
    expect(l?.angle).toBe(45);
    expect(l?.at.x).toBeCloseTo(200 + 9 * Math.SQRT1_2, 12);
    expect(l?.at.y).toBeCloseTo(150 - 9 * Math.SQRT1_2, 12);
    expect([l?.align, l?.baseline]).toEqual(['left', 'bottom']);
  });

  it('an explicit offset is used as given (y up on screen means smaller y)', () => {
    const t = new Doc().point('A', 0, 0, { style: { labelAngle: 270, labelDist: 20 } });
    const l = labels(t).A;
    expect(l?.at.x).toBeCloseTo(200, 12);
    expect(l?.at.y).toBeCloseTo(170, 12);
    expect([l?.align, l?.baseline]).toEqual(['center', 'top']);
    const r = labels(new Doc().point('A', 0, 0, { style: { labelAngle: 180 } })).A;
    expect([r?.align, r?.baseline]).toEqual(['right', 'middle']);
  });

  it('automatic placement avoids the lines through the point', () => {
    const t = new Doc().point('A', 0, 0).point('B', 2, 2).point('C', -2, 2);
    t.add('l', t.call('line', 'A', 'B')); // 45° and 225° through A
    expect(labels(t).A?.angle).toBe(135);
    t.add('m', t.call('line', 'A', 'C')); // 135° and 315° too
    expect([0, 90, 180, 270]).toContain(labels(t).A?.angle);
    const u = new Doc().point('A', 0, 0).point('B', 2, 0);
    u.add('s', u.call('segment', 'A', 'B')); // only 0° leaves A
    expect(labels(u).A?.angle).toBe(45);
    expect(labels(u).B?.angle).toBe(45);
  });

  it('curves: lines at the middle of their visible part, circles at 45°, polygons at the centroid', () => {
    const t = new Doc().point('A', 0, 2).point('B', -2, 0).point('C', 2, 0);
    t.add('l', t.call('line', 'B', 'C'), { style: { label: 'ℓ' } });
    t.add('w', t.call('circle', 'B', 'C'), { style: { label: '\\omega' } });
    t.add('p', t.call('polygon', 'A', 'B', 'C'), { style: { label: 'T' } });
    const ls = labels(t);
    expect(ls.l?.anchor).toEqual({ x: 200, y: 150 });
    expect(ls.w?.runs).toEqual([{ text: 'ω', pos: 'base' }]);
    expect(ls.w?.anchor.x).toBeCloseTo(100 + 200 * Math.SQRT1_2, 9);
    expect(ls.w?.anchor.y).toBeCloseTo(150 - 200 * Math.SQRT1_2, 9);
    expect(ls.p?.anchor.x).toBeCloseTo(200, 9);
    expect(ls.p?.anchor.y).toBeCloseTo(150 - 100 / 3, 9);
  });

  it('a label whose anchor is off the surface is not placed', () => {
    const t = new Doc().point('A', 0, 0).point('B', 4.5, 0);
    const ls = labels(t);
    expect(Object.keys(ls)).toEqual(['A']); // B is inside the margin but off the surface
  });
});
