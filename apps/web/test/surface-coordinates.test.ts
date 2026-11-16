import { describe, expect, it } from 'vitest';
import { layout } from '@geomira/scene/display';
import { clientPoint, logicalPoint } from '../src/surface-coordinates';
import { drawDisplay, drawPreview, LIGHT_THEME, NO_UI } from '../src/render';
import { loadFigure } from '../src/figure';
import { Recorder, registry } from './helpers';

describe('fractional CSS boxes and logical/raster canvas coordinates', () => {
  it('projects pointer positions and inverse anchors through the actual fractional CSS rectangle', () => {
    const box = { left: 104.4, top: 104.4, width: 855.65, height: 533.583374 };
    const size = { width: 856, height: 534 };
    const center = { x: 428, y: 267 };
    const css = clientPoint(center, box, size);
    expect(css).toEqual({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    expect(logicalPoint(css, box, size)).toEqual(center);
    const actual = logicalPoint({ x: 532, y: 371 }, box, size);
    expect(actual?.x).toBe(((532 - box.left) * 856) / box.width);
    expect(actual?.y).toBe(((371 - box.top) * 534) / box.height);
    expect(logicalPoint(css, { ...box, width: 0 }, size)).toBeNull();
  });
  it('rasterizes both figure and preview with independently rounded backing dimensions', () => {
    const size = { width: 641, height: 481 };
    const f = loadFigure('A=(0,0)\nB=(1,0)\nl=line(A,B)', registry);
    const display = layout(f.scene, { viewport: { cx: 0, cy: 0, zoom: 50 }, size });
    const scale = {
      x: Math.round(size.width * 1.25) / size.width,
      y: Math.round(size.height * 1.25) / size.height,
    };
    const main = new Recorder(),
      preview = new Recorder();
    drawDisplay(main, display, NO_UI, LIGHT_THEME, scale);
    drawPreview(preview, display, LIGHT_THEME, scale);
    expect(main.calls[0]).toEqual(['setTransform', scale.x, 0, 0, scale.y, 0, 0]);
    expect(preview.calls[0]).toEqual(['setTransform', scale.x, 0, 0, scale.y, 0, 0]);
    expect(scale.x).not.toBe(scale.y);
  });
});
