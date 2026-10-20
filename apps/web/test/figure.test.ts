import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { loadFigure, movePoint, setLayerVisible, viewportFor } from '../src/figure';
import { stressText } from '../src/stress';
import { registry } from './helpers';

describe('the development page model', () => {
  it('lists the eight examples and the 300-object figure; every one parses cleanly', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual([
      'euler-line',
      'feuerbach',
      'incenter-excenter',
      'miquel',
      'nine-point-circle',
      'radical-axes',
      'reflection-layer',
      'simson',
      'stress-300',
    ]);
    for (const e of EXAMPLES) expect(loadFigure(e.text, registry).diagnostics, e.id).toEqual([]);
  });

  it('stressText(n) has exactly n objects, all defined', () => {
    for (const n of [10, 300]) {
      const f = loadFigure(stressText(n), registry);
      expect(f.doc.objects).toHaveLength(n);
      expect(f.scene.unavailable).toEqual([]);
    }
  });

  it('a layer toggle is a document edit; the image-only view draws the fixed points', () => {
    const f = loadFigure(EXAMPLES.find((e) => e.id === 'reflection-layer')?.text ?? '', registry);
    expect(f.scene.coincident.length).toBe(2);
    const imagesOnly = setLayerVisible(f, registry, 'main', false);
    expect(imagesOnly.doc.layers[0]?.visible).toBe(false);
    expect(imagesOnly.scene.coincident).toEqual([]);
    expect(imagesOnly.scene.primitives.map((p) => p.name)).toContain('B*');
    expect(setLayerVisible(f, registry, 'nope', false)).toBe(f);
  });

  it('moving a free point re-evaluates (one drag frame); other objects are refused', () => {
    const f = loadFigure(EXAMPLES[0]?.text ?? '', registry);
    const A = f.doc.objects.find((o) => o.name === 'A');
    const G = f.doc.objects.find((o) => o.name === 'G');
    if (A === undefined || G === undefined) throw new Error('missing objects');
    const moved = movePoint(f, registry, A.id, 2, 5);
    expect(moved.evaluation.values.get(A.id)).toEqual({ kind: 'point', x: 2, y: 5 });
    expect(movePoint(f, registry, G.id, 0, 0)).toBe(f);
    expect(movePoint(f, registry, A.id, Infinity, 0)).toBe(f);
  });

  it('the viewport is the document’s when it has one, else fitted', () => {
    const size = { width: 400, height: 300 };
    const f = loadFigure('@version 1\n@viewport 1 2 30\nA = (0, 0)\n', registry);
    expect(viewportFor(f, size)).toEqual({ cx: 1, cy: 2, zoom: 30 });
    const g = loadFigure('@version 1\nA = (0, 0)\nB = (4, 2)\n', registry);
    expect(viewportFor(g, size)).toEqual({ cx: 2, cy: 1, zoom: 80 });
  });
});
