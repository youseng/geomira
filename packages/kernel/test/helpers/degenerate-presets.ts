/**
 * Degenerate cases of feet_inversion and sqrt_bc2 (ADR-0034), the two presets the maintainer
 * confirmed after Run 14's first pass. Spread into degenerate.test.ts's table.
 */
import { expect } from 'vitest';
import { call, type Expr } from '../../src/expr';
import { FIELDS, ORDERED, at, plain, reason } from './degenerate';
import { pt } from './doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const O0 = pt(0, 0);

export const PRESET_CASES: Record<string, Record<string, () => void>> = {
  feet_inversion: {
    'AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C) → Undefined': () => {
      for (const F of FIELDS)
        for (const [B, C] of [
          [pt(4, 0), pt(0, 3)],
          [O0, pt(3, 1)],
          [pt(3, 1), O0],
        ] as const)
          expect(reason(at(F, 'feet_inversion', O0, B, C))).toBe(
            'undefined: feet_inversion(A, B, C): AB⃗·AC⃗ = 0 (a right angle at A, or A = B or A = C)',
          );
    },
    'B = C → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'feet_inversion', O0, pt(1, 2), pt(1, 2)))).toBe(
          'undefined: coincident points: diameter_circle(A, B) needs A ≠ B',
        );
    },
    'AB⃗·AC⃗ < 0 (an obtuse angle at A) → the inversion followed by the half turn about A': () => {
      // k = (2, 0)·(−1, 1) = −2: B goes to (−1, 0), the foot of C on line AB (behind A).
      for (const F of ORDERED) {
        const m = T('feet_inversion', O0, pt(2, 0), pt(-1, 1));
        expect(plain(F, at(F, 'apply', m, pt(2, 0)))).toEqual([-1, 0]);
        expect(plain(F, at(F, 'apply', m, pt(-1, 1)))).toEqual([1, -1]);
      }
    },
    'collinear A, B, C → still defined (it swaps B and C)': () => {
      for (const F of ORDERED)
        for (const C of [pt(4, 0), pt(-4, 0)]) {
          const m = T('feet_inversion', O0, pt(1, 0), C);
          expect(plain(F, at(F, 'apply', m, pt(1, 0)))).toEqual(plain(F, at(F, 'midpoint', C, C)));
        }
    },
  },
  sqrt_bc2: {
    'A = B or A = C → Undefined': () => {
      for (const F of FIELDS) {
        expect(at(F, 'sqrt_bc2', O0, O0, pt(5, 0)).kind).toBe('undefined');
        expect(at(F, 'sqrt_bc2', O0, pt(5, 0), O0).kind).toBe('undefined');
      }
    },
    'collinear A, B, C → still defined (B goes to the midpoint of AC)': () => {
      for (const F of ORDERED)
        for (const C of [pt(-4, 0), pt(4, 0)]) {
          const m = T('sqrt_bc2', O0, pt(1, 0), C);
          expect(plain(F, at(F, 'apply', m, pt(1, 0)))).toEqual(plain(F, at(F, 'midpoint', O0, C)));
        }
    },
  },
};
