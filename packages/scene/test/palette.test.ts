import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { hitTest } from '../src/hit';
import { NAMED_COLOURS, paletteColour } from '../src/palette';
import { toScreen, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

/** ADR-0016 decision 20: named colours from Geomdraw's palette; polygons are outlines. */

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };
const at = (x: number, y: number) => toScreen(view, { x, y });

function triangle(polygonColor?: string): Doc {
  const t = new Doc()
    .point('A', 0, 2)
    .point('B', -2, 0)
    .point('C', 2, 0, { style: { color: 'Blue' } });
  const style = polygonColor === undefined ? {} : { color: polygonColor };
  t.add('p', t.call('polygon', 'A', 'B', 'C'), { style });
  return t;
}

describe('named colours', () => {
  it("maps Geomdraw's names, ignoring case and spaces", () => {
    expect(paletteColour('blue')).toBe('#1f6fd1');
    expect(paletteColour('red')).toBe('#b3261e');
    expect(paletteColour(' RED ')).toBe('#b3261e');
    expect(paletteColour('grey')).toBe(paletteColour('gray'));
    for (const name of ['black', 'green', 'orange', 'purple', 'brown', 'teal'])
      expect(paletteColour(name)).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('leaves everything else exactly as written', () => {
    for (const c of ['#FF0000', '#f00', 'rgba(255, 0, 0, 0.5)', 'navy', 'notacolour', ''])
      expect(paletteColour(c)).toBe(c);
    expect(paletteColour(null)).toBeNull();
    expect(paletteColour('constructor')).toBe('constructor');
    expect(paletteColour('toString')).toBe('toString');
  });

  it('every palette value is a six-digit hex colour', () => {
    for (const v of Object.values(NAMED_COLOURS)) expect(v).toMatch(/^#[0-9a-f]{6}$/u);
  });

  it('the display list carries the hex, for items and labels; the scene keeps the name', () => {
    const t = triangle('red');
    const scene = t.scene();
    expect(scene.primitives.find((p) => p.name === 'C')?.style.color).toBe('Blue');
    const d = layout(scene, view);
    expect(d.items.find((i) => i.name === 'C')?.style.color).toBe('#1f6fd1');
    expect(d.items.find((i) => i.name === 'p')?.style.color).toBe('#b3261e');
    const c = d.items.find((i) => i.name === 'C')?.id;
    expect(d.labels.find((l) => l.id === c)?.color).toBe('#1f6fd1');
    expect(d.items.find((i) => i.name === 'A')?.style.color).toBeNull();
  });
});

describe('polygons are outlines unless coloured', () => {
  it('an uncoloured polygon has no fill and is not hit from inside; its label region stays', () => {
    const d = layout(triangle().scene(), view);
    const p = d.items.find((i) => i.name === 'p');
    expect(p?.fill).toBeNull();
    expect(p?.region).toHaveLength(3);
    expect(hitTest(d, at(0, 0.6)).hits).toEqual([]);
  });

  it('a coloured polygon keeps its fill, drawn and hit', () => {
    const d = layout(triangle('green').scene(), view);
    const p = d.items.find((i) => i.name === 'p');
    expect(p?.fill).toEqual(p?.region);
    expect(p?.fill).toHaveLength(3);
    expect(hitTest(d, at(0, 0.6)).hits.map((h) => [h.name, h.part])).toEqual([['p', 'fill']]);
  });

  it('the label of a polygon is at the centroid of its region either way', () => {
    const anchor = (style: { color?: string }) => {
      const t = new Doc().point('A', 0, 2).point('B', -2, 0).point('C', 2, 0);
      t.add('p', t.call('polygon', 'A', 'B', 'C'), { style: { ...style, label: 'T' } });
      const d = layout(t.scene(), view);
      const id = d.items.find((i) => i.name === 'p')?.id;
      return d.labels.find((l) => l.id === id)?.anchor;
    };
    const centroid = at(0, 2 / 3);
    expect(anchor({})?.x).toBeCloseTo(centroid.x, 9);
    expect(anchor({})?.y).toBeCloseTo(centroid.y, 9);
    expect(anchor({ color: 'red' })).toEqual(anchor({}));
  });
});
