import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as bounds from '../src/bounds';
import * as build from '../src/build';
import * as clip from '../src/clip';
import * as coincide from '../src/coincide';
import * as display from '../src/display';
import * as hit from '../src/hit';
import * as labelText from '../src/label-text';
import * as labels from '../src/labels';
import * as labelBox from '../src/label-box';
import * as style from '../src/style';
import * as types from '../src/types';
import * as viewport from '../src/viewport';

/** The public modules of @geomira/scene (ADR-0002, ADR-0010) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './viewport': {
    module: viewport,
    names: [
      'DEFAULT_VIEWPORT',
      'MAX_SURFACE',
      'MAX_ZOOM',
      'MIN_ZOOM',
      'PIXEL_ULPS',
      'fitViewport',
      'panViewport',
      'toScreen',
      'toWorld',
      'viewProblem',
      'worldRect',
      'zoomViewport',
    ],
  },
  './types': { module: types, names: [] },
  './build': { module: build, names: ['buildScene'] },
  './style': {
    module: style,
    names: [
      'CURVE_LABEL_DIST',
      'MAX_LABEL_DIST',
      'MAX_WIDTH',
      'POINT_LABEL_DIST',
      'POINT_RADIUS',
      'STROKE_WIDTH',
      'dashPattern',
      'drawStyle',
      'effectiveStyle',
      'labelOf',
      'zOf',
    ],
  },
  './coincide': { module: coincide, names: ['coincides', 'pointsCoincide'] },
  './clip': {
    module: clip,
    names: ['clipCircle', 'clipLine', 'clipPolygon', 'inside', 'intersectSpans', 'wrap'],
  },
  './label-text': { module: labelText, names: ['parseLabel'] },
  './labels': { module: labels, names: ['NEAR_PX', 'placeLabels'] },
  './label-box': {
    module: labelBox,
    names: ['LABEL_FONT_PX', 'LABEL_GAP_PX', 'MIN_CLEAR_DEG', 'boxesOverlap', 'labelBox'],
  },
  './display': { module: display, names: ['ARC_SAGITTA', 'MARGIN_PX', 'MAX_ARC_RADIUS', 'layout'] },
  './hit': { module: hit, names: ['HIT_RADIUS', 'hitItem', 'hitTest'] },
  './bounds': { module: bounds, names: ['sceneBounds'] },
};

describe('@geomira/scene subpath surface', () => {
  it('package.json exports exactly the root and these subpaths', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
  });

  it('each subpath file exists and exports exactly its names', () => {
    for (const [path, { module, names }] of Object.entries(SURFACE)) {
      const file = (pkg.exports as Record<string, string>)[path] ?? '';
      expect(existsSync(fileURLToPath(new URL(`../${file}`, import.meta.url))), path).toBe(true);
      expect(Object.keys(module).sort(), path).toEqual([...names].sort());
    }
  });
});
