import { describe, expect, it } from 'vitest';
import { KEYWORDS, isImageSuffix, isPointName, isUserName, nameProblem } from '../src/names';

describe('name grammar (SPEC §11.2)', () => {
  it('accepts point names and other names', () => {
    for (const n of ['A', 'A1', 'A_1', 'M_a', 'M_{ab}', "H'", "A_1''", 'Z_{12}', 'B12']) {
      expect(isPointName(n), n).toBe(true);
      expect(isUserName(n), n).toBe(true);
    }
    for (const n of ['l', 'k2', 'ω', 'Ω_1', 'circ_1', 'omega', "l'", 'αβ']) {
      expect(isPointName(n), n).toBe(false);
      expect(isUserName(n), n).toBe(true);
    }
  });

  it('rejects everything else, with reasons', () => {
    for (const n of ['', 'Ma', 'A_12b', 'A_{}', '1A', 'A*', 'l*', 'A b', '_a', 'AB', 'a-b', "'A"]) {
      expect(isUserName(n), n).toBe(false);
      expect(nameProblem(n), n).toBeDefined();
    }
    for (const k of KEYWORDS) expect(nameProblem(k)).toBe(`"${k}" is a keyword`);
    expect(nameProblem('')).toBe('a name cannot be empty');
    expect(nameProblem('Ma')).toBe('"Ma" is not a valid name: did you mean M_a?');
    expect(nameProblem('A*')).toMatch(/reserved for images/);
    expect(nameProblem('AB')).toBe('"AB" is not a valid name');
    expect(nameProblem('A')).toBeUndefined();
  });

  it('image suffixes are runs of stars', () => {
    expect(['*', '**', '***'].every(isImageSuffix)).toBe(true);
    expect(['', "'", '*a', ' *'].some(isImageSuffix)).toBe(false);
  });
});
