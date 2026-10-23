/**
 * Nested negations (bug-fix round, ADR-0028): `-(` counted two nesting levels (the negation
 * and the parenthesis), so 51 to 99 negations parsed but their printed form `-(-(…))` did
 * not. A negation of a parenthesised expression now counts one level, as its tree does.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

describe('nested negations', () => {
  it('every text that parses prints text that parses back to it', () => {
    for (const k of [50, 51, 60, 98]) {
      for (const minus of ['-', '- ', '-(']) {
        const close = minus === '-(' ? ')'.repeat(k) : '';
        const text = `@version 1\na = 1\nx = ${minus.repeat(k)}a${close}`;
        const r = parse(text, registry);
        expect(r.diagnostics, `${String(k)} ${minus}`).toEqual([]);
        const printed = print(r.doc);
        const back = parse(printed, registry);
        expect(back.diagnostics, `${String(k)} ${minus}`).toEqual([]);
        expect(print(back.doc)).toBe(printed);
      }
    }
  });

  it('too deep is still refused', () => {
    const r = parse(`@version 1\na = 1\nx = ${'-'.repeat(150)}a`, registry);
    expect(r.diagnostics.map((d) => d.message)).toEqual([
      'the expression is nested more than 100 levels deep',
    ]);
  });
});
