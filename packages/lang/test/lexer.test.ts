import { describe, expect, it } from 'vitest';
import { lexLine } from '../src/lexer';
import { exactLiteral, floatLiteral, formatFloat, lexString, quote } from '../src/lex-literals';

const kinds = (src: string): string[] => lexLine(src, 1).tokens.map((t) => `${t.kind}:${t.value}`);
const errors = (src: string): string[] => lexLine(src, 1).diagnostics.map((d) => d.message);

describe('point names (SPEC §11.2)', () => {
  it('reads letters, digits, subscripts, braces and primes', () => {
    expect(kinds("A A1 A_1 M_a M_{ab} H' A_1''")).toEqual([
      'point:A',
      'point:A1',
      'point:A_1',
      'point:M_a',
      'point:M_{ab}',
      "point:H'",
      "point:A_1''",
    ]);
  });

  it('glues juxtaposed point names (segments, angles) as separate tokens', () => {
    const t = lexLine("ABC A_1B M_aB A'B'", 1).tokens;
    expect(t.map((x) => x.value)).toEqual(['A', 'B', 'C', 'A_1', 'B', 'M_a', 'B', "A'", "B'"]);
    expect(t.map((x) => x.spaceBefore)).toEqual([
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('Ma → "did you mean M_a?"; M_ab → M_{ab}', () => {
    expect(errors('Ma')).toEqual(['"Ma" is not a valid name: did you mean M_a?']);
    expect(lexLine('Ma', 1).diagnostics[0]?.hint).toBe('write M_a');
    expect(errors('M_ab')).toEqual(['"M_ab" is not a valid name: did you mean M_{ab}?']);
    expect(errors('Mab')).toEqual(['"Mab" is not a valid name: did you mean M_{ab}?']);
  });

  it('an index after "_" is required', () => {
    expect(errors('A_ = (0, 0)')[0]).toContain('needs an index');
  });
});

describe('the * rule (note A, ADR-0009)', () => {
  it('after a point name, glued stars are always part of the name', () => {
    expect(kinds("A* A** A*B* H'*")).toEqual([
      'point:A*',
      'point:A**',
      'point:A*',
      'point:B*',
      "point:H'*",
    ]);
  });

  it('after a lowercase or Greek name, a star is part of the name iff no letter, digit, _, ( or \\ follows', () => {
    expect(kinds('l*')).toEqual(['name:l*']);
    expect(kinds('w*,')).toEqual(['name:w*', 'punct:,']);
    expect(kinds('w*)')).toEqual(['name:w*', 'punct:)']);
    expect(kinds('ω** ]')).toEqual(['name:ω**', 'punct:]']);
    expect(kinds('a*b')).toEqual(['name:a', 'punct:*', 'name:b']);
    expect(kinds('k*2')).toEqual(['name:k', 'punct:*', 'number:2']);
    expect(kinds('r*(1+r)')).toEqual([
      'name:r',
      'punct:*',
      'punct:(',
      'number:1',
      'punct:+',
      'name:r',
      'punct:)',
    ]);
    expect(kinds('w*\\alpha')).toEqual(['name:w', 'punct:*', 'name:α']);
    expect(kinds('w*_x').slice(0, 2)).toEqual(['name:w', 'punct:*']);
  });

  it('a starred name, whitespace and an operand is an error with the hint "write a * b"', () => {
    const d = lexLine('x = a* b', 1).diagnostics;
    expect(d).toHaveLength(1);
    expect(d[0]?.hint).toBe('write a * … for multiplication');
    expect(errors('x = a* 2')).toHaveLength(1);
    expect(errors('x = a* (b)')).toHaveLength(1);
    expect(errors('x = a* \\omega')).toHaveLength(1);
    expect(errors('style l* [hidden]')).toEqual([]);
    expect(errors('x = l* - 1')).toEqual([]);
    expect(errors('x = l* * 2')).toEqual([]);
  });
});

describe('other names, Greek, escapes', () => {
  it('reads lowercase and Greek names, with \\-escapes resolved', () => {
    expect(kinds("k k2 circ_1 ω \\omega \\omega_1 l' \\Gamma")).toEqual([
      'name:k',
      'name:k2',
      'name:circ_1',
      'name:ω',
      'name:ω',
      'name:ω_1',
      "name:l'",
      'name:Γ',
    ]);
  });

  it('symbol escapes and alternative spellings', () => {
    expect(kinds('\\angle \\measuredangle \\cdot \\neq \\ne != <= >= − ⋅')).toEqual([
      'punct:∠',
      'punct:∡',
      'punct:·',
      'punct:≠',
      'punct:≠',
      'punct:≠',
      'punct:≤',
      'punct:≥',
      'punct:-',
      'punct:·',
    ]);
    expect(errors('\\foo')[0]).toContain('unknown escape');
  });

  it('directives, comments, unknown characters', () => {
    const l = lexLine('@layer x  # the # stays', 1);
    expect(l.tokens.map((t) => `${t.kind}:${t.value}`)).toEqual(['directive:layer', 'name:x']);
    expect(l.comment).toBe(' the # stays');
    expect(errors('A = $')).toEqual(['unexpected character "$"']);
    expect(errors('@')).toHaveLength(1);
    expect(errors('°')).toHaveLength(1);
  });

  it('reports columns (1-based, end exclusive)', () => {
    const t = lexLine('  AB = 2', 1).tokens;
    expect(t.map((x) => [x.column, x.endColumn])).toEqual([
      [3, 4],
      [4, 5],
      [6, 7],
      [8, 9],
    ]);
  });
});

describe('numbers and strings', () => {
  it('numbers keep their written form', () => {
    expect(kinds('2 0.1 2/3 60° 2/3° 1e-3 007')).toEqual([
      'number:2',
      'number:0.1',
      'number:2/3',
      'number:60°',
      'number:2/3°',
      'number:1e-3',
      'number:007',
    ]);
    expect(kinds('1/ 2')).toEqual(['number:1', 'punct:/', 'number:2']);
  });

  it('exact literals: forms, degrees, refusals', () => {
    const v = (t: string): string => {
      const r = exactLiteral(t);
      return r.ok ? `${String(r.value.num)}/${String(r.value.den)}` : 'no';
    };
    expect([v('2'), v('-3/4'), v('0.10'), v('60°'), v('-0'), v('6/8')]).toEqual([
      '2/1',
      '-3/4',
      '1/10',
      '60/1',
      '0/1',
      '3/4',
    ]);
    expect([v('1e-3'), v('1/0'), v('x')]).toEqual(['no', 'no', 'no']);
  });

  it('floats read back exactly, -0 included', () => {
    for (const x of [0, -0, 1.5, -2, 1e-7, 5e-324, 1.7976931348623157e308, 0.1 + 0.2]) {
      expect(Object.is(floatLiteral(formatFloat(x)), x)).toBe(true);
    }
    expect(floatLiteral('1.')).toBeUndefined();
  });

  it('strings: escapes round-trip through quote', () => {
    for (const s of [
      '',
      'a"b',
      'back\\slash',
      'line\nbreak',
      '\t\r',
      '\u0001\u007f',
      ' ',
      '\ud800',
      'é∡😀',
      '#',
    ]) {
      const q = quote(s);
      const r = lexString(q, 0);
      expect(r.ok && r.value).toBe(s);
      expect(r.end).toBe(q.length);
    }
    expect(lexString('"abc', 0).ok).toBe(false);
    expect(lexString('"\\q"', 0).ok).toBe(false);
  });
});
