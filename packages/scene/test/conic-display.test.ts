/**
 * Drawing a conic (ADR-0042): the visible part as polylines, one per branch, clipped to the
 * surface and its margin (L9), every chord within CONIC_SAGITTA px of the curve; a hyperbola's
 * branches are separate paths; a closed ellipse is one closed path; what is drawn is what is hit
 * (L8) and labelled; a conic too far from the origin for the zoom is listed as not drawable.
 */
import { createRng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { CONIC_SAGITTA, conicPlacement, conicSpans } from '../src/conic-paths';
import { layout, MARGIN_PX } from '../src/display';
import { hitTest } from '../src/hit';
import { placeLabels } from '../src/labels';
import type { DisplayItem } from '../src/types';
import { toWorld, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };

type XY = readonly [number, number];

/** k = conic through five points (labelled `label` when given). */
function conicDoc(pts: readonly XY[], label?: string): Doc {
  const t = new Doc();
  const names = ['A', 'B', 'C', 'D', 'E'];
  pts.forEach(([x, y], i) => t.point(names[i] ?? 'Z', x, y));
  t.add('k', t.call('conic', ...names), label === undefined ? {} : { style: { label } });
  return t;
}

const ELLIPSE: readonly XY[] = [
  [2, 0],
  [0, 1],
  [-2, 0],
  [0, -1],
  [1.2, 0.8],
];
const HYPERBOLA: readonly XY[] = [
  [1, 1],
  [2, 0.5],
  [-1, -1],
  [4, 0.25],
  [0.5, 2],
];
const PARABOLA: readonly XY[] = [
  [0, 0],
  [1, 1],
  [-1, 1],
  [2, 4],
  [-2, 4],
];

function item(t: Doc, v: View = view): DisplayItem {
  const k = layout(t.scene(), v).items.find((i) => i.name === 'k');
  if (k === undefined) throw new Error('k is not drawn');
  return k;
}

/** The world distance from q to the conic Q = 0 (first order: |Q|/|∇Q|). */
function gap(Q: (x: number, y: number) => number, x: number, y: number): number {
  const h = 1e-6;
  const g = Math.hypot(
    (Q(x + h, y) - Q(x - h, y)) / (2 * h),
    (Q(x, y + h) - Q(x, y - h)) / (2 * h),
  );
  return Math.abs(Q(x, y)) / g;
}

/** Every vertex on the curve, every chord within the sagitta (both in px). */
function expectOnCurve(k: DisplayItem, Q: (x: number, y: number) => number, v: View = view) {
  const zoom = v.viewport.zoom;
  for (const p of k.paths) {
    if (p.kind !== 'poly') throw new Error(p.kind);
    p.pts.forEach((s, i) => {
      const w = toWorld(v, s);
      expect(gap(Q, w.x, w.y) * zoom).toBeLessThan(1e-6);
      const n = p.pts[i + 1];
      if (n === undefined) return;
      const m = toWorld(v, { x: (s.x + n.x) / 2, y: (s.y + n.y) / 2 });
      expect(gap(Q, m.x, m.y) * zoom).toBeLessThan(CONIC_SAGITTA * 1.01);
    });
  }
}

describe('a conic on the canvas', () => {
  it('an ellipse inside the surface: one closed polyline on the curve', () => {
    const k = item(conicDoc(ELLIPSE));
    expect(k.paths).toHaveLength(1);
    expect(k.paths[0]?.kind === 'poly' && k.paths[0].closed).toBe(true);
    expectOnCurve(k, (x, y) => (x * x) / 4 + y * y - 1);
  });

  it('a hyperbola: one polyline per branch, clipped to the surface and its margin (L9)', () => {
    const k = item(conicDoc(HYPERBOLA));
    expect(k.paths).toHaveLength(2);
    for (const p of k.paths) {
      if (p.kind !== 'poly') throw new Error(p.kind);
      expect(p.closed).toBe(false);
      for (const s of p.pts) {
        expect(s.x).toBeGreaterThanOrEqual(-MARGIN_PX - 1e-6);
        expect(s.x).toBeLessThanOrEqual(400 + MARGIN_PX + 1e-6);
        expect(s.y).toBeGreaterThanOrEqual(-MARGIN_PX - 1e-6);
        expect(s.y).toBeLessThanOrEqual(300 + MARGIN_PX + 1e-6);
      }
    }
    // The branches lie in the first and the third quadrant.
    const [b0, b1] = k.paths.map((p) =>
      p.kind === 'poly' ? toWorld(view, p.pts[0] ?? { x: 0, y: 0 }) : { x: 0, y: 0 },
    );
    expect(Math.sign(b0?.x ?? 0) * Math.sign(b1?.x ?? 0)).toBe(-1);
    expectOnCurve(k, (x, y) => x * y - 1);
  });

  it('a parabola: one open polyline', () => {
    const k = item(conicDoc(PARABOLA));
    expect(k.paths).toHaveLength(1);
    expectOnCurve(k, (x, y) => x * x - y);
  });

  it('what is drawn is hit and labelled', () => {
    const t = conicDoc(HYPERBOLA, 'H');
    const d = layout(t.scene(), view);
    const k = d.items.find((i) => i.name === 'k');
    const p = k?.paths[0];
    if (p?.kind !== 'poly') throw new Error('no path');
    const q = p.pts[Math.floor(p.pts.length / 3)] ?? { x: 0, y: 0 };
    expect(hitTest(d, { x: q.x + 1, y: q.y }).hits.map((h) => h.id)).toContain(t.id('k'));
    const label = placeLabels(t.scene(), d.items, view).find((l) => l.id === t.id('k'));
    expect(label?.runs).toEqual([{ text: 'H', pos: 'base' }]);
  });

  it('nothing of the conic in view: no item; too large to place at the zoom: not drawable', () => {
    const far = { ...view, viewport: { cx: 100, cy: 100, zoom: 50 } };
    expect(layout(conicDoc(ELLIPSE).scene(), far).items.some((i) => i.name === 'k')).toBe(false);
    // The vertex (2·10⁸, 0) moved to the origin: its points round to about 3·10⁻⁷, 3 px at 10⁷.
    const huge = { ...view, viewport: { cx: 0, cy: 0, zoom: 1e7 } };
    const t = conicDoc(ELLIPSE.map(([x, y]) => [(x - 2) * 1e8, y * 1e8] as const));
    const d = layout(t.scene(), huge);
    expect(d.problem).toBeNull();
    expect(d.items.some((i) => i.name === 'k')).toBe(false);
    expect(d.undrawable.map((u) => u.id)).toContain(t.id('k'));
  });

  it('random conics and views: every coordinate finite, within the margin (L9)', () => {
    const rng = createRng(16);
    for (let i = 0; i < 40; i++) {
      const pts = Array.from(
        { length: 5 },
        () => [rng.uniform(-5, 5), rng.uniform(-5, 5)] as const,
      );
      const t = conicDoc(pts);
      const v: View = {
        viewport: { cx: rng.uniform(-3, 3), cy: rng.uniform(-3, 3), zoom: 10 ** rng.uniform(0, 4) },
        size: { width: 400, height: 300 },
      };
      for (const it2 of layout(t.scene(), v).items)
        for (const p of it2.paths)
          if (p.kind === 'poly')
            for (const s of p.pts) {
              expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
              expect(Math.abs(s.x - 200)).toBeLessThanOrEqual(200 + MARGIN_PX + 1e-6);
              expect(Math.abs(s.y - 150)).toBeLessThanOrEqual(150 + MARGIN_PX + 1e-6);
            }
    }
  });
});

describe('placement of a conic whose crossings rounding may hide', () => {
  const s = {
    kind: 'conic',
    type: 'ellipse',
    c: { x: -1e8, y: 0 },
    u: { x: 1, y: 0 },
    a: 1e8,
    b: 5e7,
  } as const;
  const box = (x: number, y: number, h: number) => ({
    minX: x - h,
    maxX: x + h,
    minY: y - h,
    maxY: y + h,
  });

  it('no interval found near the curve at a zoom beyond its precision: not drawable', () => {
    const r = box(0, 0, 1e-9);
    expect(conicSpans(s, r)).toEqual([]);
    expect(conicPlacement(s, r, 1e9)).toBe('unplaceable');
  });

  it('far from the curve, or at a zoom within its precision: outside', () => {
    expect(conicPlacement(s, box(1, 0, 1e-9), 1e9)).toBe('outside');
    expect(conicPlacement(s, box(0, 0, 1e-9), 1e3)).toBe('outside');
  });
});
