/**
 * Note B of Run 9a: mark_angle (arc count, right-angle style), mark_right, mark_segment
 * (ticks) and text are exported in every format, and so are their images in derived layers.
 */
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toSvg } from '../src/svg';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const DOC = `@version 1
@layer refl = image(s, main) [opacity=0.5]
A = (0, 0)
B = (4, 0)
C = (0, 3)
a1 = mark_angle(B, A, C, 2)
a2 = mark_angle(A, B, C, 3)
r = mark_right(B, A, C)
m = mark_segment(A, B, 2)
n = mark_segment(B, C, 3)
t = text((2, 2), "Hello \\\\omega")
s = reflect(line(A, (1, -6)))
`;

/** The lines of one object's section (from its marker to the next marker). */
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

describe('display values in every format (note B)', () => {
  const f = frameOf(DOC);
  const svg = toSvg(f).text;
  const tikz = toTikz(f).text;
  const asy = toAsymptote(f, REGISTRY, 'standalone').text;

  for (const name of ['a1', 'a2', 'r', 'm', 'n', 'a1*', 'a2*', 'r*', 'm*', 'n*']) {
    it(`${name}: as many strokes as the canvas draws`, () => {
      const item = f.display.items.find((i) => i.name === name);
      expect(item).toBeDefined();
      const strokes = item?.paths.length ?? 0;
      // mark_angle(…, 2): two arcs; (…, 3): three; mark_right: one square; ticks: 2 and 3.
      const expected = { a1: 2, a2: 3, r: 1, m: 2, n: 3 }[name.replace('*', '') as 'a1'];
      expect(strokes).toBe(expected);
      expect(svgGroup(svg, name).match(/<(path|polyline|polygon) /gu)?.length).toBe(strokes);
      expect(section(tikz, `% ${name}`).filter((l) => l.startsWith('\\draw')).length).toBe(strokes);
      expect(section(asy, `// ${name}`).filter((l) => l.startsWith('draw(')).length).toBe(strokes);
    });
  }

  it('angle marks are arcs; the right-angle mark is a square corner (a polyline)', () => {
    expect(svgGroup(svg, 'a1')).toContain('<path d="M');
    expect(svgGroup(svg, 'r')).toContain('<polyline');
    expect(section(tikz, '% a1').every((l) => l.includes(' arc['))).toBe(true);
    expect(section(tikz, '% r')[0]).toMatch(/^\\draw\[.*\] \(.*\) -- \(.*\) -- \(.*\);$/u);
    expect(section(asy, '// a2').every((l) => l.startsWith('draw(arc('))).toBe(true);
  });

  it('a text is exported as its label (and its image too)', () => {
    expect(svg).toContain('Hello ω</tspan>');
    expect(tikz).toContain('{Hello $\\omega$}; % label of t');
    expect(tikz).toContain('{Hello $\\omega$}; % label of t*');
    expect(asy).toContain('label("Hello $\\omega$", (2, 2), (0, 0), gmc0); // label of t');
  });

  it('images of marks take the derived layer opacity', () => {
    expect(svgGroup(svg, 'a1*')).toContain('stroke-opacity="0.5"');
    expect(section(tikz, '% m*')[0]).toContain('draw opacity=0.5');
    expect(section(asy, '// n*')[0]).toContain('opacity(0.5)');
  });
});
