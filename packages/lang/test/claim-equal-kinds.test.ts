/**
 * Equality claims of things that are not points (bug-fix round, ADR-0028). `length(A, B)` and
 * `distance(A, B)` are dist(A, B) (ADR-0025 decision 6), so `length(A, B) = length(C, D)` is
 * the length claim, exactly as `dist(A, B) = dist(C, D)`. Any other `x = y` is the claim
 * equal(x, y), which compares points: for numbers, lines or circles the line gets, where it
 * is written, the message the tester would give (ADR-0009 decisions 15 and 16). It is a
 * WARNING: the claim is kept, because the printer writes equal(l, m) made in the editor as
 * `l = m` (it has no registry to know the kinds), and that text must read back (P1); the
 * explicit kind call equal(…) stays without a diagnostic (notation.test.ts pins it).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { file, parseOk, registry } from './helpers/lang';

const BASE = [
  'A = (1, 3)',
  'B = (0, 0)',
  'C = (4, 0)',
  'D = (2, 5)',
  'P = (0, 1)',
  'ω = circumcircle(A, B, C)',
  'γ = circle(D, 1)',
  'l = line(A, B)',
  'm = line(C, D)',
];

function claimLines(text: string): string[] {
  return print(parseOk(text))
    .split('\n')
    .filter((l) => l.startsWith('claim'));
}

describe('length(…) and distance(…) in claims are dist(…)', () => {
  it('length(A, B) = length(C, D) is the length claim AB = CD', () => {
    const want = claimLines(file(...BASE, 'claim dist(A, B) = dist(C, D)'));
    expect(want).toEqual(['claim AB = CD']);
    expect(claimLines(file(...BASE, 'claim length(A, B) = length(C, D)'))).toEqual(want);
    expect(claimLines(file(...BASE, 'claim distance(A, B) = distance(C, D)'))).toEqual(want);
    expect(claimLines(file(...BASE, 'claim length(A, B) = 2·distance(C, D)'))).toEqual([
      'claim AB = 2·CD',
    ]);
    expect(claimLines(file(...BASE, 'claim length(A, B)/AC = 2'))).toEqual(['claim AB/AC = 2']);
  });

  it('in assumptions too', () => {
    const doc = parseOk(file(...BASE, 'assume length(A, B) < distance(A, C)'));
    expect(print(doc)).toContain('assume AB < AC');
  });

  it('the kind call length(A, B, C, D, k) is still the kind', () => {
    expect(claimLines(file(...BASE, 'claim length(A, B, C, D, 2)'))).toEqual(['claim AB = 2·CD']);
  });
});

describe('x = y of things that are not points warns where it is written', () => {
  const cases: [string, string][] = [
    ['power(P, ω) = power(P, γ)', 'invalid claim: equal needs point as argument 1, not number'],
    ['radius(ω) = radius(γ)', 'invalid claim: equal needs point as argument 1, not number'],
    ['area(A, B, C) = area(A, B, D)', 'invalid claim: equal needs point as argument 1, not number'],
    ['l = m', 'invalid claim: equal needs point as argument 1, not line'],
    ['ω = γ', 'invalid claim: equal needs point as argument 1, not circle'],
    ['A = l', 'invalid claim: equal needs point as argument 2, not line'],
  ];
  for (const [claim, message] of cases) {
    it(`claim ${claim}`, () => {
      const r = parse(file(...BASE, `claim ${claim}`), registry);
      expect(r.diagnostics).toEqual([
        {
          line: BASE.length + 2,
          column: 7,
          endColumn: 7 + claim.length,
          severity: 'warning',
          message,
          hint: 'equal compares points; for lengths write AB = CD or dist(A, B) = dist(C, D)',
        },
      ]);
      expect(r.doc.claims.map((c) => c.kind)).toEqual(['equal']);
      const again = parse(print(r.doc), registry);
      expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(print(again.doc)).toBe(print(r.doc));
    });
  }

  it('point equalities and other kinds still read as before', () => {
    expect(claimLines(file(...BASE, 'claim A = B'))).toEqual(['claim A = B']);
    expect(claimLines(file(...BASE, 'claim midpoint(B, C) = A'))).toEqual([
      'claim midpoint(B, C) = A',
    ]);
    expect(claimLines(file(...BASE, 'claim P on ω'))).toEqual(['claim on(P, ω)']);
    expect(claimLines(file(...BASE, 'claim tangent(l, ω)'))).toEqual(['claim tangent(l, ω)']);
    expect(claimLines(file(...BASE, 'claim equal(l, m)'))).toEqual(['claim l = m']);
  });
});
