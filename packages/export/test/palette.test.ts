import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toSvg } from '../src/svg';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

/** ADR-0016 decision 20: every format draws named colours in Geomdraw's palette, and polygons as outlines. */

const FIG = `A = (0, 0)
B = (4, 0)
C = (1, 3) [color=green]
p = polygon(A, B, C)
q = polygon(A, B, C) [color=red]
l = line(A, B) [color=blue]
m = segment(B, C) [color="#FF0000"]
`;

describe('named colours and polygon outlines in the exports', () => {
  const f = frameOf(FIG);
  const svg = toSvg(f).text;
  const tikz = toTikz(f).text;
  const asy = toAsymptote(f, REGISTRY, 'standalone').text;

  it('named colours are the palette hex in every format; hex colours as written', () => {
    for (const hex of ['1F6FD1', 'B3261E', '2E7D32', 'FF0000']) {
      expect(svg, hex).toContain(`#${hex}`);
      expect(tikz, hex).toContain(`{HTML}{${hex}}`);
    }
    for (const hex of ['1f6fd1', 'b3261e', '2e7d32', 'ff0000'])
      expect(asy.toLowerCase(), hex).toContain(hex);
  });

  it('only the coloured polygon is filled', () => {
    expect(svg.match(/<polygon /gu)).toHaveLength(1);
    expect(svg).toMatch(/<polygon [^>]*fill="#B3261E"/u);
    expect(tikz.match(/\\fill\[/gu)).toHaveLength(1);
    expect(asy.match(/^fill\(/gmu)).toHaveLength(1);
  });
});
