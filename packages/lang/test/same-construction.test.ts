/**
 * A definition that is the same construction as an earlier object (ADR-0029): with
 * ParseOptions.sameConstruction = 'error' it is an error on its line and the line is not
 * applied (ADR-0009 decision 14); 'warning' reports it and applies the line; without the
 * option nothing is reported, so every document the kernel accepts still reads back without
 * diagnostics (laws P1, P3).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { parseInto } from '../src/parse-into';
import { file, registry } from './helpers/lang';

const BASE = ['A = (5, 12)', 'B = (0, 0)', 'C = (14, 0)', 'l = line(A, B)'];

describe('sameConstruction: error', () => {
  it('m = line(B, A) after l = line(A, B) is an error on its line, with a hint', () => {
    const r = parse(file(...BASE, 'm = line(B, A)'), registry, { sameConstruction: 'error' });
    expect(r.diagnostics).toEqual([
      {
        line: 6,
        column: 1,
        endColumn: 2,
        severity: 'error',
        message: 'm is the same construction as l (line(A, B)): use l',
        hint: 'write l where m is used, and delete this line',
      },
    ]);
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 'B', 'C', 'l']);
  });

  it('a later use of the refused name says which line to fix', () => {
    const r = parse(file(...BASE, 'm = line(B, A)', 'X = foot(C, m)'), registry, {
      sameConstruction: 'error',
    });
    expect(r.diagnostics.map((d) => [d.line, d.message])).toEqual([
      [6, 'm is the same construction as l (line(A, B)): use l'],
      [7, 'm is not defined: its line 6 has an error'],
    ]);
  });

  it.each([
    ['circle(A, B, C)', 'circumcircle(C, A, B)'],
    ['segment(A, B)', 'segment(B, A)'],
    ['midpoint(A, B)', 'midpoint(B, A)'],
    ['circumcenter(A, B, C)', 'circumcenter(B, C, A)'],
    ['excircle(A, B, C)', 'excircle(A, C, B)'],
    ['bisector(A, B, C)', 'bisector(C, B, A)'],
    ['foot(C, A, B)', 'foot(C, B, A)'],
    ['polygon(A, B, C)', 'polygon(C, B, A)'],
    ['dist(A, B)', 'dist(B, A)'],
    [
      'intersect(circle(B, A), circle(C, A), orient(+))',
      'intersect(circle(C, A), circle(B, A), orient(-))',
    ],
    ['intersect(l, circle(C, A), along(+))', 'intersect(circle(C, A), l, along(+))'],
  ])('%s, then %s', (first, second) => {
    const r = parse(file(...BASE, `x = ${first}`, `y = ${second}`), registry, {
      sameConstruction: 'error',
    });
    expect(r.diagnostics.map((d) => d.message)).toEqual([
      `y is the same construction as x (${first}): use x`,
    ]);
  });

  it.each([
    ['ray(A, B)', 'ray(B, A)'],
    ['circle(A, B)', 'circle(B, A)'],
    ['(1, 2)', '(1, 2)'],
    ['on(l, 1/2)', 'on(l, 1/2)'],
    ['param(0, 1, 1/2)', 'param(0, 1, 1/2)'],
    ['midpoint(A, (1, 2))', 'midpoint(A, (1, 2))'],
    ['polygon(A, B, C, (1, 1))', 'polygon(A, C, B, (1, 1))'],
    [
      'intersect(circle(B, A), circle(C, A), orient(+))',
      'intersect(circle(C, A), circle(B, A), orient(+))',
    ],
    [
      'intersect(line(A, C), circle(B, A), along(+))',
      'intersect(line(C, A), circle(B, A), along(+))',
    ],
  ])('not the same: %s and %s', (first, second) => {
    const r = parse(file(...BASE, `x = ${first}`, `y = ${second}`), registry, {
      sameConstruction: 'error',
    });
    expect(r.diagnostics).toEqual([]);
  });

  it('parseInto takes the option too', () => {
    const old = parse(file(...BASE), registry).doc;
    const r = parseInto(old, file(...BASE, 'm = line(B, A)'), registry, {
      sameConstruction: 'error',
    });
    expect(r.diagnostics.map((d) => d.severity)).toEqual(['error']);
    expect(r.doc.objects.some((o) => o.name === 'm')).toBe(false);
  });
});

describe('sameConstruction: warning, and the default', () => {
  it('a warning applies the line', () => {
    const r = parse(file(...BASE, 'm = line(B, A)'), registry, { sameConstruction: 'warning' });
    expect(r.diagnostics.map((d) => [d.severity, d.message])).toEqual([
      ['warning', 'm is the same construction as l (line(A, B)): use l'],
    ]);
    expect(r.doc.objects.some((o) => o.name === 'm')).toBe(true);
  });

  it('without the option, nothing is reported and the line is applied', () => {
    const r = parse(file(...BASE, 'm = line(B, A)'), registry);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc.objects.some((o) => o.name === 'm')).toBe(true);
  });
});
