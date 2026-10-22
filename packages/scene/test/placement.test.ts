/**
 * W10 of the Run 10 audit, ADR-0023: a curve that exists but cannot be placed at the
 * current zoom is listed in the display list's `undrawable`, never silently missing and never
 * drawn as garbage. In doubles a point of a circle (c + r·(cos θ, sin θ)) or of a line
 * (p + t·u) is off by about ε·(|coordinates| + extent) world units; past half a pixel at the
 * view's zoom, a curve that may pass through the view is "not drawable at this zoom".
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { curvePlacement } from '../src/placement';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

const SIZE = { width: 400, height: 300 };
const at = (cx: number, cy: number, zoom: number): View => ({
  viewport: { cx, cy, zoom },
  size: SIZE,
});

/** A circle of radius R tangent to the x-axis at the origin, from above. */
function tangent(R: number) {
  const t = new Doc().point('O', 0, R).point('X', 0, 0);
  t.add('w', t.call('circle', 'O', 'X'));
  return t.scene();
}

describe('curves that cannot be placed at the zoom (ADR-0023)', () => {
  it('radius 10¹⁶ across a view 20 units wide: listed, not drawn', () => {
    const d = layout(tangent(1e16), at(0, 0, 20));
    expect(d.items.some((i) => i.name === 'w')).toBe(false);
    expect(d.items.some((i) => i.name === 'X')).toBe(true);
    expect(d.undrawable.map((u) => u.name)).toEqual(['w']);
  });

  it('radius 10¹⁸ (no span left at all before): listed', () => {
    expect(layout(tangent(1e18), at(0, 0, 20)).undrawable.map((u) => u.name)).toEqual(['w']);
  });

  it('radius 10¹²: placed within a pixel, drawn, not listed', () => {
    const d = layout(tangent(1e12), at(0, 0, 20));
    expect(d.items.some((i) => i.name === 'w')).toBe(true);
    expect(d.undrawable).toEqual([]);
  });

  it('the audit case at a deep zoom: center (10⁶, 0) through the origin, zoom 2⁴⁰', () => {
    const t = new Doc().point('O', 1e6, 0).point('X', 0, 0);
    t.add('w', t.call('circle', 'O', 'X'));
    const d = layout(t.scene(), at(0, 0, 2 ** 40));
    expect(d.undrawable.map((u) => u.name)).toEqual(['w']);
    // The same circle at zoom 2²⁰ is placed within a pixel and drawn.
    expect(layout(t.scene(), at(0, 0, 2 ** 20)).items.some((i) => i.name === 'w')).toBe(true);
  });

  it('a huge circle that passes far from the view is neither drawn nor listed', () => {
    // Radius 10¹⁶, passing 10⁶ below the view: outside, whatever the rounding.
    const t = new Doc().point('O', 0, 1e16 + 1e6).point('X', 0, 1e6);
    t.add('w', t.call('circle', 'O', 'X'));
    const d = layout(t.scene(), at(0, 0, 20));
    expect(d.items.some((i) => i.name === 'w')).toBe(false);
    expect(d.undrawable).toEqual([]);
  });

  it('a line whose defining point is 10¹⁷ away, through the view: listed', () => {
    const t = new Doc().point('P', -1e17, 0.5).point('Q', 1e17, 0.5);
    t.add('l', t.call('line', 'P', 'Q'));
    const d = layout(t.scene(), at(0, 0, 20));
    expect(d.undrawable.map((u) => u.name)).toEqual(['l']);
    expect(d.items.some((i) => i.name === 'l')).toBe(false);
  });

  it('ordinary figures at ordinary zooms: nothing listed', () => {
    const t = new Doc().point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
    t.add('c', t.call('circle', 'A', 'B', 'C'));
    t.add('l', t.call('line', 'A', 'B'));
    for (const z of [2 ** -20, 1, 50, 2 ** 30])
      expect(layout(t.scene(), at(1, 1, z)).undrawable).toEqual([]);
  });
});

describe('curvePlacement', () => {
  const rect = { minX: -10, maxX: 10, minY: -10, maxY: 10 };
  it('degenerate cases: a curve outside the view is "outside"; a placeable one "ok"', () => {
    expect(curvePlacement({ kind: 'circle', c: { x: 0, y: 0 }, r: 5, arc: null }, rect, 20)).toBe(
      'ok',
    );
    expect(
      curvePlacement({ kind: 'circle', c: { x: 0, y: 1e16 + 1e3 }, r: 1e16, arc: null }, rect, 20),
    ).toBe('outside');
    expect(
      curvePlacement({ kind: 'circle', c: { x: 0, y: 1e16 }, r: 1e16, arc: null }, rect, 20),
    ).toBe('unplaceable');
    const far = {
      kind: 'line',
      p: { x: -1e17, y: 0 },
      u: { x: 1, y: 0 },
      lo: null,
      hi: null,
    } as const;
    expect(curvePlacement(far, rect, 20)).toBe('unplaceable');
    expect(curvePlacement({ ...far, p: { x: -1e17, y: 1e6 } }, rect, 20)).toBe('outside');
    expect(curvePlacement({ ...far, p: { x: 0, y: 0 } }, rect, 20)).toBe('ok');
  });
});
