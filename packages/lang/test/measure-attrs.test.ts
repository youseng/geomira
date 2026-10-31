import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { findObjectByName, type Style } from '@geomira/kernel/document';
import { canonicalDocument, stable } from '../src/canonical';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { firstError, parseOk, registry } from './helpers/lang';

/**
 * ADR-0048: measurements are visible. Two style attributes: `show` (a flag, as `hidden`:
 * `show`, `show=true`, `show=false`) draws a measurement's value on the figure, and
 * `digits=N` (a whole number from 0 to 10) is how many decimals its value shows (absent: 2).
 */
describe('the style attributes show and digits (ADR-0048)', () => {
  it('parse on definitions and style lines and print back on the definition, after label_dist', () => {
    const t = [
      '@version 1',
      'A = (0, 0)',
      'B = (3, 4)',
      'C = (0, 4)',
      'd = dist(A, B) [show, digits=3]',
      'e = angle(A, C, B) [color=red, label_angle=30, label_dist=12, show]',
      'f = dist(B, C) [show=false]',
      'g = dist(A, C)',
      'style g [digits=0]',
      '',
    ].join('\n');
    const doc = parseOk(t);
    expect(findObjectByName(doc, 'd')?.style).toEqual({ show: true, digits: 3 });
    expect(findObjectByName(doc, 'e')?.style).toEqual({
      color: 'red',
      labelAngle: 30,
      labelDist: 12,
      show: true,
    });
    expect(findObjectByName(doc, 'f')?.style).toEqual({ show: false });
    expect(findObjectByName(doc, 'g')?.style).toEqual({ digits: 0 });
    expect(print(doc)).toBe(
      [
        '@version 1',
        'A = (0, 0)',
        'B = (3, 4)',
        'C = (0, 4)',
        'd = dist(A, B) [show, digits=3]',
        'e = angle(A, C, B) [color=red, label_angle=30, label_dist=12, show]',
        'f = dist(B, C) [show=false]',
        'g = dist(A, C) [digits=0]',
        '',
      ].join('\n'),
    );
  });

  it('a text without them prints as before, and their absence is the default style', () => {
    const t = '@version 1\nA = (0, 0)\nB = (1, 0)\nd = dist(A, B)\n';
    expect(print(parseOk(t))).toBe(t);
    expect(findObjectByName(parseOk(t), 'd')?.style).toEqual({});
  });

  it('show=true parses as show; show is accepted on any object (the scene draws numbers only)', () => {
    const doc = parseOk('@version 1\nA = (0, 0) [show=true]\n');
    expect(findObjectByName(doc, 'A')?.style).toEqual({ show: true });
    expect(print(doc)).toBe('@version 1\nA = (0, 0) [show]\n');
  });

  it('bad values are errors with a hint', () => {
    expect(firstError('A = (0, 0)\nd = dist(A, A) [show=maybe]').message).toBe(
      '"show" is true or false',
    );
    for (const bad of ['-1', '11', '2.5', 'two', '1e400']) {
      const e = firstError(`A = (0, 0)\nd = dist(A, A) [digits=${bad}]`);
      expect(e.message).toBe('"digits" takes a whole number from 0 to 10');
      expect(e.hint).toBe('write digits=2');
    }
    expect(firstError('A = (0, 0)\nd = dist(A, A)\nstyle d [digits]').message).toContain(
      'one value',
    );
    expect(firstError('A = (0, 0)\nd = dist(A, A) [show, show]').message).toContain('given twice');
  });

  it('an unknown key lists show and digits among the keys a definition and a style line take', () => {
    expect(firstError('A = (0, 0) [shown]').hint).toContain('show');
    expect(firstError('A = (0, 0) [shown]').hint).toContain('digits');
    expect(firstError('A = (0, 0)\nstyle A [precision=2]').hint).toContain('digits');
  });

  it('P1 and P2 on random combinations of the two with the other style keys', () => {
    const style = fc.record(
      {
        color: fc.constantFrom('red', '#00ff00'),
        show: fc.boolean(),
        digits: fc.integer({ min: 0, max: 10 }),
        labelAngle: fc.integer({ min: -360, max: 360 }),
        hidden: fc.boolean(),
      },
      { requiredKeys: [] },
    );
    fc.assert(
      fc.property(style, (s: Style) => {
        const doc0 = parseOk('@version 1\nA = (0, 0)\nB = (1, 2)\nd = dist(A, B)\n');
        const doc = {
          ...doc0,
          objects: doc0.objects.map((o) => (o.name === 'd' ? { ...o, style: s } : o)),
        };
        const text = print(doc);
        const back = parse(text, registry);
        expect(back.diagnostics).toEqual([]);
        expect(stable(canonicalDocument(back.doc))).toEqual(stable(canonicalDocument(doc)));
        expect(print(back.doc)).toBe(text);
      }),
      { numRuns: 200, seed: 48 },
    );
  });
});
