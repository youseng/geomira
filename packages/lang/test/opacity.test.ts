import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findObjectByName, type Style } from '@geomira/kernel/document';
import { canonicalDocument, stable } from '../src/canonical';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { firstError, parseOk, registry } from './helpers/lang';

/** ADR-0029: the per-object style attribute `opacity` in [0, 1] (absent = 1). */
describe('the style attribute opacity (ADR-0029)', () => {
  it('parses on definitions and style lines and prints back on the definition', () => {
    const t = [
      '@version 1',
      'A = (0, 0) [color=red, opacity=0.5]',
      'B = (1, 0)',
      'l = line(A, B) [opacity=0]',
      'style B [opacity=1]',
      '',
    ].join('\n');
    const doc = parseOk(t);
    expect(findObjectByName(doc, 'A')?.style).toEqual({ color: 'red', opacity: 0.5 });
    expect(findObjectByName(doc, 'B')?.style).toEqual({ opacity: 1 });
    expect(findObjectByName(doc, 'l')?.style).toEqual({ opacity: 0 });
    expect(print(doc)).toBe(
      [
        '@version 1',
        'A = (0, 0) [color=red, opacity=0.5]',
        'B = (1, 0) [opacity=1]',
        'l = line(A, B) [opacity=0]',
        '',
      ].join('\n'),
    );
  });

  it('prints after dash and before hidden, with the other keys in their order', () => {
    const t = '@version 1\nA = (0, 0) [color=blue, width=2, dash=dashed, opacity=0.25, hidden]\n';
    expect(print(parseOk(t))).toBe(t);
  });

  it('a style without opacity prints as before (no attribute)', () => {
    const t = '@version 1\nA = (0, 0) [color=red]\n';
    expect(print(parseOk(t))).toBe(t);
    expect(findObjectByName(parseOk(t), 'A')?.style.opacity).toBeUndefined();
  });

  it('images take it through style lines', () => {
    const t = [
      '@version 1',
      '@layer r = image(s, main)',
      'A = (1, 2)',
      'B = (0, 0)',
      'C = (1, 0)',
      's = reflect(line(B, C))',
      'style A* [opacity=0.3]',
      '',
    ].join('\n');
    const doc = parseOk(t);
    expect(findObjectByName(doc, 'A*')?.style).toEqual({ opacity: 0.3 });
    expect(print(doc)).toBe(t);
  });

  it('a value outside [0, 1], a non-number or a repeated key is an error with a hint', () => {
    expect(firstError('A = (0, 0) [opacity=1.5]').message).toBe(
      '"opacity" takes a number in [0, 1]',
    );
    expect(firstError('A = (0, 0) [opacity=-0.1]').message).toBe(
      '"opacity" takes a number in [0, 1]',
    );
    expect(firstError('A = (0, 0) [opacity=half]').message).toBe(
      '"opacity" takes a number in [0, 1]',
    );
    expect(firstError('A = (0, 0)\nstyle A [opacity]').message).toContain('one value');
    expect(firstError('A = (0, 0) [opacity=1, opacity=0]').message).toContain('given twice');
  });

  it('an unknown key still lists opacity among the keys a definition takes', () => {
    expect(firstError('A = (0, 0) [alpha=0.5]').hint).toContain('opacity');
    expect(firstError('A = (0, 0)\nstyle A [alpha=0.5]').hint).toContain('opacity');
  });

  it('P1 and P2 on every opacity in [0, 1] (with other style fields)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom<Style>({}, { color: 'red' }, { width: 2, label: 'x' }, { hidden: true }),
        (opacity, rest) => {
          const doc = parseOk('@version 1\nA = (0, 0)\nl = line(A, (1, 1))\n');
          const styled = {
            ...doc,
            objects: doc.objects.map((o) => ({ ...o, style: { ...rest, opacity } })),
          };
          const text = print(styled);
          const back = parse(text, registry);
          expect(back.diagnostics).toEqual([]);
          expect(stable(canonicalDocument(back.doc))).toBe(stable(canonicalDocument(styled)));
          for (const o of back.doc.objects) expect(o.style.opacity).toBe(opacity);
          expect(print(back.doc)).toBe(text);
        },
      ),
      { seed: 29, numRuns: 300 },
    );
  });
});
