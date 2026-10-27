/**
 * ADR-0035 decision 16: the objects of a hovered fact are ringed on the canvas, in the hover
 * colour, each of them and nothing else; the figure itself is drawn unchanged under the rings.
 */
import { describe, expect, it } from 'vitest';
import { layout, type DisplayList } from '@geomira/scene/display';
import { EXAMPLES } from '../src/examples';
import { loadFigure, viewportFor } from '../src/figure';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../src/render';
import { Recorder, registry } from './helpers';

const size = { width: 640, height: 480 };

function displayOf(id: string): DisplayList {
  const f = loadFigure(EXAMPLES.find((e) => e.id === id)?.text ?? '', registry);
  return layout(f.scene, { viewport: viewportFor(f, size), size });
}

/** How many halos a frame draws in the hover colour. */
function hoverHalos(rec: Recorder): number {
  return rec.calls.filter(
    (c) => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === LIGHT_THEME.hover,
  ).length;
}

describe('the rings of a hovered fact', () => {
  it('rings every object of the fact in the hover colour, and only those', () => {
    const d = displayOf('euler-line');
    const ids = d.items.slice(0, 3).map((x) => x.id);
    const rec = new Recorder();
    drawDisplay(rec, d, { ...NO_UI, highlight: new Set(ids) }, LIGHT_THEME, 1);
    expect(hoverHalos(rec)).toBe(ids.length);
    const none = new Recorder();
    drawDisplay(none, d, { ...NO_UI, highlight: new Set() }, LIGHT_THEME, 1);
    expect(hoverHalos(none)).toBe(0);
  });

  it('the figure is drawn unchanged under the rings', () => {
    const d = displayOf('euler-line');
    const rec = new Recorder();
    drawDisplay(rec, d, { ...NO_UI, highlight: new Set([d.items[0]?.id ?? -1]) }, LIGHT_THEME, 1);
    const plain = new Recorder();
    drawDisplay(plain, d, NO_UI, LIGHT_THEME, 1);
    expect(rec.geometry().slice(-plain.geometry().length)).toEqual(plain.geometry());
  });
});
