/**
 * ADR-0049: labels are hit-tested on the box their runs are drawn in (labelGlyphs: the
 * renderer places the runs with it, from measured widths); the topmost label wins; a text's
 * string is not a label to drag; labelOffset inverts the placement (angle, pixels).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Expr } from '@geomira/kernel/expr';
import { layout } from '../src/display';
import {
  estimatedWidth,
  hitLabel,
  LABEL_PICK_PX,
  labelGlyphs,
  labelOffset,
  runPx,
} from '../src/label-hit';
import { labelBox, LABEL_FONT_PX } from '../src/label-box';
import type { PlacedLabel } from '../src/labels';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };
const str = (value: string): Expr => ({ kind: 'str', value });

function labelOf(t: Doc, name: string, v: View = view): PlacedLabel {
  const d = layout(t.scene(), v);
  const l = d.labels.find((x) => x.id === t.id(name));
  if (l === undefined) throw new Error(`no label of ${name}`);
  return l;
}

describe('labelGlyphs: the runs as drawn and their box', () => {
  const base = { at: { x: 100, y: 50 }, align: 'left', baseline: 'bottom' } as const;

  it('runs follow each other by their widths; the box spans them and their em boxes', () => {
    const l = {
      ...base,
      runs: [
        { text: 'M', pos: 'base' },
        { text: 'a', pos: 'sub' },
      ],
    } as const;
    const g = labelGlyphs(l, [10, 5], 15);
    expect(g.glyphs).toEqual([
      { text: 'M', x: 100, y: 50 - 15 * 0.2, px: 15 },
      { text: 'a', x: 110, y: 50 - 15 * 0.2 + 15 * 0.25, px: 11 },
    ]);
    expect(g.box.minX).toBe(100);
    expect(g.box.maxX).toBe(115);
    expect(g.box.minY).toBeCloseTo(50 - 15, 12);
    // The subscript's em box reaches below the baseline of the base run.
    expect(g.box.maxY).toBeCloseTo(50 - 3 + 3.75 + 11 * 0.2, 12);
  });

  it('alignment: right ends at the reference point, centre is centred; top hangs from it', () => {
    const runs = [{ text: 'AB', pos: 'base' }] as const;
    const r = labelGlyphs({ ...base, runs, align: 'right', baseline: 'top' }, [20], 15);
    expect([r.box.minX, r.box.maxX, r.box.minY]).toEqual([80, 100, 50]);
    const c = labelGlyphs({ ...base, runs, align: 'center', baseline: 'middle' }, [20], 15);
    expect([c.box.minX, c.box.maxX]).toEqual([90, 110]);
    expect((c.box.minY + c.box.maxY) / 2).toBeCloseTo(50 - 15 * 0.3 + 15 * 0.3, 12);
  });

  it('degenerate: no runs, missing or non-finite widths', () => {
    const e = labelGlyphs({ ...base, runs: [] }, [], 15);
    expect(e.glyphs).toEqual([]);
    expect(e.box).toEqual({ minX: 100, minY: 50, maxX: 100, maxY: 50 });
    const runs = [
      { text: 'A', pos: 'base' },
      { text: 'B', pos: 'base' },
    ] as const;
    const g = labelGlyphs({ ...base, runs }, [Number.NaN], 15);
    expect(g.glyphs.map((x) => x.x)).toEqual([100, 100]);
    expect(Number.isFinite(g.box.maxY)).toBe(true);
  });

  it('the estimate is label-box.ts measure, per run (small runs at 0.7)', () => {
    expect(estimatedWidth({ text: 'AB', pos: 'base' })).toBeCloseTo(2 * 0.62 * 15, 12);
    expect(estimatedWidth({ text: 'a', pos: 'sub' })).toBeCloseTo(0.62 * 15 * 0.7, 12);
    expect(runPx('base', 15)).toBe(15);
    expect(runPx('sup', 15)).toBe(11);
    const l: PlacedLabel = labelOf(new Doc().point('A', 0, 0), 'A');
    const est = labelBox(l);
    const g = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
    expect(g.box.maxX - g.box.minX).toBeCloseTo(est.maxX - est.minX, 9);
  });
});

describe('hitLabel', () => {
  it("inside a point's label box (grown by LABEL_PICK_PX) the label is hit; outside not", () => {
    const t = new Doc().point('A', 0, 0);
    const d = layout(t.scene(), view);
    const l = labelOf(t, 'A');
    const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
    const mid = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    expect(hitLabel(d, mid)).toMatchObject({ id: t.id('A'), box });
    expect(hitLabel(d, { x: box.maxX + LABEL_PICK_PX, y: mid.y })?.id).toBe(t.id('A'));
    expect(hitLabel(d, { x: box.maxX + LABEL_PICK_PX + 1, y: mid.y })).toBeUndefined();
    expect(hitLabel(d, { x: mid.x, y: box.minY - LABEL_PICK_PX - 1 })).toBeUndefined();
    // The dot itself (the anchor) is not inside the label's box.
    expect(hitLabel(d, l.anchor)).toBeUndefined();
  });

  it("a host's measure decides the box (the renderer's widths)", () => {
    const t = new Doc().point('A', 0, 0);
    const d = layout(t.scene(), view);
    const l = labelOf(t, 'A');
    const wide = () => 60;
    const far = { x: l.at.x + 50, y: l.at.y - 5 };
    expect(hitLabel(d, far)).toBeUndefined();
    expect(hitLabel(d, far, wide)?.id).toBe(t.id('A'));
  });

  it('lines and circles with a label text are hit; overlapping labels: the one drawn last', () => {
    const t = new Doc().point('B', -2, 0).point('C', 2, 0);
    t.add('l', t.call('line', 'B', 'C'), { style: { label: 'ell' } });
    t.add('w', t.call('circle', 'B', 'C'), { style: { label: 'omega' } });
    const d = layout(t.scene(), view);
    for (const name of ['l', 'w']) {
      const l = labelOf(t, name);
      const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
      expect(hitLabel(d, { x: box.minX + 1, y: box.maxY - 1 })?.id).toBe(t.id(name));
    }
    const u = new Doc()
      .point('P', 0, 0, { style: { labelAngle: 0, labelDist: 10 } })
      .point('Q', 0.02, 0, { style: { labelAngle: 0, labelDist: 10 } });
    const du = layout(u.scene(), view);
    const q = labelOf(u, 'Q');
    const order = du.labels.map((x) => x.id);
    const top = order.indexOf(u.id('Q')) > order.indexOf(u.id('P')) ? 'Q' : 'P';
    expect(hitLabel(du, { x: q.at.x + 3, y: q.at.y })?.id).toBe(u.id(top));
  });

  it("a text's string is not a label to drag; a refused view or a non-finite cursor hits none", () => {
    const t = new Doc();
    t.add('t', t.call('text', t.call('point', 0, 0), str('hello')));
    const d = layout(t.scene(), view);
    const l = d.labels[0];
    expect(l?.id).toBe(t.id('t'));
    expect(hitLabel(d, l?.at ?? { x: 0, y: 0 })).toBeUndefined();
    const p = new Doc().point('A', 0, 0);
    const refused = layout(p.scene(), { ...view, viewport: { cx: 0, cy: 0, zoom: 0 } });
    expect(hitLabel(refused, { x: 200, y: 150 })).toBeUndefined();
    const ok = layout(p.scene(), view);
    expect(hitLabel(ok, { x: Number.NaN, y: 150 })).toBeUndefined();
  });
});

describe('labelOffset inverts the placement', () => {
  it('at its own reference point a label has its own offset', () => {
    const t = new Doc().point('A', 0, 0, { style: { labelAngle: 200, labelDist: 30 } });
    const l = labelOf(t, 'A');
    const o = labelOffset(l, l.at);
    expect(o.angle).toBeCloseTo(200, 9);
    expect(o.dist).toBeCloseTo(30, 9);
  });

  it('property: placing at the offset of any point gives that point back', () => {
    const t = new Doc().point('A', 0, 0);
    const l = labelOf(t, 'A');
    fc.assert(
      fc.property(
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.double({ min: -300, max: 300, noNaN: true }),
        (dx, dy) => {
          const at = { x: l.anchor.x + dx, y: l.anchor.y + dy };
          const o = labelOffset(l, at);
          expect(o.angle).toBeGreaterThanOrEqual(0);
          expect(o.angle).toBeLessThan(360);
          const rad = (o.angle * Math.PI) / 180;
          const back = {
            x: l.anchor.x + o.dist * Math.cos(rad),
            y: l.anchor.y - o.dist * Math.sin(rad),
          };
          expect(back.x).toBeCloseTo(at.x, 6);
          expect(back.y).toBeCloseTo(at.y, 6);
        },
      ),
    );
  });

  it('degenerate: on the anchor, or not finite → distance 0, the current angle', () => {
    const l = labelOf(new Doc().point('A', 0, 0), 'A');
    expect(labelOffset(l, l.anchor)).toEqual({ angle: l.angle, dist: 0 });
    expect(labelOffset(l, { x: Number.POSITIVE_INFINITY, y: 0 })).toEqual({
      angle: l.angle,
      dist: 0,
    });
  });
});
