/**
 * A segment mark's label sits at its middle tick (ADR-0011 decision 16), not at its first:
 * at the centre of its ticks, which is the middle tick for an odd count and the point between
 * the two middle ticks for an even one (ADR-0028), the middle of the marked segment.
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../src/display';
import { toScreen, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 640, height: 480 } };

describe("a segment mark's label anchor", () => {
  for (const ticks of [1, 2, 3])
    it(`${String(ticks)} tick(s): the middle of the segment`, () => {
      const t = new Doc().point('A', -3, 1).point('B', 3, -1);
      t.add('m', t.call('mark_segment', 'A', 'B', ticks), { style: { label: 'x' } });
      const d = layout(t.scene(), view);
      const l = d.labels.find((x) => x.id === t.id('m'));
      if (l === undefined) throw new Error('no label');
      const mid = toScreen(view, { x: 0, y: 0 });
      expect(l.anchor.x).toBeCloseTo(mid.x, 9);
      expect(l.anchor.y).toBeCloseTo(mid.y, 9);
    });
});
