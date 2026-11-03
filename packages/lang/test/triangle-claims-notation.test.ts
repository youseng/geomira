/**
 * ADR-0051: the notation of the new claim kinds. `similar(ABC, DEF)` (glued triangles, spread
 * into six points; printed glued when all six are point names), `AB·CD = EF·GH` (also `*` with
 * spaces, dist(…)) and `AB + CD = EF`. Each reads to its kind, prints back (P1, P2), and the
 * examples of the notation table hold in its figure.
 */
import { describe, expect, it } from 'vitest';
import { evalClaim } from '@geomira/claims/eval-claim';
import { CLAIM_NOTATION, NOTATION_FIGURE } from '../src/notation';
import { print } from '../src/print';
import { file, firstError, parseOk, registry } from './helpers/lang';

const figure = (...lines: string[]): string => file(...NOTATION_FIGURE, ...lines);
const lastLine = (text: string): string => text.trimEnd().split('\n').at(-1) ?? '';
const claimsOf = (line: string) => parseOk(figure(line)).claims;

const NEW = [
  'similar',
  'similar_direct',
  'similar_opposite',
  'congruent',
  'congruent_direct',
  'congruent_opposite',
  'length_product',
  'length_sum',
];

describe('the notation of the ADR-0051 kinds', () => {
  it('glued triangles are six points; the call form reads the same', () => {
    expect(claimsOf('claim similar(ABC, M_aM_bM_c)')).toEqual(
      claimsOf('claim similar(A, B, C, M_a, M_b, M_c)'),
    );
    expect(lastLine(print(parseOk(figure('claim similar(A, B, C, M_a, M_b, M_c)'))))).toBe(
      'claim similar(ABC, M_aM_bM_c)',
    );
  });

  it('a triangle with a vertex that is not a point name prints as the call', () => {
    const l = 'claim congruent(A, B, C, reflect(A, line(B, C)), B, C)';
    expect(lastLine(print(parseOk(figure(l))))).toBe(l);
  });

  it('AB·CD = EF·GH, also with * and spaces, and with dist(…)', () => {
    const [c] = claimsOf('claim AB·M_bM_c = BC·AM_c');
    expect(c?.kind).toBe('length_product');
    expect(claimsOf('claim AB * M_bM_c = BC * AM_c')).toEqual(
      claimsOf('claim AB·M_bM_c = BC·AM_c'),
    );
    expect(claimsOf('claim length_product(A, B, M_b, M_c, B, C, A, M_c)')).toEqual(
      claimsOf('claim AB·M_bM_c = BC·AM_c'),
    );
    const d = 'claim AB·dist(A, midpoint(B, C)) = BC·AM_c';
    expect(lastLine(print(parseOk(figure(d))))).toBe(d);
  });

  it('AB + CD = EF, and the call form', () => {
    expect(claimsOf('claim BM_a + M_aC = BC')[0]?.kind).toBe('length_sum');
    expect(claimsOf('claim length_sum(B, M_a, M_a, C, B, C)')).toEqual(
      claimsOf('claim BM_a + M_aC = BC'),
    );
  });

  it('a product against a number is not a claim; EF = AB + CD reads as AB + CD = EF', () => {
    expect(firstError(figure('claim AB·CD = 2')).message).toBe(
      'this relation is not a claim the language knows',
    );
    expect(claimsOf('claim BC = BM_a + M_aC')).toEqual(claimsOf('claim BM_a + M_aC = BC'));
    expect(firstError(figure('assume AB + BC < AC')).message).toContain('compare lengths');
  });

  it('every example of the notation table holds in its figure', () => {
    for (const n of CLAIM_NOTATION.filter((x) => NEW.includes(x.kind))) {
      const doc = parseOk(figure(n.example));
      const [c] = doc.claims;
      expect(c?.kind, n.example).toBe(n.kind);
      expect(evalClaim(doc, c?.id ?? -1, registry).value, n.example).toBe('true');
      expect(print(parseOk(print(doc))), n.example).toBe(print(doc));
    }
  });
});
