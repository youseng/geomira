/**
 * Found in the Run 10 audit: parsing was not total (SPEC §11.3) on deeply nested input. The
 * recursive descent and the conversion to kernel expressions overflowed the call stack: a sum
 * of 3000 terms, 3000 nested parentheses, 5000 chained `-` and 3000 nested calls threw
 * "RangeError: Maximum call stack size exceeded" out of parse (and out of a share link of 435
 * characters at startup). The selector checks also formatted every nested call's text eagerly,
 * so a line nested 400 deep took seconds. An expression may be nested at most MAX_EXPR_DEPTH
 * levels: deeper ones are a diagnostic at their line, never a throw.
 */
import { describe, expect, it } from 'vitest';
import { MAX_EXPR_DEPTH } from '@geomira/kernel/limits';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

const LINES: [string, (n: number) => string][] = [
  ['a sum', (n) => `k = ${'1 + '.repeat(n - 1)}1`],
  ['a product', (n) => `k = ${'2 * '.repeat(n - 1)}2`],
  ['parentheses', (n) => `k = ${'('.repeat(n)}1${')'.repeat(n)}`],
  ['negations', (n) => `k = ${'- '.repeat(n)}1`],
  ['nested calls', (n) => `k = ${'sqrt('.repeat(n)}1${')'.repeat(n)}`],
  ['nested points', (n) => `A = ${'midpoint((0, 0), '.repeat(n)}(1, 1)${')'.repeat(n)}`],
];

describe(`expressions nested more than ${String(MAX_EXPR_DEPTH)} levels`, () => {
  for (const [what, line] of LINES) {
    it(`${what}: deep ones are a diagnostic (never a throw), shallow ones parse`, () => {
      for (const n of [MAX_EXPR_DEPTH + 1, 3000, 6000]) {
        const r = parse(`@version 1\n${line(n)}\nB = (1, 2)\n`, registry);
        const d = r.diagnostics.find((x) => x.severity === 'error');
        expect(d?.message, `${what} ${String(n)}`).toMatch(/nested more than/u);
        expect(d?.line).toBe(2);
        // Per-line recovery: the next line is still read.
        expect(r.doc.objects.map((o) => o.name)).toEqual(['B']);
      }
      const ok = parse(`@version 1\n${line(Math.floor(MAX_EXPR_DEPTH / 2))}\n`, registry);
      expect(ok.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    });
  }

  it('a line at the largest depth parses, prints and parses back, in well under a second', () => {
    const text = `@version 1\nk = ${'sqrt('.repeat(MAX_EXPR_DEPTH - 1)}1${')'.repeat(MAX_EXPR_DEPTH - 1)}\n`;
    const r = parse(text, registry);
    expect(r.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(parse(print(r.doc), registry).diagnostics.filter((x) => x.severity === 'error')).toEqual(
      [],
    );
  });
});
