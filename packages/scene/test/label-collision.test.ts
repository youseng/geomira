import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { boxesOverlap, labelBox, LABEL_FONT_PX, MIN_CLEAR_DEG } from '../src/label-box';
import type { PlacedLabel } from '../src/labels';
import type { View } from '../src/viewport';
import { Doc } from './helpers/docs';

/** Note C of Run 8b: automatic labels of nearby points do not overlap. */

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 400, height: 300 } };

function placed(t: Doc, v: View = view): Map<string, PlacedLabel> {
  const d = layout(t.scene(), v);
  const names = new Map(d.items.map((i) => [i.id, i.name]));
  return new Map(d.labels.map((l) => [names.get(l.id) ?? '?', l]));
}

function overlap(a: PlacedLabel | undefined, b: PlacedLabel | undefined): boolean {
  if (a === undefined || b === undefined) throw new Error('label missing');
  return boxesOverlap(labelBox(a), labelBox(b));
}

describe('label boxes (estimated from the text)', () => {
  it('follow the alignment and grow with the text', () => {
    const one = { runs: [{ text: 'A', pos: 'base' as const }], at: { x: 10, y: 20 } };
    const left = labelBox({ ...one, align: 'left', baseline: 'bottom' });
    expect(left.minX).toBe(10);
    expect(left.maxY).toBe(20);
    expect(left.maxY - left.minY).toBe(LABEL_FONT_PX);
    const right = labelBox({ ...one, align: 'right', baseline: 'top' });
    expect(right.maxX).toBe(10);
    expect(right.minY).toBe(20);
    const centre = labelBox({ ...one, align: 'center', baseline: 'middle' });
    expect((centre.minX + centre.maxX) / 2).toBeCloseTo(10, 12);
    expect((centre.minY + centre.maxY) / 2).toBeCloseTo(20, 12);
    const sub = labelBox({
      runs: [
        { text: 'M', pos: 'base' },
        { text: 'a', pos: 'sub' },
      ],
      at: { x: 10, y: 20 },
      align: 'left',
      baseline: 'bottom',
    });
    expect(sub.maxX - sub.minX).toBeGreaterThan(left.maxX - left.minX);
    expect(sub.maxY - sub.minY).toBeGreaterThan(LABEL_FONT_PX);
  });

  it('overlap is symmetric and needs the boxes to come within the gap', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(boxesOverlap(a, { minX: 5, minY: 5, maxX: 20, maxY: 20 })).toBe(true);
    expect(boxesOverlap({ minX: 5, minY: 5, maxX: 20, maxY: 20 }, a)).toBe(true);
    expect(boxesOverlap(a, { minX: 30, minY: 0, maxX: 40, maxY: 10 })).toBe(false);
    expect(boxesOverlap(a, { minX: 0, minY: 30, maxX: 10, maxY: 40 })).toBe(false);
  });
});

describe('automatic labels avoid each other (note C)', () => {
  it('a point close to another takes another direction; the first keeps 45°', () => {
    const t = new Doc().point('A', 0, 0).point('B', 0.1, 0.1);
    const before = new Doc().point('B', 0.1, 0.1);
    expect(placed(before).get('B')?.angle).toBe(45);
    const ls = placed(t);
    expect(ls.get('A')?.angle).toBe(45);
    expect(ls.get('B')?.angle).not.toBe(45);
    expect(overlap(ls.get('A'), ls.get('B'))).toBe(false);
  });

  it('explicit offsets are untouched; the automatic label moves around them', () => {
    const style = { labelAngle: 45, labelDist: 9 };
    const t = new Doc().point('A', 0, 0).point('B', 0.1, 0.1, { style });
    const ls = placed(t);
    expect(ls.get('B')?.angle).toBe(45);
    expect(ls.get('A')?.angle).not.toBe(45);
    expect(overlap(ls.get('A'), ls.get('B'))).toBe(false);
    // Two explicit labels that collide stay where they were put.
    const u = new Doc()
      .point('A', 0, 0, { style })
      .point('B', 0.1, 0.1, { style: { labelAngle: 45, labelDist: 9 } });
    const lu = placed(u);
    expect([lu.get('A')?.angle, lu.get('B')?.angle]).toEqual([45, 45]);
  });

  it('a label never moves onto a curve through its point to avoid another label', () => {
    // A segment leaves A at 45°; B's label sits where A's second choice would go.
    const t = new Doc().point('A', 0, 0).point('P', 3, 3).point('B', -0.12, 0.12);
    t.add('s', t.call('segment', 'A', 'P'));
    const ls = placed(t);
    const a = ls.get('A')?.angle ?? -1;
    expect(Math.abs(((a - 45 + 540) % 360) - 180)).toBeGreaterThanOrEqual(MIN_CLEAR_DEG);
  });

  it('when every direction collides, the best direction is kept (fallback)', () => {
    const t = new Doc();
    // Four labels fill the diagonals; every other direction overlaps one of them.
    for (let i = 0; i < 5; i++) t.point(`P_${String(i + 1)}`, 0, 0);
    const angles = [...placed(t).values()].map((l) => l.angle);
    expect(angles.slice(0, 4)).toEqual([45, 135, 315, 225]);
    expect(angles[4]).toBe(45);
  });

  it('is deterministic and independent of earlier layouts', () => {
    const t = new Doc().point('A', 0, 0).point('B', 0.1, 0.1).point('C', 0.05, -0.1);
    expect(placed(t)).toEqual(placed(t));
    expect(layout(t.scene(), view).labels).toEqual(layout(t.scene(), view).labels);
  });

  it('property: an automatic label overlaps an earlier one only when it took its best direction', () => {
    const pt = fc.record({
      x: fc.integer({ min: -40, max: 40 }).map((n) => n / 20),
      y: fc.integer({ min: -30, max: 30 }).map((n) => n / 20),
    });
    fc.assert(
      fc.property(fc.array(pt, { minLength: 2, maxLength: 12 }), (pts) => {
        const t = new Doc();
        pts.forEach((p, i) => t.point(`P_${String(i + 1)}`, p.x, p.y));
        const alone = (i: number) =>
          placed(new Doc().point('Q', pts[i]?.x ?? 0, pts[i]?.y ?? 0)).get('Q')?.angle;
        const ls = [...placed(t).values()];
        ls.forEach((l, i) => {
          const clash = ls.slice(0, i).some((e) => overlap(e, l));
          // Lone points have no curves, so their best direction is 45°.
          if (clash) expect(l.angle).toBe(alone(i));
        });
      }),
      { numRuns: 100, seed: 20261021 },
    );
  });
});
