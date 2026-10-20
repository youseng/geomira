import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/build';
import { Doc, drawn, valuesOf } from './helpers/docs';

function triangle(): Doc {
  return new Doc().point('A', 0, 3).point('B', -2, 0).point('C', 4, 0);
}

describe('SceneBuilder: what is drawn', () => {
  it('points, lines, circles and polygons are drawn; numbers and transforms are not', () => {
    const t = triangle();
    t.add('l', t.call('segment', 'B', 'C'));
    t.add('w', t.call('circumcircle', 'A', 'B', 'C'));
    t.add('p', t.call('polygon', 'A', 'B', 'C'));
    t.add('k', t.call('dist', 'A', 'B'));
    t.add('s', t.call('reflect', 'l'));
    const s = t.scene();
    expect(drawn(s).sort()).toEqual(['A', 'B', 'C', 'l', 'p', 'w']);
    const kinds = Object.fromEntries(s.primitives.map((p) => [p.name, p.shape.kind]));
    expect(kinds).toEqual({
      A: 'point',
      B: 'point',
      C: 'point',
      l: 'line',
      w: 'circle',
      p: 'polygon',
    });
    expect(s.unavailable).toEqual([]);
  });

  it('Undefined and Inexact values are listed with their reason, never drawn', () => {
    const t = new Doc().point('A', 0, 0).point('B', 0, 0);
    t.add('l', t.call('line', 'A', 'B'));
    t.add('M', t.call('midpoint', 'A', 'B'));
    t.add('P', t.call('foot', 'M', 'l'));
    const s = t.scene();
    expect(drawn(s)).toEqual(['A', 'B', 'M']);
    expect(s.unavailable.map((u) => u.name)).toEqual(['l', 'P']);
    expect(s.unavailable[0]?.reason).toMatch(/coincident points/);
    expect(s.unavailable[1]?.reason).toMatch(/l is undefined/);
  });

  it('a missing value is "not evaluated", never a crash', () => {
    const t = triangle();
    const s = buildScene(t.doc, new Map());
    expect(s.primitives).toEqual([]);
    expect(s.unavailable.map((u) => u.reason)).toEqual([
      'not evaluated',
      'not evaluated',
      'not evaluated',
    ]);
  });

  it('a hidden object is neither drawn nor listed as unavailable', () => {
    const t = triangle().style('B', { hidden: true });
    t.add('l', t.call('line', 'A', 'A'));
    t.style('l', { hidden: true });
    const s = t.scene();
    expect(drawn(s)).toEqual(['A', 'C']);
    expect(s.unavailable).toEqual([]);
  });

  it('the empty document gives the empty scene', () => {
    const s = new Doc().scene();
    expect(s).toEqual({ primitives: [], unavailable: [], coincident: [], scale: 1 });
  });
});

describe('SceneBuilder: layer set semantics', () => {
  it('an object is visible iff any of its layers is visible, and drawn once', () => {
    const t = new Doc().layer('aux').layer('top');
    t.point('A', 0, 0, { layers: ['main', 'aux'] });
    t.point('B', 1, 0, { layers: ['aux'] });
    expect(drawn(t.scene())).toEqual(['A', 'B']);
    t.visible('main', false);
    expect(drawn(t.scene())).toEqual(['A', 'B']);
    t.visible('aux', false);
    expect(drawn(t.scene())).toEqual([]);
    t.visible('main', true);
    expect(drawn(t.scene())).toEqual(['A']);
  });

  it('the drawing layer is the visible layer of highest order; it gives the opacity', () => {
    const t = new Doc().layer('low', { opacity: 0.5 }).layer('high', { opacity: 0.25 });
    t.point('A', 0, 0, { layers: ['low', 'high'] });
    const [a] = t.scene().primitives;
    expect(a?.layer).toBe(t.layerId('high'));
    expect(a?.style.opacity).toBe(0.25);
    t.visible('high', false);
    expect(t.scene().primitives[0]?.style.opacity).toBe(0.5);
  });

  it('z-order: layer order, then style z, then kind (polygon < circle < line < point), then origin', () => {
    const t = new Doc().layer('front');
    t.point('A', 0, 0);
    t.point('B', 1, 0);
    t.point('C', 0, 1, { layers: ['front'] });
    t.add('p', t.call('polygon', 'A', 'B', 'C'));
    t.add('l', t.call('line', 'A', 'B'));
    t.add('w', t.call('circle', 'A', 'B'));
    expect(drawn(t.scene())).toEqual(['p', 'w', 'l', 'A', 'B', 'C']);
    t.style('p', { z: 1 });
    t.style('A', { z: -1 });
    expect(drawn(t.scene())).toEqual(['A', 'w', 'l', 'B', 'p', 'C']);
  });

  it('non-finite layer orders, z and widths are sanitised (hand-built documents)', () => {
    const t = triangle();
    t.doc = {
      ...t.doc,
      layers: t.doc.layers.map((l) => ({ ...l, order: Number.NaN, opacity: Number.NaN })),
      objects: t.doc.objects.map((o, i) => ({
        ...o,
        style: { z: i === 0 ? Infinity : Number.NaN, width: -1, labelDist: Number.NaN },
      })),
    };
    const s = buildScene(t.doc, valuesOf(t.doc));
    expect(drawn(s)).toEqual(['A', 'B', 'C']);
    for (const p of s.primitives) {
      expect(p.style.opacity).toBe(1);
      expect(p.style.width).toBe(3.5);
      expect(p.label?.dist).toBe(9);
    }
  });
});

describe('SceneBuilder: styles and labels', () => {
  it('points are labelled with their name; other kinds only with a label text', () => {
    const t = new Doc().point('M_a', 0, 0).point('B', 1, 0).style('B', { label: '' });
    t.add('l', t.call('line', 'M_a', 'B'));
    t.add('m', t.call('line', 'B', 'M_a'), { style: { label: 'm' } });
    const labels = Object.fromEntries(t.scene().primitives.map((p) => [p.name, p.label?.text]));
    expect(labels).toEqual({ M_a: 'M_a', B: undefined, l: undefined, m: 'm' });
    expect(t.scene().primitives.find((p) => p.name === 'M_a')?.label?.runs).toEqual([
      { text: 'M', pos: 'base' },
      { text: 'a', pos: 'sub' },
    ]);
  });

  it('style fields resolve: colour, width (capped), dash, label angle (mod 360) and distance', () => {
    const t = new Doc().point('A', 0, 0, {
      style: { color: 'red', width: 1000, dash: 'dotted', labelAngle: -90, labelDist: 4 },
    });
    const [a] = t.scene().primitives;
    expect(a?.style).toEqual({ color: 'red', width: 64, dash: 'dotted', opacity: 1 });
    expect(a?.label).toMatchObject({ angle: 270, dist: 4 });
  });
});
