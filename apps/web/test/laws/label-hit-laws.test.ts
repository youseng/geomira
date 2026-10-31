/**
 * ADR-0049, law L8 for labels on PARSED figures, through the canvas renderer: what is drawn
 * is what is hit. The rectangles of the runs the renderer draws (read back from its calls on
 * a recording context: fillText positions, the font sizes it sets, the widths it measures)
 * are recomputed here independently of the scene; then (1) a press at the centre of every
 * drawn label (not a text's string) hits that label or one drawn after it, and the hit box is
 * the union of its drawn runs; (2) every label hit at a cursor has drawn runs within
 * LABEL_PICK_PX of the cursor.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { layout, type DisplayList } from '@geomira/scene/display';
import { hitLabel, LABEL_PICK_PX } from '@geomira/scene/label-hit';
import type { Rect } from '@geomira/scene/viewport';
import { fitViewport } from '@geomira/scene/viewport';
import { sceneBounds } from '@geomira/scene/bounds';
import { EXAMPLES } from '../../src/examples';
import { drawDisplay, LIGHT_THEME, measuredWidth, NO_UI } from '../../src/render';
import { loadFigure } from '../../src/figure';
import { figureOfDoc, LAW_TIMEOUT, parsedDocArb, Recorder, registry, runs } from '../helpers';

const SIZE = { width: 640, height: 480 };

/** Each label's drawn rectangle, from the recorded calls (Recorder: 7 px per character). */
function drawnRects(d: DisplayList): Map<number, Rect> {
  const rec = new Recorder();
  drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
  const runsDrawn: { x: number; y: number; w: number; px: number }[] = [];
  let px = 0;
  for (const c of rec.calls) {
    if (c[0] === 'set' && c[1] === 'font') px = Number.parseFloat(String(c[2]));
    if (c[0] === 'fillText') {
      const [, text, x, y] = c;
      runsDrawn.push({ x: Number(x), y: Number(y), w: 7 * String(text).length, px });
    }
  }
  const out = new Map<number, Rect>();
  let k = 0;
  for (const l of d.labels) {
    const mine = runsDrawn.slice(k, k + l.runs.length);
    k += l.runs.length;
    if (mine.length === 0) continue;
    out.set(l.id, {
      minX: Math.min(...mine.map((r) => r.x)),
      maxX: Math.max(...mine.map((r) => r.x + r.w)),
      minY: Math.min(...mine.map((r) => r.y - 0.8 * r.px)),
      maxY: Math.max(...mine.map((r) => r.y + 0.2 * r.px)),
    });
  }
  expect(k).toBe(runsDrawn.length);
  return out;
}

function checkLabels(d: DisplayList): number {
  const width = measuredWidth(new Recorder(), LIGHT_THEME);
  const rects = drawnRects(d);
  const texts = new Set(d.items.filter((i) => i.kind === 'text').map((i) => i.id));
  const order = d.labels.map((l) => l.id);
  let checked = 0;
  for (const [id, r] of rects) {
    if (texts.has(id)) continue;
    const centre = { x: (r.minX + r.maxX) / 2, y: (r.minY + r.maxY) / 2 };
    const h = hitLabel(d, centre, width, LIGHT_THEME.fontSize);
    expect(h).toBeDefined();
    expect(order.indexOf(h?.id ?? -1)).toBeGreaterThanOrEqual(order.indexOf(id));
    if (h?.id === id) {
      expect(h.box.minX).toBeCloseTo(r.minX, 9);
      expect(h.box.maxX).toBeCloseTo(r.maxX, 9);
      expect(h.box.minY).toBeCloseTo(r.minY, 9);
      expect(h.box.maxY).toBeCloseTo(r.maxY, 9);
    }
    checked++;
  }
  for (let i = 0; i <= 16; i++)
    for (let j = 0; j <= 12; j++) {
      const q = { x: (i * SIZE.width) / 16, y: (j * SIZE.height) / 12 };
      const h = hitLabel(d, q, width, LIGHT_THEME.fontSize);
      if (h === undefined) continue;
      const r = rects.get(h.id);
      expect(r).toBeDefined();
      if (r === undefined) continue;
      const pad = LABEL_PICK_PX;
      expect(q.x).toBeGreaterThanOrEqual(r.minX - pad - 1 / 1024);
      expect(q.x).toBeLessThanOrEqual(r.maxX + pad + 1 / 1024);
      expect(q.y).toBeGreaterThanOrEqual(r.minY - pad - 1 / 1024);
      expect(q.y).toBeLessThanOrEqual(r.maxY + pad + 1 / 1024);
    }
  return checked;
}

function displayOf(doc: Document): DisplayList {
  const f = figureOfDoc(doc);
  return layout(f.scene, { viewport: fitViewport(sceneBounds(f.scene), SIZE, 40), size: SIZE });
}

describe('L8 for labels: drawn = hit, through the renderer', () => {
  it('the examples', () => {
    let checked = 0;
    for (const ex of EXAMPLES) {
      const f = loadFigure(ex.text, registry);
      const d = layout(f.scene, {
        viewport: fitViewport(sceneBounds(f.scene), SIZE, 40),
        size: SIZE,
      });
      checked += checkLabels(d);
    }
    expect(checked).toBeGreaterThan(20);
  });

  it(
    'generated documents',
    () => {
      fc.assert(
        fc.property(parsedDocArb(), (doc) => {
          checkLabels(displayOf(doc));
        }),
        { numRuns: runs(60) },
      );
    },
    LAW_TIMEOUT,
  );
});
