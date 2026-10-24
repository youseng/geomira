/**
 * A text's handle (its anchor, a radius-0 dot the canvas never paints: it is only what the
 * Move tool grabs) is not exported (ADR-0028). TikZ wrote `circle[radius=0bp]` and Asymptote
 * `gm_dot(…, 0, …)`, both with a paper-coloured outline: a speck on paper. The text itself
 * is its label, exported as before.
 */
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toTikz } from '../src/tikz';
import { frameOf, REGISTRY } from './helpers/figure';

const TEXT = `@version 1
A = (0, 0)
B = (4, 0)
t = text((1, 2), "the base")
`;

function section(text: string, name: string, comment: string): string[] {
  const lines = text.split('\n');
  const at = lines.indexOf(`${comment} ${name}`);
  const end = lines.findIndex((l, i) => i > at && l.startsWith(`${comment} `));
  return lines.slice(at + 1, end < 0 ? undefined : end);
}

describe("a text's handle in TikZ and Asymptote", () => {
  it('TikZ draws nothing for it, and writes the text', () => {
    const t = toTikz(frameOf(TEXT)).text;
    expect(t).not.toContain('radius=0bp');
    expect(section(t, 't', '%').filter((l) => /^\\(draw|filldraw|fill)\b/u.test(l))).toEqual([]);
    expect(t).toMatch(/\{the base\}; % label of t$/mu);
  });

  it('Asymptote draws nothing for it, and writes the text', () => {
    for (const dialect of ['standalone', 'aops'] as const) {
      const a = toAsymptote(frameOf(TEXT), REGISTRY, dialect).text;
      expect(a).not.toMatch(/gm_dot\([^)]*\), 0, /u);
      const drawn = section(a, 't', '//').filter((l) => /^(draw|fill|gm_dot)\(/u.test(l));
      expect(drawn.filter((l) => !l.startsWith('draw(box('))).toEqual([]);
      expect(a).toMatch(/^label\("the base", .*\/\/ label of t$/mu);
    }
  });
});
