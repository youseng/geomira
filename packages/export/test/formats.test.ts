import { describe, expect, it } from 'vitest';
import { baseName, exportAs, FORMATS, warningMessages } from '../src/formats';
import { frameOf, REGISTRY } from './helpers/figure';

const DOC =
  '@version 1\n@title "Euler line"\nA = (0, 0)\nB = (4, 0) [color=nope]\nt = text((1, 1), "ü")\n';

describe('exportAs (what the Export dialog calls)', () => {
  const f = frameOf(DOC);

  it.each([
    [{ format: 'svg' } as const, 'euler-line.svg', 'image/svg+xml'],
    [{ format: 'tikz', standalone: false } as const, 'euler-line.tikz.tex', 'text/x-tex'],
    [{ format: 'tikz', standalone: true } as const, 'euler-line.tex', 'text/x-tex'],
    [{ format: 'asy', dialect: 'standalone' } as const, 'euler-line.asy', 'text/plain'],
    [{ format: 'asy', dialect: 'aops' } as const, 'euler-line.aops.asy', 'text/plain'],
  ])('%j → %s', (choice, fileName, mime) => {
    const out = exportAs(f, choice, REGISTRY);
    expect(out.kind).toBe('text');
    expect(out.fileName).toBe(fileName);
    expect(out.mime).toBe(mime);
    expect(out.drawn).toEqual(f.display.items.map((i) => i.id));
  });

  it('PNG gives the raster plan', () => {
    const out = exportAs(f, { format: 'png', pixelRatio: 1 }, REGISTRY);
    expect(out.kind).toBe('png');
    expect(out.fileName).toBe('euler-line.png');
    if (out.kind === 'png') expect(out.plan.width).toBe(640);
  });

  it('the TeX formats report the characters and colours they could not write; SVG only colours', () => {
    const tex = warningMessages(exportAs(f, { format: 'tikz', standalone: true }, REGISTRY));
    expect(tex).toEqual([
      'the colour "nope" of B cannot be read: drawn in the default ink',
      'the label of t has a character TeX cannot write ("ü", U+00FC): written as ?',
    ]);
    expect(warningMessages(exportAs(f, { format: 'svg' }, REGISTRY))).toEqual([tex[0]]);
    expect(warningMessages(exportAs(f, { format: 'png', pixelRatio: 2 }, REGISTRY))).toEqual([]);
  });

  it('lists the formats in dialog order', () => {
    expect(FORMATS.map((x) => x.label)).toEqual(['SVG', 'PNG', 'TikZ', 'Asymptote']);
  });

  it('file names come from the title', () => {
    expect(baseName('Incenter–excenter lemma')).toBe('incenter-excenter-lemma');
    expect(baseName('Ünïcodé  ')).toBe('unicode');
    expect(baseName(undefined)).toBe('figure');
    expect(baseName('∠∡')).toBe('figure');
  });
});
