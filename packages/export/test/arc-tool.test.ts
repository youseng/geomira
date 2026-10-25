/**
 * arc(A, B, C) (Run 13, ADR-0031) in every format: SVG, TikZ, Asymptote and the PNG plan
 * (which the app draws with the canvas renderer) draw ONLY the arc, from its ends, with the
 * style card's attributes (colour, width, dash, opacity); the mirror image in a derived layer
 * is the reflected arc.
 */
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { pngPlan } from '../src/png';
import { toSvg } from '../src/svg';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const DOC = `@version 1
@layer refl = image(s, main)
A = (4, 0)
B = (0, 4)
C = (-4, 0)
a = arc(A, B, C) [color=red, width=2, dash=dashed, opacity=0.5]
b = arc(C, (0, -4), (0, 4))
s = reflect(line((-6, -6), (6, -6)))
`;

function section(src: string, marker: string): string[] {
  const lines = src.split('\n');
  const i = lines.indexOf(marker);
  if (i < 0) return [];
  const rest = lines.slice(i + 1);
  const end = rest.findIndex((l) => /^(%|\/\/) /u.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

function svgGroup(svg: string, name: string): string {
  const m = new RegExp(
    `<g data-id="\\d+" data-name="${name.replace('*', '\\*')}">([\\s\\S]*?)</g>`,
    'u',
  ).exec(svg);
  return m?.[1] ?? '';
}

describe('arc(A, B, C) draws only its arc in every format', () => {
  const f = frameOf(DOC);
  const svg = toSvg(f).text;
  const tikz = toTikz(f).text;
  const asy = toAsymptote(f, REGISTRY, 'standalone').text;

  it('the display list (canvas and PNG) holds only arc pieces, spanning the arc, not the circle', () => {
    const span = (name: string) =>
      (f.display.items.find((i) => i.name === name)?.paths ?? []).reduce(
        (sum, p) => sum + (p.kind === 'arc' ? p.to - p.from : Number.NaN),
        0,
      );
    for (const name of ['a', 'b', 'a*', 'b*']) {
      const item = pngPlan(f).display.items.find((i) => i.name === name);
      expect(item?.paths.length).toBeGreaterThan(0);
      expect(item?.paths.every((p) => p.kind === 'arc')).toBe(true);
    }
    const a = f.display.items.find((i) => i.name === 'a')?.paths;
    // From (4, 0) counter-clockwise through (0, 4) to (−4, 0): half a turn, starting at 0.
    expect(a?.length === 1 && a[0]?.kind === 'arc' && [a[0].from, a[0].to]).toEqual([0, Math.PI]);
    // (−4, 0), (0, −4), (0, 4) turn counter-clockwise: the arc runs from angle π through the
    // bottom and angle 0 (laid out in two pieces there) to π/2: three quarters of a turn.
    expect(span('b')).toBeCloseTo(1.5 * Math.PI, 12);
    expect(span('a*')).toBeCloseTo(Math.PI, 12);
    expect(span('b*')).toBeCloseTo(span('b'), 12);
  });

  it('SVG: one path with an elliptical-arc command, no circle element, the style applied', () => {
    const g = svgGroup(svg, 'a');
    expect(g).not.toContain('<circle');
    expect(g.match(/<path /gu)?.length).toBe(1);
    expect(g).toMatch(/d="M[^"]* A[^"]*"/u);
    expect(g).toContain('stroke-dasharray=');
    expect(g).toContain('stroke-opacity="0.5"');
    expect(g.toLowerCase()).toContain('#b3261e');
    // Half a turn: one piece, counter-clockwise as seen (sweep flag 0), not the large arc.
    expect(g).toMatch(/ A[\d.]+ [\d.]+ 0 0 0 /u);
    expect(svgGroup(svg, 'b')).not.toContain('<circle');
  });

  it('TikZ: one \\draw with arc[start angle, end angle], no circle', () => {
    const draws = section(tikz, '% a').filter((l) => l.startsWith('\\draw'));
    expect(draws).toHaveLength(1);
    expect(draws[0]).toContain(' arc[start angle=0, end angle=180,');
    expect(draws[0]).not.toContain('circle');
    expect(draws[0]).toContain('dash pattern=');
  });

  it('Asymptote: draw(arc(…)) from the display list, never draw(circle(…))', () => {
    for (const name of ['a', 'b', 'a*', 'b*']) {
      const draws = section(asy, `// ${name}`).filter((l) => l.startsWith('draw('));
      expect(draws.length).toBeGreaterThan(0);
      expect(draws.every((l) => l.startsWith('draw(arc('))).toBe(true);
    }
  });

  it('the mirror image is the reflected arc (an anti-similarity reverses its ends)', () => {
    // a reflected in y = −6: the lower half of the circle about (0, −12), from (−4, −12) to
    // (4, −12) counter-clockwise, i.e. from angle π to 2π.
    const img = f.display.items.find((i) => i.name === 'a*')?.paths[0];
    expect(img?.kind === 'arc' && [img.from, img.to].map((x) => x / Math.PI)).toEqual([1, 2]);
  });
});
