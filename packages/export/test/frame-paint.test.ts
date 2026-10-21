import { describe, expect, it } from 'vitest';
import { fitViewport } from '@geomira/scene/viewport';
import { sceneBounds } from '@geomira/scene/bounds';
import { DEFAULT_SIZE, defaultView, exportFrame, FIT_MARGIN, MAX_EXPORT_SIDE } from '../src/frame';
import {
  EXPORT_THEME,
  num,
  paintOf,
  uniqueWarnings,
  warningText,
  type ExportWarning,
} from '../src/paint';
import { figure, frameOf } from './helpers/figure';

const TRI = '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\n';

describe('exportFrame', () => {
  it("without a view: the document's @viewport, else the figure fitted", () => {
    const f = frameOf(TRI);
    expect(f.view.size).toEqual(DEFAULT_SIZE);
    expect(f.view.viewport).toEqual(fitViewport(sceneBounds(f.scene), DEFAULT_SIZE, FIT_MARGIN));
    const g = frameOf(`${TRI}@viewport 1 2 30\n`);
    expect(g.view.viewport).toEqual({ cx: 1, cy: 2, zoom: 30 });
    expect(defaultView(g.doc, g.scene).viewport).toEqual({ cx: 1, cy: 2, zoom: 30 });
  });

  it('a given view is used as it is; theme and star default', () => {
    const view = { viewport: { cx: 0, cy: 0, zoom: 10 }, size: { width: 100, height: 50 } };
    const f = frameOf(TRI, { view, star: '\\ast' });
    expect(f.view).toBe(view);
    expect(f.theme).toBe(EXPORT_THEME);
    expect(f.star).toBe('\\ast');
  });

  it('refuses a view the scene refuses, and a surface above the export limit', () => {
    const { doc, values } = figure(TRI);
    const bad = exportFrame(doc, values, {
      view: { viewport: { cx: 0, cy: 0, zoom: 0 }, size: { width: 10, height: 10 } },
    });
    expect(bad).toEqual({ ok: false, problem: 'the viewport needs a finite centre and zoom > 0' });
    const big = exportFrame(doc, values, {
      view: {
        viewport: { cx: 0, cy: 0, zoom: 1 },
        size: { width: MAX_EXPORT_SIDE + 1, height: 10 },
      },
    });
    expect(big).toEqual({ ok: false, problem: 'an export is at most 8192 pixels wide and high' });
  });
});

describe('paint', () => {
  it("is the canvas's light theme", () => {
    expect(EXPORT_THEME).toEqual({
      ink: '#1b1f24',
      paper: '#fbfbf8',
      fillAlpha: 0.08,
      fontPx: 15,
      fontFamily:
        '"Geomira Math", "Latin Modern Roman", "CMU Serif", "Liberation Serif", "Times New Roman", serif',
    });
  });

  it('resolves colours with the layer opacity and the colour alpha; unreadable → ink + warning', () => {
    const ws: ExportWarning[] = [];
    expect(paintOf(null, 1, EXPORT_THEME, 'A', ws)).toEqual({ hex: '1B1F24', alpha: 1 });
    expect(paintOf('rgba(255,0,0,0.5)', 0.6, EXPORT_THEME, 'B', ws)).toEqual({
      hex: 'FF0000',
      alpha: 0.3,
    });
    expect(paintOf('bogus', 0.5, EXPORT_THEME, 'C', ws)).toEqual({ hex: '1B1F24', alpha: 0.5 });
    expect(ws).toEqual([{ kind: 'colour', object: 'C', colour: 'bogus' }]);
  });

  it('warnings read as sentences and are deduplicated', () => {
    const c: ExportWarning = { kind: 'character', object: 'A', char: 'é', codePoint: 0xe9 };
    expect(warningText(c)).toBe(
      'the label of A has a character TeX cannot write ("é", U+00E9): written as ?',
    );
    expect(uniqueWarnings([c, c, { kind: 'colour', object: 'A', colour: 'x' }])).toHaveLength(2);
  });

  it('num rounds and trims', () => {
    expect(num(1.5, 3)).toBe('1.5');
    expect(num(2, 3)).toBe('2');
    expect(num(-0.00001, 3)).toBe('0');
    expect(num(-1.23456, 2)).toBe('-1.23');
    expect(num(10, 0)).toBe('10');
  });
});
