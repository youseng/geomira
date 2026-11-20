import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { parsePortable, printPortable } from '../src/portable';

const registry = createRegistry();
const figure = parse('# diagram\n@version 1  # header annotation\nA = (1,2)', registry).doc;

describe('portable write-up source', () => {
  it('retains arbitrary source independently of construction and math syntax', () => {
    fc.assert(
      fc.property(fc.string(), (source) => {
        const text = printPortable({ ...figure, writeUp: source });
        const restored = parsePortable(text, registry);
        expect(restored.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(restored.doc.writeUp ?? '').toBe(source);
        expect(printPortable(restored.doc)).toBe(text);
      }),
    );
  });
  it('keeps legacy files byte-identical and handles unfinished formulas and directive-looking text', () => {
    expect(printPortable(figure)).toBe(print(figure));
    const source = '  $\\frac{ 🧭\n@version 99\n@writeup "quoted"\r\n\n';
    const result = parsePortable(printPortable({ ...figure, writeUp: source }), registry);
    expect(result.doc.writeUp).toBe(source);
    expect(result.doc.objects).toEqual(figure.objects);
  });
  it.each(['', '@writeup 5', '@writeup "cut', '@writeup "x"\n@writeup "y"'])(
    'rejects a damaged envelope %j',
    (line) => {
      expect(
        parsePortable('@version 2\n' + line, registry).diagnostics.some(
          (d) => d.severity === 'error',
        ),
      ).toBe(true);
    },
  );
});
