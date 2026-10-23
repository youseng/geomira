/**
 * A dashed polygon's dash pattern restarts at every vertex in Asymptote, as on the canvas and
 * in TikZ, which stroke each edge as its own path (ADR-0028). Drawn as one cyclic path, the
 * pattern ran on around the corners. A solid polygon is drawn as before, in one statement.
 */
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const figure = (style: string) => `@version 1
A = (0, 0)
B = (4, 0)
C = (1, 3)
t = polygon(A, B, C)${style}
`;

function section(text: string): string[] {
  const lines = text.split('\n');
  const at = lines.indexOf('// t');
  const end = lines.findIndex((l, i) => i > at && l.startsWith('// '));
  return lines.slice(at + 1, end < 0 ? undefined : end);
}

describe('a dashed polygon in Asymptote', () => {
  for (const dash of ['dashed', 'dotted'])
    it(`${dash}: each edge is drawn on its own`, () => {
      const f = frameOf(figure(` [dash=${dash}]`));
      for (const dialect of ['standalone', 'aops'] as const) {
        const lines = section(toAsymptote(f, REGISTRY, dialect).text);
        expect(lines).not.toContainEqual(expect.stringMatching(/^draw\(t, /u));
        expect(lines).toContainEqual(
          expect.stringMatching(
            /^for \(int i = 0; i < length\(t\); \+\+i\) draw\(subpath\(t, i, i \+ 1\), .*linetype/u,
          ),
        );
      }
      // TikZ strokes the three edges separately, as the canvas does.
      const tikz = toTikz(f).text.split('\n');
      const at = tikz.indexOf('% t');
      expect(tikz.slice(at + 1, at + 4).every((l) => l.startsWith('\\draw['))).toBe(true);
    });

  it('a solid polygon is one draw of its path', () => {
    const lines = section(toAsymptote(frameOf(figure('')), REGISTRY, 'standalone').text);
    expect(lines).toContainEqual(expect.stringMatching(/^draw\(t, gmc\d+ \+ linewidth/u));
  });
});
