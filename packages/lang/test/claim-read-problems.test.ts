/**
 * ADR-0051: a claim the language cannot read says exactly what it could not read, where, and
 * the form to write. Reproduced from the header's claim box: `AP, BQ, CR are concurrent` was
 * refused with `expected "=", found ","` (the comma), which named neither the word that could
 * not be read nor the forms that read a list of objects.
 */
import { describe, expect, it } from 'vitest';
import { firstError, parseOk } from './helpers/lang';

const FIG = [
  'A = (0, 4)',
  'B = (-3, 0)',
  'C = (4, 0)',
  'P = midpoint(B, C)',
  'Q = midpoint(C, A)',
  'R = midpoint(A, B)',
];

const err = (claim: string) => firstError([...FIG, claim].join('\n'));

describe('what a claim line could not read (ADR-0051)', () => {
  it('a list followed by a word that is not a list word: the word, at its column', () => {
    const d = err('claim AP, BQ, CR are concurrent');
    expect(d.message).toBe(
      'could not read "are": after a list of objects write collinear, concyclic, cyclic or concurrent',
    );
    expect(d.hint).toBe('for example: AP, BQ, CR concurrent, or concurrent(AP, BQ, CR)');
    expect([d.line, d.column, d.endColumn]).toEqual([7, 18, 21]);
  });

  it('a misspelt list word is named the same way', () => {
    const d = err('claim AP, BQ, CR concur');
    expect(d.message).toContain('could not read "concur"');
  });

  it('objects without commas before a list word: separate them with commas', () => {
    const d = err('claim AP BQ CR concurrent');
    expect(d.message).toBe('could not read "BQ": separate the objects of a list with commas');
    expect(d.hint).toBe('for example: AP, BQ, CR concurrent');
    expect(d.column).toBe(10);
  });

  it('one object and an unknown word before a relation word', () => {
    const d = err('claim AP is perpendicular to BC');
    expect(d.message).toBe(
      'could not read "is": between two objects write ⟂, ∥, perpendicular, parallel, on or tangent',
    );
    expect(d.hint).toBe('for example: AP ⟂ BC, AB ∥ CD, P on ω, ω tangent γ');
  });

  it('the forms that are read are unchanged', () => {
    const doc = parseOk(
      [
        '@version 1',
        ...FIG,
        'claim AP, BQ, CR concurrent',
        'claim AP ⟂ BC',
        'claim AB = 2·PQ',
        'claim on(P, line(B, C))',
      ].join('\n'),
    );
    expect(doc.claims.map((c) => c.kind)).toEqual(['concurrent', 'perpendicular', 'length', 'on']);
  });

  it('a relation without "=" keeps its message', () => {
    expect(err('claim AB < AC').message).toContain('expected "="');
  });
});
