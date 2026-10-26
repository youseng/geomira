/**
 * Images under an inversion in the exports (Run 14, ADR-0032 decision 15): the fixture
 * tests/fixtures/export/inversion.geo (compiled and coordinate-checked by tex.yml). A Möbius map
 * is not an Asymptote transform, so it gets no variable and its images are numeric; the two
 * rays (the image of a segment through the center) get no gmline either and are drawn from the
 * display list, piece by piece, in every format; arcs are drawn as the arc only (ADR-0031);
 * the undefined images (the center, the polygon) are listed as warnings, never placed.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toSvg } from '../src/svg';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const TEXT = readFileSync('tests/fixtures/export/inversion.geo', 'utf8');

describe('inversion images in the exports (ADR-0032)', () => {
  const f = frameOf(TEXT);
  const asy = toAsymptote(f, REGISTRY, 'standalone');

  it('the Möbius map has no Asymptote variable; images are numeric', () => {
    expect(asy.text).not.toMatch(/^transform f\b/mu);
    expect(asy.text).toMatch(/^pair Qs = \(.*\); \/\/ numeric$/mu);
    expect(asy.text).toMatch(/^gmline oqs = gm_mkline\(.*true, .*false, 0\); \/\/ numeric$/mu);
  });

  it('the two rays get no gmline and are drawn as two pieces in every format', () => {
    expect(asy.text).not.toMatch(/^gmline pts\b/mu);
    const item = f.display.items.find((i) => i.name === 'pt*');
    expect(item?.paths.length).toBe(2);
    const block = asy.text.split('// pt*\n')[1]?.split('\n// ')[0] ?? '';
    expect(block.match(/^draw\(/gmu)?.length).toBe(2);
    // Brown (#8d5a3b) is pt (one stroke) and its image pt* (two strokes, inherited style).
    expect(toSvg(f).text.match(/#8d5a3b/giu)?.length).toBe(3);
    expect(toTikz(f).text).toContain('% pt*');
  });

  it('arcs are drawn as the arc only, and undefined images are listed', () => {
    const arc = f.display.items.find((i) => i.name === 'pq*');
    expect(arc?.paths.every((p) => p.kind === 'arc')).toBe(true);
    expect(asy.warnings.map((w) => w.kind === 'undefined' && w.object)).toEqual(['O*', 'tri*']);
    expect(asy.text).toContain('// Warning: tri* is undefined in this figure');
  });
});
