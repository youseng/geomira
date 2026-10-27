/**
 * ADR-0039: the integer lattice of congruences mod 180°. Membership is over the integers
 * (2x ≡ 0 does not give x ≡ 0), constants are reduced by the modulus, a dropped insertion only
 * makes the lattice know less, and a copy is independent of later insertions.
 */
import { describe, expect, it } from 'vitest';
import { CONST, Lattice, type Vector } from '../src/lattice';

/** Σ coeffs·x ≡ c as a vector (constant column −c). */
function eq(coeffs: Record<number, number>, c = 0): Vector {
  const v: Vector = new Map(Object.entries(coeffs).map(([k, x]) => [Number(k), x]));
  if (c !== 0) v.set(CONST, -c);
  return v;
}

describe('the integer lattice (ADR-0039)', () => {
  it('integer combinations follow; rational ones do not', () => {
    const l = new Lattice();
    expect(l.insert(eq({ 0: 2 }))).toBe(true); // 2x ≡ 0
    expect(l.contains(eq({ 0: 2 }))).toBe(true);
    expect(l.contains(eq({ 0: 4 }))).toBe(true);
    expect(l.contains(eq({ 0: 1 }))).toBe(false); // x may be 90°
    expect(l.contains(eq({ 0: 1 }, 90))).toBe(false);
  });

  it('chains of equalities and constants mod 180°', () => {
    const l = new Lattice();
    l.insert(eq({ 0: 1, 1: -1 })); // x = y
    l.insert(eq({ 1: 1, 2: -1 }, 90)); // y − z ≡ 90
    expect(l.contains(eq({ 0: 1, 2: -1 }, 90))).toBe(true);
    expect(l.contains(eq({ 0: 1, 2: -1 }, -90))).toBe(true); // −90 ≡ 90
    expect(l.contains(eq({ 0: 1, 2: -1 }, 270))).toBe(true);
    expect(l.contains(eq({ 0: 1, 2: -1 }))).toBe(false);
    expect(l.contains(eq({ 0: 2, 2: -2 }))).toBe(true); // 2·90 ≡ 0
    expect(l.contains(eq({ 0: 1, 3: -1 }))).toBe(false); // an unknown variable
  });

  it('the Euclidean step keeps the gcd: 4x ≡ 0 and 6x ≡ 0 give 2x ≡ 0, not x ≡ 0', () => {
    const l = new Lattice();
    l.insert(eq({ 0: 4 }));
    l.insert(eq({ 0: 6 }));
    expect(l.contains(eq({ 0: 2 }))).toBe(true);
    expect(l.contains(eq({ 0: 1 }))).toBe(false);
  });

  it('a constant-only row refines the modulus: 0 ≡ 60 makes the constants mod 60', () => {
    const l = new Lattice();
    l.insert(eq({}, 60));
    expect(l.contains(eq({}, 120))).toBe(true);
    expect(l.contains(eq({}, 30))).toBe(false);
  });

  it('a copy is a snapshot', () => {
    const l = new Lattice();
    l.insert(eq({ 0: 1, 1: -1 }));
    const before = l.clone();
    l.insert(eq({ 1: 1, 2: -1 }));
    expect(l.contains(eq({ 0: 1, 2: -1 }))).toBe(true);
    expect(before.contains(eq({ 0: 1, 2: -1 }))).toBe(false);
    expect(before.size).toBe(2);
  });

  it('an insertion beyond the safe integers is dropped, and nothing false follows', () => {
    const l = new Lattice();
    const big = 2 ** 52;
    l.insert(eq({ 0: big, 1: 3 }));
    expect(l.insert(eq({ 0: big - 1, 1: big }))).toBe(false);
    expect(l.contains(eq({ 0: 1 }))).toBe(false);
    expect(l.contains(eq({ 0: big, 1: 3 }))).toBe(true);
  });
});
