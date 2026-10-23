/**
 * Hints that say what to write (bug-fix round, ADR-0028): implicit products and calls
 * without parentheses hint the product or the call (not "attributes go in brackets"), a
 * power, a root or a × sign hints the language's spelling (not "remove it"), arithmetic on a
 * glued run says what the run means, and glued point names before `=` are not a name.
 */
import { describe, expect, it } from 'vitest';
import { firstError } from './helpers/lang';

const hint = (line: string): string => firstError(['a = 2', line].join('\n')).hint;
const message = (line: string): string => firstError(['a = 2', line].join('\n')).message;

describe('implicit products and calls', () => {
  it('a number glued to a name or a parenthesis hints the product', () => {
    expect(hint('x = 2a')).toBe('write 2 * a for a product');
    expect(hint('x = 2 a')).toBe('write 2 * a for a product');
    expect(hint('x = 2(a + 1)')).toBe('write 2 * (…) for a product');
    expect(hint('x = (a + 1)(a - 1)')).toBe('write (…) * (…) for a product');
  });

  it('a name followed by an operand hints the call', () => {
    expect(hint('x = sqrt 2')).toBe('write sqrt(2) to call sqrt, or sqrt * 2 for a product');
    expect(hint('x = a 2')).toBe('write a(2) to call a, or a * 2 for a product');
  });

  it('a unit of degrees hints that angles are in degrees', () => {
    expect(hint('x = 30deg')).toBe('angles are in degrees: write 30 or 30°');
  });

  it('a decimal comma hints the decimal point', () => {
    expect(hint('x = 1,5')).toBe('write 1.5: decimals use a point');
  });

  it('attributes outside brackets keep their hint', () => {
    expect(hint('x = a color=red')).toBe('attributes go in brackets: [color=red]');
  });
});

describe('characters the language spells otherwise', () => {
  it('powers', () => {
    expect(hint('x = a^2')).toBe('there is no power: write a * a');
    expect(hint('x = a²')).toBe('there is no power: write a * a');
    expect(hint('x = a³')).toBe('there is no power: write a * a * a');
    expect(hint('x = (a + 1)^2')).toBe('there is no power: write (…) * (…)');
  });

  it('roots and signs', () => {
    expect(hint('x = √2')).toBe('write sqrt(2)');
    expect(hint('x = √a')).toBe('write sqrt(a)');
    expect(hint('x = 2×a')).toBe('write * for multiplication');
    expect(hint('x = 2÷a')).toBe('write / for division');
  });

  it('other characters keep "remove it"', () => {
    expect(hint('x = a $ 2')).toBe('remove it');
  });
});

describe('glued point names', () => {
  it('arithmetic on a run says what the run means', () => {
    const d = firstError(['A = (0, 0)', 'B = (4, 0)', 'x = AB/2'].join('\n'));
    expect(d.hint).toBe('AB is line(A, B); the length AB is dist(A, B)');
    expect(d.message).toContain('div does not accept (line, number)');
  });

  it('a run before = is not a name', () => {
    const d = firstError(['A = (0, 0)', 'B = (4, 0)', 'AB = line(A, B)'].join('\n'));
    expect(d.message).toBe('"AB" is two glued point names, not a name');
    expect(d.hint).toBe('name it with one letter, as in l = line(A, B) or A_1 = …');
    expect([d.line, d.column, d.endColumn]).toEqual([3, 1, 3]);
    expect(message("A'B'C = (1, 1)")).toBe('"A\'B\'C" is three glued point names, not a name');
  });
});
