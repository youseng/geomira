import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as asy from '../src/asy';
import * as asyMap from '../src/asy-map';
import * as asyPlan from '../src/asy-plan';
import * as check from '../src/check';
import * as color from '../src/color';
import * as formats from '../src/formats';
import * as frame from '../src/frame';
import * as paint from '../src/paint';
import * as png from '../src/png';
import * as svg from '../src/svg';
import * as texLabel from '../src/tex-label';
import * as texText from '../src/tex-text';
import * as tikz from '../src/tikz';
import * as utf8 from '../src/utf8';

/** The public modules of @geomira/export (ADR-0002, ADR-0014) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './tex-text': {
    module: texText,
    names: ['MathBuilder', 'TEX_TABLE', 'joinTex', 'texEntry', 'texText'],
  },
  './tex-label': { module: texLabel, names: ['texLabel', 'texProse'] },
  './color': { module: color, names: ['hex6', 'parseCssColor'] },
  './paint': {
    module: paint,
    names: ['EXPORT_THEME', 'num', 'paintOf', 'uniqueWarnings', 'warningText'],
  },
  './frame': {
    module: frame,
    names: ['DEFAULT_SIZE', 'FIT_MARGIN', 'MAX_EXPORT_SIDE', 'defaultView', 'exportFrame'],
  },
  './svg': { module: svg, names: ['toSvg', 'xml'] },
  './tikz': { module: tikz, names: ['toTikz', 'toTikzStandalone'] },
  './asy': { module: asy, names: ['toAsymptote', 'toAsymptoteCheck'] },
  './asy-map': { module: asyMap, names: ['KIND_OF', 'mapExpr'] },
  './asy-plan': { module: asyPlan, names: ['exactNum', 'planAsy', 'typeOfValue'] },
  './check': { module: check, names: ['checkCoordinates', 'parseWrites'] },
  './png': {
    module: png,
    names: [
      'PNG_RATIOS',
      'crc32',
      'pngChunk',
      'pngChunks',
      'pngFigureText',
      'pngPlan',
      'pngWithMetadata',
    ],
  },
  './formats': { module: formats, names: ['FORMATS', 'baseName', 'exportAs', 'warningMessages'] },
  './utf8': { module: utf8, names: ['utf8Decode', 'utf8Encode'] },
};

describe('@geomira/export subpath surface', () => {
  it('package.json declares exactly the root and these subpaths', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
    for (const [sub, target] of Object.entries(pkg.exports))
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url))), sub).toBe(true);
  });

  for (const [sub, { module, names }] of Object.entries(SURFACE))
    it(`${sub} exports exactly ${names.join(', ')}`, () => {
      expect(Object.keys(module).sort()).toEqual([...names].sort());
    });
});
