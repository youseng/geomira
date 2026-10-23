/**
 * `a/2/3` is (a/2)/3 (bug-fix round, ADR-0028): a glued fraction literal is not read right
 * after a division operator, so a chain of divisions is left-associative as everywhere else.
 * The printer writes a fraction literal that is the right operand of a division in
 * parentheses, so the text reads back as the same tree (P1, P2).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { rational } from '@geomira/num/rational';
import { lexLine } from '../src/lexer';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { printExpr } from '../src/print-expr';
import { canonicalDocument, stable } from '../src/canonical';
import { defOf, diagnostics, parseOk, registry } from './helpers/lang';

const fmt = (e: Expr): string => printExpr(e, (id) => (id === 0 ? 'a' : undefined));

describe('a glued fraction is not read after a division', () => {
  it('lexes a/2/3 as a / 2 / 3, and a/-2/3 as a / -2 / 3', () => {
    const v = (s: string): string[] => lexLine(s, 1).tokens.map((t) => t.value);
    expect(v('a/2/3')).toEqual(['a', '/', '2', '/', '3']);
    expect(v('a / 2/3')).toEqual(['a', '/', '2', '/', '3']);
    expect(v('a/-2/3')).toEqual(['a', '/', '-', '2', '/', '3']);
    expect(v('a*2/3')).toEqual(['a', '*', '2/3']);
    expect(v('2/3/4')).toEqual(['2/3', '/', '4']);
  });

  it('a = 3, x = a/2/3 is (a/2)/3', () => {
    const doc = parseOk('@version 1\na = 3\nx = a/2/3');
    const a = doc.objects.find((o) => o.name === 'a')?.id ?? -1;
    expect(defOf(doc, 'x')).toEqual(
      call('div', [call('div', [ref(a), lit(rational(2n))]), lit(rational(3n))]),
    );
    expect(print(doc)).toContain('x = a / 2 / 3');
  });

  it('a/-2/3 is (a/-2)/3; 1/a/2 and 2/3/4 are left-associative', () => {
    const doc = parseOk('@version 1\na = 3\nx = a/-2/3\ny = 2/3/4');
    const a = doc.objects.find((o) => o.name === 'a')?.id ?? -1;
    expect(defOf(doc, 'x')).toEqual(
      call('div', [call('div', [ref(a), lit(rational(-2n))]), lit(rational(3n))]),
    );
    expect(defOf(doc, 'y')).toEqual(call('div', [lit(rational(2n, 3n)), lit(rational(4n))]));
  });

  it('a / (2/3) keeps its fraction and prints with the parentheses', () => {
    const doc = parseOk('@version 1\na = 3\nx = a / (2/3)\ny = a / (-4/6)');
    const a = doc.objects.find((o) => o.name === 'a')?.id ?? -1;
    expect(defOf(doc, 'x')).toEqual(call('div', [ref(a), lit(rational(2n, 3n))]));
    const text = print(doc);
    expect(text).toContain('x = a / (2/3)');
    expect(text).toContain('y = a / (-4/6)');
    expect(print(parseOk(text))).toBe(text);
  });

  it('the printer parenthesises every fraction literal on the right of a division', () => {
    expect(fmt(call('div', [ref(0), lit(rational(2n, 3n))]))).toBe('a / (2/3)');
    expect(fmt(call('div', [ref(0), lit(rational(-2n, 3n))]))).toBe('a / (-2/3)');
    expect(fmt(call('div', [ref(0), lit(rational(1n, 2n), '0.5')]))).toBe('a / 0.5');
    expect(fmt(call('div', [ref(0), lit(rational(2n))]))).toBe('a / 2');
    expect(fmt(call('mul', [ref(0), lit(rational(2n, 3n))]))).toBe('a * 2/3');
    expect(fmt(call('div', [lit(rational(2n, 3n)), ref(0)]))).toBe('2/3 / a');
  });

  it('the text of an earlier printer (a / 2/3) warns that it now reads as (a / 2) / 3', () => {
    const ds = diagnostics('a = 3\nx = a / 2/3');
    expect(ds).toHaveLength(1);
    expect(ds[0]?.severity).toBe('warning');
    expect(ds[0]?.message).toBe('x / 2/3 is read as (x / 2) / 3');
    expect(ds[0]?.hint).toContain('(2/3)');
    expect(diagnostics('a = 3\nx = a/2/3')).toEqual([]);
  });

  it('P1/P2: division by any fraction literal round-trips', () => {
    const lits = fc
      .tuple(fc.integer({ min: -40, max: 40 }), fc.integer({ min: 1, max: 40 }))
      .map(([n, d]) => lit(rational(BigInt(n), BigInt(d)), `${String(n)}/${String(d)}`));
    fc.assert(
      fc.property(lits, lits, (p, q) => {
        const base = parseOk('@version 1\na = 3\nx = a\ny = a');
        const id = base.objects[0]?.id ?? -1;
        const defs: Readonly<Record<string, Expr>> = {
          x: call('div', [call('div', [ref(id), p]), q]),
          y: call('div', [ref(id), call('div', [p, q])]),
        };
        const doc = {
          ...base,
          objects: base.objects.map((o) => ({ ...o, def: defs[o.name] ?? o.def })),
        };
        const text = print(doc);
        const back = parse(text, registry);
        expect(back.diagnostics).toEqual([]);
        expect(stable(canonicalDocument(back.doc))).toBe(stable(canonicalDocument(doc)));
        expect(print(back.doc)).toBe(text);
      }),
      { numRuns: 200, seed: 28 },
    );
  });
});
