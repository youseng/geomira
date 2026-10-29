/**
 * Conics in the exports (Run 16b, ADR-0042), on tests/fixtures/export/conics.geo (compiled and
 * coordinate-checked by tex.yml): SVG, TikZ and Asymptote draw only the visible part, a
 * hyperbola's branches as separate paths, numerically and inside the clip; the PNG plan draws
 * the same objects; golden snapshots of every format.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { pngPlan } from '../src/png';
import { toSvg } from '../src/svg';
import { toTikz, toTikzStandalone } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const TEXT = readFileSync('tests/fixtures/export/conics.geo', 'utf8');
const f = frameOf(TEXT);

/** The lines after a `<comment> name` header up to the next header (TikZ and Asymptote). */
function section(text: string, comment: string, name: string): string[] {
  const lines = text.split('\n');
  const start = lines.indexOf(`${comment} ${name}`);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith(`${comment} `));
  return end < 0 ? rest : rest.slice(0, end);
}

/** The (x, y) pairs of a TikZ or Asymptote path line. */
function pairs(line: string): [number, number][] {
  return [...line.matchAll(/\((-?[\d.e+-]+),\s*(-?[\d.e+-]+)\)/gu)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

describe('conics in the exports', () => {
  it('SVG: the hyperbola h is two polylines, the ellipse e one closed polygon', () => {
    const svg = toSvg(f).text;
    const group = (name: string) =>
      svg.split('<g data-id=').find((g) => g.includes(`data-name="${name}"`)) ?? '';
    expect(group('h').match(/<polyline /gu)).toHaveLength(2);
    expect(group('e').match(/<polygon /gu)).toHaveLength(1);
    expect(group('q').match(/<polyline /gu)).toHaveLength(1);
  });

  it('TikZ and Asymptote: one draw per branch, numeric, inside the clip and its margin', () => {
    const tikz = section(toTikz(f).text, '%', 'h').filter((l) => l.startsWith('\\draw'));
    expect(tikz).toHaveLength(2);
    for (const dialect of ['standalone', 'aops'] as const) {
      const asy = toAsymptote(f, REGISTRY, dialect).text;
      const draws = section(asy, '//', 'h').filter((l) => l.startsWith('draw('));
      expect(draws).toHaveLength(2);
      expect(asy).not.toMatch(/path h\b/u);
    }
    const [x0, y0, x1, y1] = [f.view.viewport.cx, f.view.viewport.cy, 0, 0];
    const half = {
      x: f.view.size.width / 2 / f.view.viewport.zoom,
      y: f.view.size.height / 2 / f.view.viewport.zoom,
    };
    for (const line of tikz)
      for (const [x, y] of pairs(line)) {
        expect(Math.abs(x - x0)).toBeLessThan(half.x * 1.2 + x1 + 1);
        expect(Math.abs(y - y0)).toBeLessThan(half.y * 1.2 + y1 + 1);
      }
  });

  it('the PNG plan draws the conics too', () => {
    const ids = new Map(f.scene.primitives.map((p) => [p.id, p.name]));
    const drawn = pngPlan(f).drawn.map((id) => ids.get(id));
    for (const n of ['e', 'h', 'q', "w'"]) expect(drawn).toContain(n);
  });

  it('golden snapshots', async () => {
    const dir = './__snapshots__/fixture-conics';
    await expect(toSvg(f).text).toMatchFileSnapshot(`${dir}/figure.svg`);
    await expect(toTikz(f).text).toMatchFileSnapshot(`${dir}/snippet.tikz.tex`);
    await expect(toTikzStandalone(f).text).toMatchFileSnapshot(`${dir}/standalone.tex`);
    await expect(toAsymptote(f, REGISTRY, 'standalone').text).toMatchFileSnapshot(
      `${dir}/standalone.asy`,
    );
    await expect(toAsymptote(f, REGISTRY, 'aops').text).toMatchFileSnapshot(`${dir}/aops.asy`);
  });
});
