/**
 * Laws L8 and L9 for the display values (ADR-0011) on a PARSED figure, through the canvas
 * renderer: angle marks (arcs and a right-angle square), segment marks and a text, with
 * their images in a mirror layer, in fitted, zoomed and panned views. The renderer draws
 * exactly the display list's paths, and a text's string as its label.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { layout } from '@geomira/scene/display';
import { fitViewport, panViewport, type View } from '@geomira/scene/viewport';
import { sceneBounds } from '@geomira/scene/bounds';
import {
  assertAllFinite,
  checkL8,
  samplePath,
  type L8Counts,
} from '../../../../packages/scene/test/helpers/laws';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../../src/render';
import { expectedGeometry, figureOfDoc, Recorder, registry } from '../helpers';

const TEXT = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'H = rotate(B, A, 90)',
  'a = mark_angle(B, A, C, 3)',
  'r = mark_right(B, A, H)',
  's = mark_segment(A, B, 2)',
  't = text(C, "Let \\\\omega be the circle") [color=blue]',
  'T = reflect(line(B, C))',
  '@layer m = image(T, main)',
].join('\n');

describe('laws L8 and L9 for marks and texts, through the renderer', () => {
  it('fitted, zoomed and panned views: finite, drawn = hit, renderer = display list', () => {
    const r = parse(TEXT, registry);
    expect(r.diagnostics).toEqual([]);
    const f = figureOfDoc(r.doc);
    const kinds = new Set(f.scene.primitives.map((p) => p.shape.kind));
    expect([...kinds].sort()).toEqual(['angle_mark', 'point', 'segment_mark', 'text']);
    const size = { width: 640, height: 480 };
    const fit: View = { viewport: fitViewport(sceneBounds(f.scene), size, 40), size };
    const views: View[] = [0.25, 1, 4, 64].flatMap((k) => [
      { ...fit, viewport: { ...fit.viewport, zoom: fit.viewport.zoom * k } },
      {
        ...fit,
        viewport: panViewport({ ...fit.viewport, zoom: fit.viewport.zoom * k }, 300, -200),
      },
    ]);
    const counts: L8Counts = { samples: 0, cursors: 0, hits: 0 };
    let texts = 0;
    for (const view of views) {
      const d = layout(f.scene, view);
      assertAllFinite(d);
      const cursors = d.items.flatMap((i) =>
        i.paths.flatMap((p) => samplePath(p, 3).map((q) => ({ x: q.x + 2, y: q.y - 3 }))),
      );
      checkL8(d, cursors, counts);
      const rec = new Recorder();
      drawDisplay(rec, d, NO_UI, LIGHT_THEME, 2);
      expect(rec.geometry()).toEqual(expectedGeometry(d).geometry());
      const shown = rec.calls.filter((c) => c[0] === 'fillText').map((c) => String(c[1]));
      if (d.labels.some((l) => l.text === 'Let \\omega be the circle')) {
        texts++;
        expect(shown.join('')).toContain('Let ω be the circle');
      }
    }
    expect(texts).toBeGreaterThan(0);
    expect(counts.hits).toBeGreaterThan(0);
  });
});
