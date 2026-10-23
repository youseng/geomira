/**
 * Characters outside the Basic Multilingual Plane (bug-fix round, ADR-0028): the lexer read
 * a UTF-16 unit, so `𝛚` gave two diagnostics, each naming half a surrogate pair. It now
 * reads a code point: one diagnostic naming the character, two columns wide.
 */
import { describe, expect, it } from 'vitest';
import { lexLine } from '../src/lexer';

describe('a character outside the BMP', () => {
  it('is one unexpected character', () => {
    const d = lexLine('x = 𝛚 + 1', 1).diagnostics;
    expect(d.map((x) => [x.message, x.column, x.endColumn])).toEqual([
      ['unexpected character "𝛚"', 5, 7],
    ]);
    expect(lexLine('x = 😀😀', 1).diagnostics.map((x) => x.column)).toEqual([5, 7]);
  });
});
