/** ADR-0029: an object's own opacity multiplies its drawing layer's opacity. */
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { drawStyle } from '../src/style';
import { Doc } from './helpers/docs';

describe('drawStyle: the style opacity times the layer opacity (ADR-0029)', () => {
  it('absent = 1: the layer opacity alone (unchanged drawing)', () => {
    expect(drawStyle({}, 'point', 0.8).opacity).toBe(0.8);
    expect(drawStyle({}, 'line', 1).opacity).toBe(1);
  });

  it('multiplies, for every kind', () => {
    expect(drawStyle({ opacity: 0.5 }, 'point', 0.8).opacity).toBe(0.4);
    expect(drawStyle({ opacity: 0.5 }, 'circle', 1).opacity).toBe(0.5);
    expect(drawStyle({ opacity: 0 }, 'polygon', 1).opacity).toBe(0);
    expect(drawStyle({ opacity: 1 }, 'text', 0.3).opacity).toBe(0.3);
  });

  it('degenerate: a non-finite opacity counts as 1; one outside [0, 1] is clamped', () => {
    expect(drawStyle({ opacity: Number.NaN }, 'point', 0.5).opacity).toBe(0.5);
    expect(drawStyle({ opacity: Number.POSITIVE_INFINITY }, 'point', 0.5).opacity).toBe(0.5);
    expect(drawStyle({ opacity: -3 }, 'point', 0.5).opacity).toBe(0);
    expect(drawStyle({ opacity: 7 }, 'point', 0.5).opacity).toBe(0.5);
    expect(drawStyle({ opacity: 0.5 }, 'point', Number.NaN).opacity).toBe(0.5);
  });
});

describe('the scene and its display list carry it (ADR-0029)', () => {
  it('primitives, display items and labels take the product; images inherit it', () => {
    const t = new Doc().layer('faint', { opacity: 0.5 });
    t.point('A', 0, 0, { style: { opacity: 0.5 }, layers: ['faint'] });
    t.point('B', 2, 0, { style: { opacity: 0.25 } });
    t.point('C', 0, 2);
    t.add('l', t.call('line', 'B', 'C'), { style: { opacity: 0.75, label: 'l' } });
    t.add('s', t.call('reflect', t.call('line', 'A', 'B')));
    t.derived('r', 's');
    const scene = t.scene();
    const of = (n: string) => scene.primitives.find((p) => p.name === n)?.style.opacity;
    expect(of('A')).toBe(0.25);
    expect(of('B')).toBe(0.25);
    expect(of('C')).toBe(1);
    expect(of('l')).toBe(0.75);
    // B* in the derived layer r (opacity 1) inherits B's own opacity.
    expect(of('B*')).toBeUndefined();
    expect(of('C*')).toBe(1);
    expect(of('l*')).toBe(0.75);
    const display = layout(scene, {
      viewport: { cx: 1, cy: 1, zoom: 50 },
      size: { width: 400, height: 400 },
    });
    expect(display.items.find((i) => i.name === 'l')?.style.opacity).toBe(0.75);
    expect(display.labels.find((x) => x.text === 'l')?.opacity).toBe(0.75);
    expect(display.labels.find((x) => x.text === 'B')?.opacity).toBe(0.25);
  });
});
