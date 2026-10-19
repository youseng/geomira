/**
 * ModPField (SPEC §3.3): exact arithmetic modulo the Mersenne prime p = 2^61 − 1, used by
 * the exact mod-p rung of the claim tester. Elements are bigints in [0, p). There is no
 * order, so sign is 'none' and any sign-based decision is not evaluable mod p; sqrt and
 * trigonometry are always Inexact (a root mod p says nothing about the real figure).
 */
import { mod, modInverse } from './bigint';
import type { Field, Inexact } from './field';
import { inexact } from './field';
import type { Rational } from './rational';

/** The modulus 2^61 − 1 (prime). */
export const P = (1n << 61n) - 1n;

const HALF = P >> 1n;

/** Degenerate: b ≡ 0 → RangeError. */
function div(a: bigint, b: bigint): bigint {
  return mod(a * modInverse(b, P), P);
}

/** Degenerate: a denominator divisible by p → Inexact. */
function fromRational(r: Rational): bigint | Inexact {
  if (mod(r.den, P) === 0n) return inexact('the denominator is divisible by p (mod p)');
  return div(mod(r.num, P), r.den);
}

function noRoots(): Inexact {
  return inexact('square roots are not evaluable mod p');
}

function noTrig(): Inexact {
  return inexact('trigonometry is not evaluable mod p');
}

export const ModPField: Field<bigint> = Object.freeze({
  kind: 'modp',
  name: 'ModPField',
  zero: 0n,
  one: 1n,
  add: (a: bigint, b: bigint) => mod(a + b, P),
  sub: (a: bigint, b: bigint) => mod(a - b, P),
  mul: (a: bigint, b: bigint) => mod(a * b, P),
  div,
  neg: (a: bigint) => mod(-a, P),
  eq: (a: bigint, b: bigint) => a === b,
  isZero: (x: bigint) => x === 0n,
  sign: () => 'none',
  sqrt: noRoots,
  sin: noTrig,
  cos: noTrig,
  atan2: noTrig,
  fromRational,
  /** The symmetric representative in (−p/2, p/2] as a double: diagnostics only. */
  toNumber: (x: bigint) => Number(x > HALF ? x - P : x),
} satisfies Field<bigint>);
