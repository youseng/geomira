import { describe, expect, it } from 'vitest';
import { inexact, isInexact } from '../src/field';

describe('isInexact', () => {
  it('recognises only Inexact, not other tagged values (kernel Values also carry `kind`)', () => {
    expect(isInexact(inexact('√2 is not rational'))).toBe(true);
    expect(isInexact({ kind: 'undefined', reason: 'parallel lines' })).toBe(false);
    expect(isInexact({ kind: 'point', x: 0, y: 0 })).toBe(false);
    expect(isInexact({ reason: 'no kind' })).toBe(false);
    expect(isInexact({ num: 1n, den: 2n })).toBe(false);
    expect(isInexact(null)).toBe(false);
    expect(isInexact(0)).toBe(false);
    expect(isInexact(0n)).toBe(false);
  });
});
