/**
 * ADR-0049: a label's hit box is the union of its drawn runs' em boxes, also when no run sits
 * on the baseline. The nightly's label law (apps/web/test/laws/label-hit-laws.test.ts, run
 * 41634497192) found a point labelled "*" (one superscript run) whose box reached down to the
 * reference point, 6.8 px below the drawn star: the box started at the reference point.
 */
import { describe, expect, it } from 'vitest';
import { labelGlyphs, runPx } from '../src/label-hit';
import { LABEL_FONT_PX } from '../src/label-box';

const PX = LABEL_FONT_PX;
const ASCENT_EM = 0.8;
const DESCENT_EM = 0.2;

describe('labelGlyphs: the box of a label without a baseline run', () => {
  for (const baseline of ['top', 'middle', 'bottom'] as const)
    for (const pos of ['sup', 'sub'] as const)
      it(`a lone ${pos} run (baseline ${baseline}) is boxed by its own glyph only`, () => {
        const l = {
          at: { x: 10, y: 50 },
          align: 'left',
          baseline,
          runs: [{ text: '*', pos }],
        } as const;
        const { glyphs, box } = labelGlyphs(l, [7], PX);
        const [g] = glyphs;
        expect(g).toBeDefined();
        if (g === undefined) return;
        expect(g.px).toBe(runPx(pos, PX));
        expect(box.minY).toBeCloseTo(g.y - g.px * ASCENT_EM, 9);
        expect(box.maxY).toBeCloseTo(g.y + g.px * DESCENT_EM, 9);
        expect(box.minX).toBe(10);
        expect(box.maxX).toBe(17);
      });

  it('no runs: an empty box at the reference point (unchanged)', () => {
    const l = { at: { x: 10, y: 50 }, align: 'left', baseline: 'bottom', runs: [] } as const;
    expect(labelGlyphs(l, [], PX).box).toEqual({ minX: 10, minY: 50, maxX: 10, maxY: 50 });
  });
});
