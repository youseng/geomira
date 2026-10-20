import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { parse } from '@geomira/lang/parse';
import { layout, type DisplayList } from '@geomira/scene/display';
import { hitTest } from '@geomira/scene/hit';
import type { Scene } from '@geomira/scene/types';
import { fitViewport, type View } from '@geomira/scene/viewport';
import { sceneBounds } from '@geomira/scene/bounds';
import {
  assertAllFinite,
  checkL8,
  samplePath,
  type L8Counts,
} from '../../../../packages/scene/test/helpers/laws';
import { EXAMPLES } from '../../src/examples';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../../src/render';
import {
  expectedGeometry,
  figureOfDoc,
  LAW_TIMEOUT,
  parsedDocArb,
  Recorder,
  registry,
  runs,
} from '../helpers';

const DESKTOP = { width: 640, height: 480 };
const MOBILE = { width: 390, height: 483 };

/** A view whose top-left corner lies on the first drawn line, if any (note C). */
function cornerView(scene: Scene, base: View): View | undefined {
  const line = scene.primitives.find((p) => p.shape.kind === 'line');
  if (line?.shape.kind !== 'line') return undefined;
  const { p } = line.shape;
  const { zoom } = base.viewport;
  const viewport = {
    cx: p.x + base.size.width / 2 / zoom,
    cy: p.y - base.size.height / 2 / zoom,
    zoom,
  };
  return { ...base, viewport };
}

/** Views of a scene: fitted (desktop, mobile), zoomed far in and out, a corner view. */
function viewsOf(scene: Scene, seed: number): View[] {
  const bounds = sceneBounds(scene);
  const fit = { viewport: fitViewport(bounds, DESKTOP, 40), size: DESKTOP };
  const mobile = { viewport: fitViewport(bounds, MOBILE, 40), size: MOBILE };
  const k = 2 ** ((seed % 61) - 30);
  const zoomed = { ...fit, viewport: { ...fit.viewport, zoom: fit.viewport.zoom * k } };
  const corner = cornerView(scene, fit);
  return [fit, mobile, zoomed, ...(corner === undefined ? [] : [corner])];
}

/** Cursors: a grid over the surface plus points next to drawn paths. */
function cursorsOf(d: DisplayList): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < 4; i++)
    for (let j = 1; j < 4; j++)
      out.push({ x: (d.view.size.width * i) / 4, y: (d.view.size.height * j) / 4 });
  for (const item of d.items.slice(0, 10))
    for (const p of item.paths.slice(0, 1))
      for (const q of samplePath(p, 1).slice(0, 2)) out.push({ x: q.x + 3, y: q.y - 2 });
  return out;
}

interface Seen {
  docs: number;
  views: number;
  numbers: number;
  refused: number;
  drawCalls: number;
}

/** L9 and L8 on one figure in all its views, through the renderer. */
function checkFigure(doc: Document, seed: number, seen: Seen, counts: L8Counts): void {
  const f = figureOfDoc(doc);
  seen.docs++;
  seen.numbers += assertAllFinite(f.scene, 'scene');
  for (const view of viewsOf(f.scene, seed)) {
    const d = layout(f.scene, view);
    seen.views++;
    if (d.problem !== null) seen.refused++;
    seen.numbers += assertAllFinite(d.items, 'items') + assertAllFinite(d.labels, 'labels');
    checkL8(d, cursorsOf(d), counts);
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 2);
    seen.drawCalls += rec.calls.length;
    assertAllFinite(rec.calls, 'canvas calls');
    expect(rec.geometry()).toEqual(expectedGeometry(d).geometry());
  }
}

describe('laws L8 and L9 on parsed documents, through the canvas renderer', () => {
  it(
    'random documents of the language generator (derived layers, styles, Undefined values)',
    () => {
      const seen: Seen = { docs: 0, views: 0, numbers: 0, refused: 0, drawCalls: 0 };
      const counts: L8Counts = { samples: 0, cursors: 0, hits: 0 };
      fc.assert(
        fc.property(parsedDocArb(), fc.nat(), (doc, seed) => {
          checkFigure(doc, seed, seen, counts);
        }),
        { numRuns: runs(120), seed: 20261020 },
      );
      console.warn(`L8/L9 (generated): ${JSON.stringify({ ...seen, ...counts })}`);
      expect(seen.docs).toBe(runs(120));
      expect(counts.hits).toBeGreaterThan(0);
    },
    LAW_TIMEOUT,
  );

  it('the eight examples and the 300-object figure', () => {
    const seen: Seen = { docs: 0, views: 0, numbers: 0, refused: 0, drawCalls: 0 };
    const counts: L8Counts = { samples: 0, cursors: 0, hits: 0 };
    for (const [i, e] of EXAMPLES.entries()) {
      const r = parse(e.text, registry);
      expect(r.diagnostics, e.id).toEqual([]);
      checkFigure(r.doc, i * 17, seen, counts);
    }
    console.warn(`L8/L9 (examples): ${JSON.stringify({ ...seen, ...counts })}`);
    expect(seen.docs).toBe(9);
  });

  it('empty and degenerate figures: nothing drawn, nothing non-finite, nothing hit', () => {
    for (const text of ['@version 1\n', 'A = (0, 0)\nB = (0, 0)\nl = line(A, B)\n']) {
      const f = figureOfDoc(parse(text, registry).doc);
      for (const view of viewsOf(f.scene, 3)) {
        const d = layout(f.scene, view);
        assertAllFinite(d);
        expect(d.items.every((i) => i.kind === 'point')).toBe(true);
        expect(assertAllFinite(hitTest(d, { x: 1, y: 1 }))).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
