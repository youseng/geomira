import { describe, expect, it } from 'vitest';
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import { ASSUMPTION_KINDS } from '@geomira/claims/hypotheses';
import { ASSUMPTION_NOTATION, CLAIM_NOTATION, NOTATION_FIGURE } from '../src/notation';
import { print } from '../src/print';
import { file, parseOk } from './helpers/lang';

const figure = (...lines: string[]): string => file(...NOTATION_FIGURE, ...lines);
const lastLine = (text: string): string => text.trimEnd().split('\n').at(-1) ?? '';

describe('claim notation (note B: every ADR-0008 kind has a notation and round-trips)', () => {
  it('the notation table covers exactly the claim kinds', () => {
    expect(CLAIM_NOTATION.map((n) => n.kind).sort()).toEqual(CLAIM_KINDS.map((k) => k.name).sort());
  });

  for (const n of CLAIM_NOTATION) {
    it(`${n.kind}: "${n.example}" parses to ${n.kind} and prints back`, () => {
      const doc = parseOk(figure(n.example));
      expect(doc.claims.map((c) => c.kind)).toEqual([n.kind]);
      expect(lastLine(print(doc))).toBe(n.example);
    });
  }

  it('every kind also parses by name, with the same arguments as its notation', () => {
    const calls: Record<string, string> = {
      length: 'length(G, H, O, G, 2)',
      ratio: 'ratio(A, G, G, M_a, B, G, G, M_b)',
      ratio_value: 'ratio_value(A, G, G, M_a, 2)',
      dangle: 'dangle(2, A, P, B, A, O, B)',
      dangle_lines: 'dangle_lines(line(A, H), line(B, C), 90)',
      angle_eq: 'angle_eq(A, B, H, A, C, H)',
      angle_sum: 'angle_sum(B, H, C, B, A, C, 180°)',
      angle_diff: 'angle_diff(A, B, H, A, C, H, 0)',
      equal: 'equal(reflect(H, M_a), reflect(A, O))',
    };
    for (const n of CLAIM_NOTATION) {
      const c = calls[n.kind];
      if (c === undefined) continue;
      const byName = parseOk(figure(`claim ${c}`)).claims[0];
      const byNotation = parseOk(figure(n.example)).claims[0];
      expect(byName, n.kind).toEqual(byNotation);
    }
  });

  it('other spellings: ASCII escapes, dist(…), angle(…), ∡(…), *, k = 1 omitted', () => {
    const same = (a: string, b: string): void => {
      expect(parseOk(figure(a)).claims).toEqual(parseOk(figure(b)).claims);
    };
    same('claim GH = 2*OG', 'claim GH = 2·OG');
    same('claim GH = 2\\cdot OG', 'claim GH = 2·OG');
    same('claim dist(G, H) = 2·dist(O, G)', 'claim GH = 2·OG');
    same('claim angle(A, B, H) = angle(A, C, H)', 'claim ∠ABH = ∠ACH');
    same('claim \\angle(A, B, H) = \\angle ACH', 'claim ∠ABH = ∠ACH');
    same('claim 2 ∡(A, P, B) = \\measuredangle AOB', 'claim 2∡APB = ∡AOB');
    same('claim 1∡APB = ∡ACB', 'claim ∡APB = ∡ACB');
    same('claim AB = 1·AB', 'claim AB = AB');
  });

  it('arguments that are not point names fall back to (…) forms that round-trip; named ones print as AB', () => {
    const lines = [
      'claim dist(A, midpoint(B, C)) = 3/2·BC',
      'claim AH/dist(O, midpoint(B, C)) = 2',
      'claim ∡(A, midpoint(B, C), B) = ∡AM_aB',
      'claim ∠(A, midpoint(B, C), B) + ∠BAC = 180',
      'claim equal(dist(A, B), dist(A, B))',
    ];
    for (const l of lines) expect(lastLine(print(parseOk(figure(l))))).toBe(l);
  });

  it('literal parameters keep their written form', () => {
    expect(lastLine(print(parseOk(figure('claim GH = 2.0·OG'))))).toBe('claim GH = 2.0·OG');
    expect(lastLine(print(parseOk(figure('claim ∠BHC + ∠BAC = 180.0°'))))).toBe(
      'claim ∠BHC + ∠BAC = 180.0°',
    );
  });
});

describe('assumption notation', () => {
  it('the notation table covers exactly the assumption kinds', () => {
    expect(ASSUMPTION_NOTATION.map((n) => n.kind).sort()).toEqual([...ASSUMPTION_KINDS].sort());
  });

  for (const n of ASSUMPTION_NOTATION) {
    it(`${n.kind}: "${n.example}" parses to ${n.kind} and prints back`, () => {
      const doc = parseOk(figure(n.example));
      expect(doc.assumptions.map((a) => a.kind)).toEqual([n.kind]);
      expect(lastLine(print(doc))).toBe(n.example);
    });
  }

  it('call forms and spellings', () => {
    const same = (a: string, b: string): void => {
      expect(parseOk(figure(a)).assumptions.map((x) => [x.kind, x.args])).toEqual(
        parseOk(figure(b)).assumptions.map((x) => [x.kind, x.args]),
      );
    };
    same('assume less(dist(A, B), dist(A, C))', 'assume AB < AC');
    same('assume AB != AC', 'assume AB ≠ AC');
    same('assume AB \\neq AC', 'assume AB ≠ AC');
    same('assume angle(B, A, C) > 30', 'assume ∠BAC > 30');
    same('assume 30 < ∠BAC', 'assume less(30, angle(B, A, C))');
    same('assume inside(H, polygon(A, B, C))', 'assume H inside polygon(A, B, C)');
    same('assume in_order(B, C, A, ω)', 'assume B, C, A in order on ω');
  });
});
