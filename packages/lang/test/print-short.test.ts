/**
 * ADR-0061: the short notation, printed. What is written short (a line or circle argument as
 * a run, a call of three point names, the two branches of one call as one statement), what is
 * NOT (and why), and that every example and export fixture reads back from its short text to
 * the same document.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { printShort } from '../src/print-short';
import { file, parseOk, registry } from './helpers/lang';

const BASE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'X = (6, 3)'];

/** The short lines of a text after the base's (the text must have no diagnostics). */
function short(...lines: string[]): string[] {
  const text = printShort(parseOk(file(...BASE, ...lines)), registry);
  return text
    .trimEnd()
    .split('\n')
    .slice(1 + BASE.length);
}

describe('what is written short', () => {
  it('a line argument of two point names is the run', () => {
    expect(short('D = foot(A, line(B, C))')).toEqual(['D = foot(A, BC)']);
    expect(short('l = perp(A, line(B, C))')).toEqual(['l = perp(A, BC)']);
    expect(short('P = intersect(line(A, B), line(C, X))')).toEqual(['P = intersect(AB, CX)']);
  });

  it('a call of exactly three point names is tool(ABC)', () => {
    expect(short('O = circumcenter(A, B, C)', 'ω = circle(A, B, C)', 'k = angle(A, B, C)')).toEqual(
      ['O = circumcenter(ABC)', 'ω = circle(ABC)', 'k = angle(ABC)'],
    );
  });

  it('a circle argument of three point names is the run', () => {
    expect(short('O = center(circle(A, B, C))')).toEqual(['O = center(ABC)']);
  });

  it('the two branches of one call are one statement', () => {
    expect(
      short(
        'ω = circle(A, B, C)',
        'P = intersect(ω, line(A, X), along(+))',
        'Q = intersect(ω, line(A, X), along(-))',
        't = tangent_from(X, ω, orient(+))',
        'u = tangent_from(X, ω, orient(-))',
        'T = tangent_point(X, ω, orient(+))',
        'U = tangent_point(X, ω, orient(-))',
      ),
    ).toEqual([
      'ω = circle(ABC)',
      'P, Q = intersect(ω, AX)',
      't, u = tangents(X, ω)',
      'T, U = tangent_points(X, ω)',
    ]);
  });

  it('the branches keep their common attributes', () => {
    expect(
      short(
        'ω = circle(A, B, C)',
        't = tangent_from(X, ω, orient(+)) [color=red, dash=dashed]',
        'u = tangent_from(X, ω, orient(-)) [color=red, dash=dashed]',
      )[1],
    ).toBe('t, u = tangents(X, ω) [color=red, dash=dashed]');
  });

  it('claims and assumptions write their line arguments as runs', () => {
    expect(
      short(
        'claim perpendicular(line(A, B), line(C, X))',
        'claim concurrent(line(A, B), line(B, C), line(C, X))',
      ),
    ).toEqual(['claim perpendicular(AB, CX)', 'claim concurrent(AB, BC, CX)']);
  });

  it('names with subscripts, primes and stars glue and read back', () => {
    const text = file(
      'A_1 = (0, 0)',
      "B' = (4, 0)",
      'M_a = (1, 3)',
      "O = circumcenter(A_1, B', M_a)",
    );
    const s = printShort(parseOk(text), registry);
    expect(s).toContain("O = circumcenter(A_1B'M_a)");
    expect(print(parseOk(s))).toBe(print(parseOk(text)));
  });
});

describe('what stays canonical, and why', () => {
  it('two point names are not glued: midpoint(B, C), line(A, B), circle(O, A)', () => {
    const lines = ['M = midpoint(B, C)', 'l = line(A, B)', 'c = circle(A, B)'];
    expect(short(...lines)).toEqual(lines);
  });

  it('a tool with image forms: translate(X, A, B) is not a triangle', () => {
    expect(short('Y = translate(X, A, B)')).toEqual(['Y = translate(X, A, B)']);
  });

  it('a call that takes the points and not the line keeps the line call', () => {
    // midpoint(AB) would be read as midpoint(A, B): the argument is not written as a run.
    const r = parse(file(...BASE, 'M = midpoint(line(A, B), C)'), registry);
    expect(printShort(r.doc, registry)).toBe(print(r.doc));
  });

  it('names that are not point names', () => {
    const lines = [
      'p = (1, 1)',
      'q = (2, 5)',
      'D = foot(A, line(p, q))',
      'O = circumcenter(p, q, A)',
    ];
    expect(short(...lines)).toEqual(lines);
  });

  it('branches with different attributes, in another order, or with a selector of their own', () => {
    const circle = 'ω = circle(A, B, C)';
    const differing = [
      't = tangent_from(X, ω, orient(+)) [color=red]',
      'u = tangent_from(X, ω, orient(-))',
    ];
    expect(short(circle, ...differing).slice(1)).toEqual(differing);
    const reversed = ['t = tangent_from(X, ω, orient(-))', 'u = tangent_from(X, ω, orient(+))'];
    expect(short(circle, ...reversed).slice(1)).toEqual(reversed);
    const semantic = [
      'P = intersect(ω, line(A, X), other(A))',
      'Q = intersect(ω, line(A, X), along(-))',
    ];
    expect(short(circle, ...semantic).slice(1)).toEqual([
      'P = intersect(ω, line(A, X), other(A))',
      'Q = intersect(ω, line(A, X), along(-))',
    ]);
  });

  it('a comment on the second branch keeps both lines (it would lose its place)', () => {
    const text = file(
      ...BASE,
      'ω = circle(A, B, C)',
      't = tangent_from(X, ω, orient(+))',
      '# the lower one',
      'u = tangent_from(X, ω, orient(-))',
    );
    const s = printShort(parseOk(text), registry);
    expect(s).toContain('t = tangent_from(X, ω, orient(+))\n# the lower one\nu = tangent_from');
    expect(print(parseOk(s))).toBe(print(parseOk(text)));
  });

  it('a call with selectors keeps its arguments as calls', () => {
    expect(short('ω = circle(A, B, C)', 'P = intersect(ω, line(A, X), other(A))')[1]).toBe(
      'P = intersect(ω, line(A, X), other(A))',
    );
  });
});

describe('every example and export fixture', () => {
  const dirs = ['../../../examples/', '../../../tests/fixtures/export/'].map((d) =>
    fileURLToPath(new URL(d, import.meta.url)),
  );
  const files = dirs.flatMap((d) =>
    readdirSync(d)
      .filter((f) => f.endsWith('.geo'))
      .map((f) => d + f),
  );

  it('reads back from its short text to the same document, and prints the same again', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const f of files) {
      const doc = parse(readFileSync(f, 'utf8'), registry).doc;
      const s = printShort(doc, registry);
      const r = parse(s, registry);
      expect(r.diagnostics, f).toEqual([]);
      expect(print(r.doc), f).toBe(print(doc));
      expect(printShort(r.doc, registry), f).toBe(s);
      expect(s.length, f).toBeLessThanOrEqual(print(doc).length);
    }
  });

  it('the maintainer’s example reads and prints as written', () => {
    const lines = [
      'O = circumcenter(ABC)',
      'ω = incircle(ABC)',
      'D = foot(A, BC)',
      'P, Q = tangents(X, ω)',
    ];
    expect(short(...lines)).toEqual(lines);
  });
});
