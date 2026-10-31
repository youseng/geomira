/**
 * ADR-0048: measurements are visible. A number styled `show` whose definition is dist or
 * angle (or dangle) of named objects is drawn as its value: a distance as a label at the middle
 * of the measured segment, offset to its left (pixels, whatever the zoom); an angle as one arc
 * at the vertex with the value in degrees outside it. Numbers without `show` stay undrawn;
 * other numbers are not drawn and say why; Undefined values are listed, never drawn.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Expr } from '@geomira/kernel/expr';
import { sceneBounds } from '../src/bounds';
import { layout, type DisplayList } from '../src/display';
import { hitTest } from '../src/hit';
import { estimatedWidth, hitLabel, labelGlyphs } from '../src/label-hit';
import { LABEL_FONT_PX } from '../src/label-box';
import { MARK_RADIUS } from '../src/mark-paths';
import {
  DEFAULT_DIGITS,
  digitsOf,
  distanceLabelAngle,
  formatMeasure,
  measureDef,
  measureRuns,
} from '../src/measure';
import { CURVE_LABEL_DIST } from '../src/style';
import { fitViewport, toScreen, type View } from '../src/viewport';
import { Doc, drawn } from './helpers/docs';
import { assertAllFinite, checkL8 } from './helpers/laws';

const SIZE = { width: 400, height: 300 };
const view = (zoom: number, cx = 0, cy = 0): View => ({ viewport: { cx, cy, zoom }, size: SIZE });
const SHOW = { show: true } as const;

function figure(style = SHOW): Doc {
  const t = new Doc();
  t.point('A', 0, 0).point('B', 3, 4).point('C', 3, 0);
  t.add('l', t.call('line', 'A', 'C'));
  t.add('d', t.call('dist', 'A', 'B'), { style });
  t.add('h', t.call('dist', 'B', 'l'), { style });
  t.add('e', t.call('angle', 'B', 'C', 'A'), { style });
  t.add('f', t.call('dangle', 'C', 'A', 'B'), { style });
  return t;
}

function labelOf(d: DisplayList, t: Doc, name: string) {
  const l = d.labels.find((x) => x.id === t.id(name));
  if (l === undefined) throw new Error(`no label of ${name}`);
  return l;
}

describe('which numbers are measurements (measureDef)', () => {
  it('dist of two named objects, angle and dangle of three; the rest says why not', () => {
    const t = figure();
    t.add('r', t.call('ratio', 'A', 'B', 'A', 'C'));
    t.add('m', t.call('dist', t.call('midpoint', 'A', 'B'), 'C'));
    const def = (n: string): Expr => t.doc.objects.find((o) => o.name === n)?.def ?? t.expr(0);
    expect(measureDef(def('d'))).toEqual({ kind: 'distance', from: t.id('A'), to: t.id('B') });
    expect(measureDef(def('h'))).toEqual({ kind: 'distance', from: t.id('B'), to: t.id('l') });
    expect(measureDef(def('e'))).toEqual({
      kind: 'angle',
      a: t.id('B'),
      b: t.id('C'),
      c: t.id('A'),
      directed: false,
    });
    expect(measureDef(def('f'))).toMatchObject({ kind: 'angle', directed: true });
    expect(measureDef(def('r'))).toEqual({
      kind: 'none',
      reason: 'only dist, angle and dangle measurements are drawn',
    });
    expect(measureDef(def('m'))).toEqual({
      kind: 'none',
      reason: 'a measurement is drawn only when its arguments are named objects',
    });
    expect(measureDef(t.expr(2))).toMatchObject({ kind: 'none' });
  });
});

describe('the value as shown', () => {
  it('digits decimals (default 2), degrees with °, no minus sign on a rounded zero', () => {
    expect(formatMeasure(5, DEFAULT_DIGITS, false)).toBe('5.00');
    expect(formatMeasure(Math.PI, 3, false)).toBe('3.142');
    expect(formatMeasure(90, 2, true)).toBe('90.00°');
    expect(formatMeasure(44.996, 0, true)).toBe('45°');
    expect(formatMeasure(-0.0001, 2, false)).toBe('0.00');
    expect(formatMeasure(-0, 0, false)).toBe('0');
    expect(formatMeasure(-1.5, 1, false)).toBe('-1.5');
    expect(formatMeasure(2, 25, false)).toBe('2.0000000000');
    expect(formatMeasure(Number.NaN, 2, false)).toBe('undefined');
    expect(digitsOf({})).toBe(2);
    expect(digitsOf({ digits: 0 })).toBe(0);
    expect(digitsOf({ digits: 2.5 })).toBe(2);
    expect(digitsOf({ digits: 11 })).toBe(2);
  });

  it('a label text is a prefix: "AB = 3.61", its runs parsed, the value literal', () => {
    expect(measureRuns({}, '3.61')).toEqual({
      text: '3.61',
      runs: [{ text: '3.61', pos: 'base' }],
    });
    expect(measureRuns({ label: 'AB' }, '3.61')).toEqual({
      text: 'AB = 3.61',
      runs: [{ text: 'AB = 3.61', pos: 'base' }],
    });
    expect(measureRuns({ label: 'M_a' }, '1.00').runs).toEqual([
      { text: 'M', pos: 'base' },
      { text: 'a', pos: 'sub' },
      { text: ' = 1.00', pos: 'base' },
    ]);
    expect(measureRuns({ label: '' }, '1.00').text).toBe('1.00');
  });
});

describe('the scene (buildScene)', () => {
  it('numbers without show are not drawn (old documents unchanged); with show they are', () => {
    expect(drawn(figure({} as typeof SHOW).scene())).toEqual(['l', 'A', 'B', 'C']);
    expect(drawn(figure().scene()).sort()).toEqual(['A', 'B', 'C', 'd', 'e', 'f', 'h', 'l']);
    const hidden = figure();
    hidden.style('d', { show: true, hidden: true }).style('e', { show: false });
    expect(drawn(hidden.scene())).not.toContain('d');
    expect(drawn(hidden.scene())).not.toContain('e');
  });

  it('shapes: distance A to B, B to its foot on l; the convex angle; dangle from BA by its value', () => {
    const s = figure().scene();
    const shape = (n: string) => s.primitives.find((p) => p.name === n)?.shape;
    expect(shape('d')).toEqual({ kind: 'distance', p: { x: 0, y: 0 }, q: { x: 3, y: 4 } });
    expect(shape('h')).toEqual({ kind: 'distance', p: { x: 3, y: 4 }, q: { x: 3, y: 0 } });
    const e = shape('e');
    expect(e).toMatchObject({ kind: 'angle_mark', b: { x: 3, y: 0 }, arcs: 1, right: false });
    expect(e?.kind === 'angle_mark' && e.to - e.from).toBeCloseTo(Math.PI / 2, 12);
    const f = shape('f');
    expect(f?.kind === 'angle_mark' && f.from).toBe(0);
    expect(f?.kind === 'angle_mark' && f.to - f.from).toBeCloseTo(Math.atan2(4, 3), 12);
  });

  it('labels: the value with its digits and the degree sign, the label prefix', () => {
    const t = figure();
    t.style('d', { show: true, digits: 3, label: 'AB' });
    const s = t.scene();
    const text = (n: string) => s.primitives.find((p) => p.name === n)?.label?.text;
    expect(text('d')).toBe('AB = 5.000');
    expect(text('h')).toBe('4.00');
    expect(text('e')).toBe('90.00°');
    expect(text('f')).toBe(`${((Math.atan2(4, 3) * 180) / Math.PI).toFixed(2)}°`);
  });

  it('a shown ratio, area or measurement of inline expressions is not drawn', () => {
    const t = figure();
    t.add('r', t.call('ratio', 'A', 'B', 'A', 'C'), { style: SHOW });
    t.add('m', t.call('dist', t.call('midpoint', 'A', 'B'), 'C'), { style: SHOW });
    const s = t.scene();
    expect(drawn(s)).not.toContain('r');
    expect(drawn(s)).not.toContain('m');
    expect(s.unavailable).toEqual([]);
  });

  it('an Undefined measurement is listed with its reason, never drawn; dist(A, A) = 0 is drawn', () => {
    const t = new Doc();
    t.point('A', 1, 1).point('C', 2, 0);
    t.add('u', t.call('angle', 'A', 'A', 'C'), { style: SHOW });
    t.add('z', t.call('dist', 'A', 'A'), { style: SHOW });
    const s = t.scene();
    expect(drawn(s)).not.toContain('u');
    expect(s.unavailable.map((x) => x.name)).toEqual(['u']);
    expect(s.unavailable[0]?.reason).toMatch(/./u);
    const z = s.primitives.find((p) => p.name === 'z');
    expect(z?.label?.text).toBe('0.00');
    expect(distanceLabelAngle({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(90);
  });

  it('bounds include a distance measurement’s ends', () => {
    const t = new Doc();
    t.point('A', 0, 0).point('B', 10, 0, { style: { hidden: true } });
    t.add('d', t.call('dist', 'A', 'B'), { style: SHOW });
    expect(sceneBounds(t.scene())).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 0 });
  });
});

describe('layout: offsets in pixels at any zoom; hit = drawn', () => {
  for (const zoom of [0.5, 20, 400, 1e6])
    it(`zoom ${String(zoom)}: the distance label sits CURVE_LABEL_DIST px left of A → B`, () => {
      const t = new Doc();
      t.point('A', 0, 0).point('B', 3 / zoom, 4 / zoom);
      t.add('d', t.call('dist', 'A', 'B'), { style: SHOW });
      const d = layout(t.scene(), view(zoom));
      const l = labelOf(d, t, 'd');
      const mid = toScreen(d.view, { x: 1.5 / zoom, y: 2 / zoom });
      expect(l.anchor.x).toBeCloseTo(mid.x, 9);
      expect(l.anchor.y).toBeCloseTo(mid.y, 9);
      expect(Math.hypot(l.at.x - l.anchor.x, l.at.y - l.anchor.y)).toBeCloseTo(CURVE_LABEL_DIST, 9);
      const deg = (Math.atan2(4, 3) * 180) / Math.PI + 90;
      expect(l.angle).toBeCloseTo(deg, 9);
      // Left of A → B: up and to the left on the screen; aligned away from the segment.
      expect(l.at.x).toBeLessThan(l.anchor.x);
      expect(l.at.y).toBeLessThan(l.anchor.y);
      expect([l.align, l.baseline]).toEqual(['right', 'bottom']);
    });

  it('label_angle and label_dist place the value as for any label', () => {
    const t = new Doc();
    t.point('A', 0, 0).point('B', 4, 0);
    t.add('d', t.call('dist', 'A', 'B'), {
      style: { show: true, labelAngle: 270, labelDist: 20 },
    });
    const d = layout(t.scene(), view(20));
    const l = labelOf(d, t, 'd');
    expect(l.angle).toBe(270);
    expect(l.at.y - l.anchor.y).toBeCloseTo(20, 9);
  });

  it('the angle arc has a fixed pixel radius at the vertex; its value outside it on the bisector', () => {
    for (const zoom of [1, 20, 1000]) {
      const t = new Doc();
      t.point('A', 1 / zoom, 0)
        .point('B', 0, 0)
        .point('C', 0, 1 / zoom);
      t.add('e', t.call('angle', 'A', 'B', 'C'), { style: SHOW });
      const d = layout(t.scene(), view(zoom));
      const item = d.items.find((i) => i.id === t.id('e'));
      expect(item?.paths).toEqual([
        {
          kind: 'arc',
          c: toScreen(d.view, { x: 0, y: 0 }),
          r: MARK_RADIUS,
          from: 0,
          to: Math.PI / 2,
        },
      ]);
      const l = labelOf(d, t, 'e');
      expect(l.text).toBe('90.00°');
      expect(l.angle).toBeCloseTo(45, 9);
    }
  });

  it('a click on the arc hits the measurement; the value label is hit by hitLabel', () => {
    const t = figure();
    const d = layout(t.scene(), fitView(t));
    const arc = d.items.find((i) => i.id === t.id('e'))?.paths[0];
    expect(arc?.kind).toBe('arc');
    if (arc?.kind !== 'arc') return;
    const on = {
      x: arc.c.x + arc.r * Math.cos(arc.from + 0.3),
      y: arc.c.y - arc.r * Math.sin(arc.from + 0.3),
    };
    expect(hitTest(d, on).hits.map((h) => h.id)).toContain(t.id('e'));
    for (const name of ['d', 'h', 'e', 'f']) {
      const l = labelOf(d, t, name);
      const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
      const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
      expect(hitLabel(d, centre)?.id, name).toBe(t.id(name));
    }
  });

  it('a distance draws no stroke: its middle is not a hit target (the segment under it is)', () => {
    const t = new Doc();
    t.point('A', -4, 0).point('B', 4, 0);
    t.add('s', t.call('segment', 'A', 'B'));
    t.add('d', t.call('dist', 'A', 'B'), { style: SHOW });
    const d = layout(t.scene(), view(20));
    const item = d.items.find((i) => i.id === t.id('d'));
    expect(item?.paths).toEqual([]);
    const ids = hitTest(d, toScreen(d.view, { x: 0, y: 0 })).hits.map((h) => h.id);
    expect(ids).toEqual([t.id('s')]);
  });

  it('a distance whose middle is far outside the view lays out to nothing', () => {
    const t = new Doc();
    t.point('A', 1000, 0).point('B', 1002, 0);
    t.add('d', t.call('dist', 'A', 'B'), { style: SHOW });
    const d = layout(t.scene(), view(20));
    expect(d.items.map((i) => i.name)).toEqual([]);
    expect(d.labels).toEqual([]);
  });
});

function fitView(t: Doc): View {
  const b = sceneBounds(t.scene());
  if (b === null) throw new Error('empty');
  return { viewport: fitViewport(b, SIZE), size: SIZE };
}

describe('laws on shown measurements (L8, L9)', () => {
  const coord = fc.oneof(
    fc.integer({ min: -10, max: 10 }),
    fc.double({ min: -10, max: 10, noNaN: true }),
    fc.double({ min: -1e150, max: 1e150, noNaN: true }),
    fc.double({ min: -1e-150, max: 1e-150, noNaN: true }),
  );
  it('scenes, display lists and hits are finite; what is drawn is what is hit', () => {
    const counts = { samples: 0, cursors: 0, hits: 0 };
    fc.assert(
      fc.property(
        fc.array(fc.tuple(coord, coord), { minLength: 3, maxLength: 3 }),
        fc.oneof(
          fc.double({ min: 1, max: 200, noNaN: true }),
          fc.double({ min: 1e-200, max: 1e200, noNaN: true }),
        ),
        fc.boolean(),
        fc.array(
          fc.tuple(
            fc.double({ min: 0, max: 400, noNaN: true }),
            fc.double({ min: 0, max: 300, noNaN: true }),
          ),
          { maxLength: 6 },
        ),
        (pts, zoom, fit, cursors) => {
          const t = new Doc();
          pts.forEach(([x, y], i) => t.point(`P${String(i)}`, x, y));
          t.add('l', t.call('line', 'P0', 'P1'));
          t.add('d', t.call('dist', 'P0', 'P1'), { style: SHOW });
          t.add('h', t.call('dist', 'P2', 'l'), { style: SHOW });
          t.add('e', t.call('angle', 'P0', 'P1', 'P2'), { style: SHOW });
          t.add('f', t.call('dangle', 'P0', 'P1', 'P2'), { style: { show: true, digits: 10 } });
          const scene = t.scene();
          assertAllFinite(scene, 'scene');
          const b = sceneBounds(scene);
          const v = fit && b !== null ? { viewport: fitViewport(b, SIZE), size: SIZE } : view(zoom);
          const d = layout(scene, v);
          assertAllFinite(d, 'display');
          checkL8(
            d,
            cursors.map(([x, y]) => ({ x, y })),
            counts,
          );
          for (const [x, y] of cursors) assertAllFinite(hitLabel(d, { x, y }) ?? {}, 'label hit');
        },
      ),
      { numRuns: process.env.NIGHTLY === '1' ? 2000 : 200, seed: 48 },
    );
    expect(counts.cursors).toBeGreaterThan(0);
  });
});
