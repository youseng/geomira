/**
 * RationalField (SPEC §3.3): exact BigInt fractions, the oracle of law L3. Zero and sign
 * are exact (the tolerance context is ignored). sqrt succeeds only on squares of
 * rationals; sin/cos only at the special multiples of 30°, atan2 only on the axes and
 * diagonals (Niven); everything else is Inexact.
 */
import type { Field, Inexact } from './field';
import { inexact } from './field';
import {
  ONE,
  ZERO,
  add,
  div,
  eq,
  formatRational,
  fromInteger,
  isInteger,
  mul,
  neg,
  rational,
  sign,
  sqrtExact,
  sub,
  toNumber,
  type Rational,
} from './rational';
import { specialAtan2, twiceCosOfInteger, twiceSinOfInteger } from './trig';

/** Degenerate: a negative argument → RangeError; a non-square → Inexact. */
function sqrt(x: Rational): Rational | Inexact {
  return sqrtExact(x) ?? inexact(`√(${formatRational(x)}) is not rational`);
}

function trig(degrees: Rational, which: 'sin' | 'cos'): Rational | Inexact {
  if (isInteger(degrees)) {
    const n = degrees.num;
    const twice = which === 'sin' ? twiceSinOfInteger(n) : twiceCosOfInteger(n);
    if (twice !== undefined) return rational(BigInt(twice), 2n);
  }
  return inexact(`${which}(${formatRational(degrees)}°) is not rational`);
}

/** Degenerate: (0, 0) → RangeError; a direction off the axes and diagonals → Inexact. */
function atan2(y: Rational, x: Rational): Rational | Inexact {
  if (y.num === 0n && x.num === 0n) throw new RangeError('atan2(0, 0) is undefined');
  const special = specialAtan2(sign(y), sign(x), eq(y, x) || eq(y, neg(x)));
  return special === undefined
    ? inexact(
        `atan2(${formatRational(y)}, ${formatRational(x)}) is not a rational number of degrees`,
      )
    : fromInteger(special);
}

export const RationalField: Field<Rational> = Object.freeze({
  kind: 'rational',
  name: 'RationalField',
  zero: ZERO,
  one: ONE,
  add,
  sub,
  mul,
  div,
  neg,
  eq,
  isZero: (x: Rational) => x.num === 0n,
  sign: (x: Rational) => sign(x),
  sqrt,
  sin: (degrees: Rational) => trig(degrees, 'sin'),
  cos: (degrees: Rational) => trig(degrees, 'cos'),
  atan2,
  fromRational: (r: Rational) => r,
  toNumber,
} satisfies Field<Rational>);
