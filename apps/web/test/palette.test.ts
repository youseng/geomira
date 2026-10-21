import { describe, expect, it } from 'vitest';
import { exportFrame } from '@geomira/export/frame';
import { toSvg } from '@geomira/export/svg';
import { layout } from '@geomira/scene/display';
import { loadFigure, viewportFor } from '../src/figure';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../src/render';
import { Recorder, registry } from './helpers';

/** ADR-0016 decision 20: the canvas and the exports draw named colours with the same hex. */

const TEXT = `A = (0, 0)
B = (4, 0)
C = (1, 3) [color=green]
p = polygon(A, B, C) [color=purple]
l = line(A, B) [color=blue]
m = segment(B, C) [color="Red"]
k = circle(A, B, C) [color="#FF0000"]
`;

const size = { width: 640, height: 480 };

describe('named colours: canvas and export agree', () => {
  it('the canvas sets the palette hex; the SVG writes the same colours', () => {
    const f = loadFigure(TEXT, registry);
    expect(f.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const view = { viewport: viewportFor(f, size), size };
    const d = layout(f.scene, view);
    const rec = new Recorder();
    drawDisplay(rec, d, NO_UI, LIGHT_THEME, 1);
    const theme = new Set([LIGHT_THEME.foreground, LIGHT_THEME.background]);
    const canvas = new Set(
      rec.calls
        .filter((c) => c[0] === 'set' && (c[1] === 'strokeStyle' || c[1] === 'fillStyle'))
        .map((c) => String(c[2]))
        .filter((c) => !theme.has(c))
        .map((c) => c.toUpperCase()),
    );
    expect([...canvas].sort()).toEqual(['#1F6FD1', '#2E7D32', '#7B3FA0', '#B3261E', '#FF0000']);
    const frame = exportFrame(f.doc, f.evaluation.values, { view });
    if (!frame.ok) throw new Error(frame.problem);
    const svg = new Set(
      [...toSvg(frame.frame).text.matchAll(/(?:stroke|fill)="(#[0-9A-Fa-f]{6})"/gu)]
        .map((m) => (m[1] ?? '').toUpperCase())
        .filter((c) => ![...theme].some((t) => t.toUpperCase() === c)),
    );
    expect([...svg].sort()).toEqual([...canvas].sort());
  });
});
