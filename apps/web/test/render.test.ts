import { describe, expect, it } from 'vitest';
import { layout } from '@geomira/scene/display';
import type { DisplayList } from '@geomira/scene/display';
import { EXAMPLES } from '../src/examples';
import { loadFigure, viewportFor } from '../src/figure';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../src/render';
import { expectedGeometry, Recorder, registry } from './helpers';

const size = { width: 640, height: 480 };

function displayOf(id: string): DisplayList {
  const f = loadFigure(EXAMPLES.find((e) => e.id === id)?.text ?? '', registry);
  return layout(f.scene, { viewport: viewportFor(f, size), size });
}

describe('the canvas renderer (a pure function of display list and UI state)', () => {
  it('draws exactly the display list: the same paths, in draw order', () => {
    for (const e of EXAMPLES) {
      const d = displayOf(e.id);
      const rec = new Recorder();
      drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
      expect(rec.geometry(), e.id).toEqual(expectedGeometry(d).geometry());
    }
  });

  it('is deterministic: the same input gives the same calls', () => {
    const d = displayOf('euler-line');
    const [a, b] = [new Recorder(), new Recorder()];
    drawDisplay(a, d, NO_UI, LIGHT_THEME, 2);
    drawDisplay(b, d, NO_UI, LIGHT_THEME, 2);
    expect(a.calls).toEqual(b.calls);
  });

  it('HiDPI: every frame starts with setTransform(dpr); a bad dpr counts as 1', () => {
    const d = displayOf('euler-line');
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 2);
    expect(rec.calls[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    const bad = new Recorder();
    drawDisplay(bad, d, NO_UI, LIGHT_THEME, Number.NaN);
    expect(bad.calls[0]).toEqual(['setTransform', 1, 0, 0, 1, 0, 0]);
  });

  it('colours: the theme default is set before an object colour (an invalid one is ignored by the canvas)', () => {
    const d = displayOf('euler-line');
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
    const strokes = rec.calls
      .filter((c) => c[0] === 'set' && c[1] === 'strokeStyle')
      .map((c) => c[2]);
    const red = strokes.indexOf('#b3261e'); // red in the scene's palette (ADR-0016)
    expect(red).toBeGreaterThan(0);
    expect(strokes[red - 1]).toBe(LIGHT_THEME.foreground);
  });

  it('hover and selection draw halos under their items; nothing else changes', () => {
    const d = displayOf('euler-line');
    const id = d.items[0]?.id ?? -1;
    const rec = new Recorder();
    drawDisplay(rec, d, { hover: id, selection: new Set([d.items[1]?.id ?? -1]) }, LIGHT_THEME, 1);
    const styles = rec.calls
      .filter((c) => c[0] === 'set' && c[1] === 'strokeStyle')
      .map((c) => c[2]);
    expect(styles).toContain(LIGHT_THEME.hover);
    expect(styles).toContain(LIGHT_THEME.selection);
    const plain = new Recorder();
    drawDisplay(plain, d, NO_UI, LIGHT_THEME, 1);
    const tail = (r: Recorder) => r.geometry().slice(-plain.geometry().length);
    expect(tail(rec)).toEqual(plain.geometry());
  });

  it('a refused view draws only the background and the reason', () => {
    const f = loadFigure(EXAMPLES[0]?.text ?? '', registry);
    const d = layout(f.scene, { viewport: { cx: 0, cy: 0, zoom: 0 }, size });
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
    expect(rec.geometry()).toEqual([]);
    expect(rec.calls.filter((c) => c[0] === 'fillText')[0]?.[1]).toMatch(/^Not drawn: .*zoom/);
  });

  it('labels: sub- and superscripts are smaller and shifted', () => {
    const d = displayOf('nine-point-circle');
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
    const texts = rec.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('M');
    expect(texts).toContain('a');
    const fonts = rec.calls.filter((c) => c[0] === 'set' && c[1] === 'font').map((c) => c[2]);
    expect(fonts).toContain(`15px ${LIGHT_THEME.fontFamily}`);
    expect(fonts).toContain(`11px ${LIGHT_THEME.fontFamily}`);
  });
});
