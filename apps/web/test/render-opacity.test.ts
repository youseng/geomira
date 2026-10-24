/**
 * ADR-0029: the canvas (and so the PNG export, drawn by the same renderer) draws an object's
 * own opacity times its layer's: strokes, dots, polygon fills and labels.
 */
import { describe, expect, it } from 'vitest';
import { layout } from '@geomira/scene/display';
import { loadFigure, viewportFor } from '../src/figure';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../src/render';
import { Recorder, registry } from './helpers';

const size = { width: 640, height: 480 };

/** The globalAlpha values set while drawing the text's figure. */
function alphas(text: string): number[] {
  const f = loadFigure(`@version 1\n${text}\n`, registry);
  const rec = new Recorder();
  drawDisplay(
    rec,
    layout(f.scene, { viewport: viewportFor(f, size), size }),
    NO_UI,
    LIGHT_THEME,
    1,
  );
  return rec.calls.filter((c) => c[0] === 'set' && c[1] === 'globalAlpha').map((c) => Number(c[2]));
}

describe('the canvas draws the style opacity (ADR-0029)', () => {
  it("a point, a polygon's edges and its fill take their own opacity", () => {
    const a = alphas(
      'A = (0, 0) [opacity=0.5]\nB = (4, 0) [label=""]\nC = (1, 3) [label=""]\nt = polygon(A, B, C) [color=red, opacity=0.25]',
    );
    expect(a).toContain(0.5);
    expect(a).toContain(0.25);
    expect(a).toContain(0.25 * LIGHT_THEME.fillAlpha);
  });

  it('it multiplies the layer opacity; without it nothing changes', () => {
    const layered = alphas('@layer faint [opacity=0.5]\nA = (0, 0) [opacity=0.5] [layers=faint]');
    expect(layered).toContain(0.25);
    expect(alphas('A = (0, 0)\nB = (1, 1)')).toEqual(alphas('A = (0, 0) [opacity=1]\nB = (1, 1)'));
  });
});
