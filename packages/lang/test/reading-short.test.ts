/**
 * ADR-0061, reading: `ABC triangle` is `triangle ABC`; British spellings of tool names
 * (circumcentre, incentre) are the tools; a `;` in a file line says what to do instead; and
 * `splitStatements` cuts a command line into its statements.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { splitStatements } from '../src/statements';
import { file, firstError, parseOk, registry } from './helpers/lang';

describe('ABC triangle', () => {
  it('is triangle ABC: the same document', () => {
    expect(print(parseOk(file('ABC triangle')))).toBe(print(parseOk(file('triangle ABC'))));
    expect(print(parseOk(file('ABC triangle acute')))).toBe(
      print(parseOk(file('triangle ABC acute'))),
    );
  });

  it('uses points that exist, as triangle ABC does', () => {
    const lines = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'];
    expect(print(parseOk(file(...lines, 'ABC triangle')))).toBe(
      print(parseOk(file(...lines, 'triangle ABC'))),
    );
  });

  it('only three glued point names before the word: other lines read as before', () => {
    expect(firstError('AB triangle').message).toBe('expected a statement, found "A"');
    expect(firstError('A B C triangle').message).toBe('expected a statement, found "A"');
    expect(firstError('ABC triangl').message).toBe('expected a statement, found "A"');
  });
});

describe('British spellings', () => {
  const base = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'];

  it('circumcentre, incentre, orthocentre, ninepoint_centre are the tools', () => {
    const doc = parseOk(
      file(
        ...base,
        'O = circumcentre(ABC)',
        'I = incentre(ABC)',
        'H = orthocentre(ABC)',
        'N = ninepoint_centre(ABC)',
        'ω = circle(ABC)',
        'Z = centre(ω)',
      ),
    );
    expect(print(doc).trimEnd().split('\n').slice(4)).toEqual([
      'O = circumcenter(A, B, C)',
      'I = incenter(A, B, C)',
      'H = orthocenter(A, B, C)',
      'N = ninepoint_center(A, B, C)',
      'ω = circle(A, B, C)',
      'Z = center(ω)',
    ]);
  });

  it('a misspelling is still an error with its suggestion', () => {
    expect(firstError([...base, 'O = circumcentr(ABC)'].join('\n')).message).toBe(
      'unknown tool "circumcentr": did you mean circumcenter?',
    );
    expect(firstError([...base, 'O = centre_of_mass(ABC)'].join('\n')).message).toContain(
      'unknown tool "centre_of_mass"',
    );
  });
});

describe('several statements on one line', () => {
  it('a file line with ; is refused, at the ;, with what to do', () => {
    const d = firstError('A = (0, 0); B = (4, 0)');
    expect(d).toMatchObject({ line: 1, column: 11, endColumn: 12, message: 'unexpected ";"' });
    expect(d.hint).toBe(
      'write one statement per line (the command bar takes several, separated by ;)',
    );
    // The line is not applied in part.
    expect(parse(file('A = (0, 0); B = (4, 0)'), registry).doc.objects).toEqual([]);
  });

  it('splitStatements cuts at ; and says where each statement starts', () => {
    expect(splitStatements('triangle ABC; O = circumcenter(ABC);D = foot(A, BC)')).toEqual([
      { text: 'triangle ABC', start: 0 },
      { text: 'O = circumcenter(ABC)', start: 14 },
      { text: 'D = foot(A, BC)', start: 36 },
    ]);
  });

  it('not inside parentheses, brackets or strings, nor in a comment', () => {
    expect(splitStatements('claim harmonic(A, B; C, D); M = midpoint(B, C)')).toEqual([
      { text: 'claim harmonic(A, B; C, D)', start: 0 },
      { text: 'M = midpoint(B, C)', start: 28 },
    ]);
    expect(splitStatements('t = text(A, "a; b \\" ; c"); k = 1')).toEqual([
      { text: 't = text(A, "a; b \\" ; c")', start: 0 },
      { text: 'k = 1', start: 28 },
    ]);
    expect(splitStatements('A = (0, 0) [label="x;y"]  # one; two')).toEqual([
      { text: 'A = (0, 0) [label="x;y"]  # one; two', start: 0 },
    ]);
  });

  it('empty statements are left out; a line without ; is itself', () => {
    expect(splitStatements('  A = (0, 0) ;; ; ')).toEqual([{ text: 'A = (0, 0)', start: 2 }]);
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements(' ; ')).toEqual([]);
    expect(splitStatements('k = 1')).toEqual([{ text: 'k = 1', start: 0 }]);
    // An unbalanced bracket never throws: the rest is one statement.
    expect(splitStatements('D = foot(A, BC; k = 1')).toEqual([
      { text: 'D = foot(A, BC; k = 1', start: 0 },
    ]);
  });
});
