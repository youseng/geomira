/**
 * Run 16a (ADR-0040 decision 16): the cross-ratio notation. `harmonic(A, B; C, D)` and
 * `cross_ratio(A, B, C, D) = k` read and print (P1); on four lines they build the line kinds
 * (printed as calls); errors name the form; a triangle's existing vertex at infinity is refused
 * with its reason.
 */
import { describe, expect, it } from 'vitest';
import { print } from '../src/print';
import { parse } from '../src/parse';
import { file, firstError, parseOk, registry } from './helpers/lang';

const FIG = [
  'A = (0, 0)',
  'B = (6, 0)',
  'C = (2, 0)',
  'D = (-6, 0)',
  'P = (1, 1)',
  'a = line(P, A)',
  'b = line(P, B)',
  'c = line(P, C)',
  'd = line(P, D)',
];

const claimOf = (line: string) => parseOk(file(...FIG, line)).claims[0];
const lastLine = (text: string) => text.trimEnd().split('\n').at(-1) ?? '';

describe('harmonic(A, B; C, D) and cross_ratio(A, B, C, D) = k', () => {
  it('points: the notation and the calls give the same claims, printed in the notation', () => {
    const h = claimOf('claim harmonic(A, B; C, D)');
    expect(h?.kind).toBe('harmonic');
    expect(h).toEqual(claimOf('claim harmonic(A, B, C, D)'));
    const x = claimOf('claim cross_ratio(A, B; C, D) = -1/2');
    expect(x?.kind).toBe('cross_ratio');
    expect(x).toEqual(claimOf('claim cross_ratio(A, B, C, D) = -1/2'));
    expect(x).toEqual(claimOf('claim cross_ratio(A, B, C, D, -1/2)'));
    const doc = parseOk(
      file(...FIG, 'claim harmonic(A, B; C, D)', 'claim cross_ratio(A, B, C, D) = 3/2'),
    );
    const text = print(doc);
    expect(text).toContain('claim harmonic(A, B; C, D)\n');
    expect(lastLine(text)).toBe('claim cross_ratio(A, B, C, D) = 3/2');
    expect(parse(text, registry).doc.claims).toEqual(doc.claims);
  });

  it('four lines build the line kinds, printed as calls', () => {
    const h = claimOf('claim harmonic(a, b; c, d)');
    expect(h?.kind).toBe('harmonic_lines');
    expect(claimOf('claim harmonic(a, b, c, d)')?.kind).toBe('harmonic_lines');
    const x = claimOf('claim cross_ratio(a, b, c, d) = 2');
    expect(x?.kind).toBe('cross_ratio_lines');
    const doc = parseOk(file(...FIG, 'claim harmonic(a, b; c, d)'));
    expect(lastLine(print(doc))).toBe('claim harmonic_lines(a, b, c, d)');
    expect(parse(print(doc), registry).doc.claims).toEqual(doc.claims);
  });

  it('errors name the form', () => {
    expect(firstError(['A = (0, 0)', 'claim harmonic(A; A, A, A)'].join('\n')).message).toBe(
      '"harmonic(…)": the ";" separates the two pairs',
    );
    expect(firstError(['A = (0, 0)', 'claim harmonic(A, A; A, A) = 2'].join('\n')).message).toBe(
      'harmonic(A, B; C, D) takes no value',
    );
    expect(firstError(['A = (0, 0)', 'claim cross_ratio(A, A; A) = 2'].join('\n')).message).toBe(
      'cross_ratio(…) takes four points or four lines',
    );
    expect(firstError(['A = (0, 0)', 'claim cross_ratio(A, A; A, A)'].join('\n')).message).toBe(
      'expected "=", found the end of the line',
    );
  });
});

describe('a triangle on an existing vertex at infinity', () => {
  it('is refused with the reason', () => {
    const r = parse(
      file('A = (0, 0)', 'B = intersect(line(A, (1, 0)), line((0, 1), (1, 1)))', 'triangle ABC'),
      registry,
    );
    expect(r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message)).toEqual([
      'triangle ABC: B is a point at infinity here, so no place can be drawn for C',
    ]);
  });
});
