/**
 * Points at infinity in the scene and in every export (ADR-0040 decision 5): defined, never
 * drawn and never given coordinates; the scene lists them apart from Undefined objects, with
 * their direction; every format lists them as a warning naming the direction (a `Warning`
 * comment in TikZ and Asymptote). A line through a point at infinity (the parallel it is) is
 * drawn; Asymptote keeps its coordinates (`// numeric`).
 */
import { describe, expect, it } from 'vitest';
import { buildScene } from '@geomira/scene/build';
import { exportAs, warningMessages, type ExportChoice } from '../src/formats';
import { frameOf, figure, REGISTRY } from './helpers/figure';

const TEXT = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'X = intersect(line(A, B), parallel(C, line(A, B)))',
  'm = line(C, X)',
  'Y = harmonic_conjugate(A, C, midpoint(A, C))',
  'Z = harmonic_conjugate(A, B, (3, 0))',
].join('\n');

const CHOICES: readonly ExportChoice[] = [
  { format: 'svg' },
  { format: 'png', pixelRatio: 1 },
  { format: 'tikz', standalone: false },
  { format: 'tikz', standalone: true },
  { format: 'asy', dialect: 'standalone' },
  { format: 'asy', dialect: 'aops' },
];

describe('points at infinity', () => {
  it('the scene lists them with their direction, apart from Undefined objects', () => {
    const f = figure(TEXT);
    const scene = buildScene(f.doc, f.values);
    const at = scene.unavailable.filter((u) => u.atInfinity === true);
    expect(at.map((u) => [u.name, u.reason])).toEqual([
      ['X', 'at infinity, direction 0°'],
      ['Y', 'at infinity, direction 71.57°'],
    ]);
    expect(scene.unavailable.filter((u) => u.atInfinity !== true)).toEqual([]);
  });

  for (const choice of CHOICES)
    it(`${JSON.stringify(choice)}: listed as warnings with the direction, not drawn`, () => {
      const f = frameOf(TEXT);
      const out = exportAs(f, choice, REGISTRY);
      expect(warningMessages(out)).toEqual([
        'X is a point at infinity (direction 0°): not drawn',
        'Y is a point at infinity (direction 71.57°): not drawn',
      ]);
      const id = (n: string) => f.doc.objects.find((o) => o.name === n)?.id ?? -1;
      expect(out.drawn).not.toContain(id('X'));
      expect(out.drawn).not.toContain(id('Y'));
      for (const n of ['m', 'Z']) expect(out.drawn).toContain(id(n));
      if (out.kind === 'text') expect(out.text).not.toMatch(/NaN|Infinity/u);
    });

  it('Asymptote declares no point at infinity; the line through one keeps its coordinates', () => {
    const out = exportAs(frameOf(TEXT), { format: 'asy', dialect: 'standalone' }, REGISTRY);
    const text = out.kind === 'text' ? out.text : '';
    expect(text).not.toMatch(/^(pair|path|gmline) [XY] =/mu);
    expect(text).toMatch(/^gmline m = .*\/\/ numeric$/mu);
    expect(text).toContain('// Warning: X is a point at infinity (direction 0°): not drawn');
  });
});
