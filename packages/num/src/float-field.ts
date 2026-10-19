/**
 * FloatField (SPEC §3.3): IEEE doubles with the tolerance-aware zero and sign tests of
 * tolerance.ts. Square roots and trigonometry always succeed on valid input.
 */
import type { Field, Inexact } from './field';
import { inexact } from './field';
import { tryToNumber, type Rational } from './rational';
import { isZero, sign3 } from './tolerance';
import { specialAtan2, twiceCosOfInteger, twiceSinOfInteger } from './trig';

const DEG = Math.PI / 180;

function finite(x: number, what: string): number {
  if (!Number.isFinite(x)) throw new RangeError(`${what} of a non-finite number`);
  return x;
}

/**
 * sin or cos in degrees. Integer angles at the special multiples of 30° are exact (so
 * sin(180°) is exactly 0, not a rounding residue); other angles are reduced mod 360
 * exactly, then go through Math.sin / Math.cos.
 */
function trig(degrees: number, which: 'sin' | 'cos'): number {
  finite(degrees, which);
  if (Number.isInteger(degrees)) {
    const n = BigInt(degrees);
    const twice = which === 'sin' ? twiceSinOfInteger(n) : twiceCosOfInteger(n);
    if (twice !== undefined) return twice / 2;
  }
  const r = (degrees % 360) * DEG;
  return which === 'sin' ? Math.sin(r) : Math.cos(r);
}

function signOf(x: number): -1 | 0 | 1 {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/**
 * atan2 in degrees in (-180, 180]: exact on the axes and diagonals, Math.atan2 elsewhere.
 * Degenerate cases: (0, 0) → RangeError; non-finite input → RangeError.
 */
function atan2Degrees(y: number, x: number): number {
  finite(y, 'atan2');
  finite(x, 'atan2');
  if (y === 0 && x === 0) throw new RangeError('atan2(0, 0) is undefined');
  const special = specialAtan2(signOf(y), signOf(x), Math.abs(y) === Math.abs(x));
  if (special !== undefined) return special;
  // Math.atan2 is in [-π, π] and π / DEG is exactly 180, so only -180 needs folding.
  const a = Math.atan2(y, x) / DEG;
  return a === -180 ? 180 : a;
}

function fromRational(r: Rational): number | Inexact {
  return tryToNumber(r) ?? inexact('the number is beyond the double range');
}

export const FloatField: Field<number> = Object.freeze({
  kind: 'float',
  name: 'FloatField',
  zero: 0,
  one: 1,
  add: (a: number, b: number) => a + b,
  sub: (a: number, b: number) => a - b,
  mul: (a: number, b: number) => a * b,
  div: (a: number, b: number) => {
    if (b === 0) throw new RangeError('division by zero');
    return a / b;
  },
  neg: (a: number) => -a,
  eq: (a: number, b: number) => a === b,
  isZero,
  sign: sign3,
  sqrt: (x: number) => {
    if (!(x >= 0) || x === Infinity) throw new RangeError(`sqrt of ${String(x)}`);
    return Math.sqrt(x);
  },
  sin: (degrees: number) => trig(degrees, 'sin'),
  cos: (degrees: number) => trig(degrees, 'cos'),
  atan2: atan2Degrees,
  fromRational,
  toNumber: (x: number) => x,
} satisfies Field<number>);
