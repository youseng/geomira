/**
 * Functions on numbers (SPEC §6.2: "sqrt/sin/cos/tan (degrees) on numbers"; ADR-0005).
 * Each has ONE compute<T>. The argument is classified BEFORE num is called, so num never
 * sees an out-of-domain value (√ of a negative, tan's division by cos 90° = 0):
 *   - an argument with an exact value (Num.exact, ADR-0003) is decided exactly, in every
 *     field, and a rational result carries its exact value;
 *   - otherwise the field decides, with the banded sign of tolerance.ts in FloatField:
 *     sqrt is continuous (a negative within the band of 0 counts as 0), and tan refuses a
 *     cosine within the band of 0.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field, type Inexact } from '@geomira/num/field';
import * as Q from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import type { EvalContext, ToolSpec } from '../tool';
import { numOf, undef, type Num, type Value } from '../value';
import { badArgs, numAt } from './args';

type Fn = 'sqrt' | 'sin' | 'cos' | 'tan';

const NEGATIVE = 'sqrt of a negative number';
const RIGHT = 'tan is undefined at 90° (mod 180°)';

/** The argument of a one-number call, or undefined for any other argument list. */
function argOf<T>(args: readonly Value<T>[]): Num<T> | undefined {
  return args.length === 1 ? numAt(args, 0) : undefined;
}

/** An exact rational result in F, carrying its exact value (Inexact if F cannot hold it). */
function exactNum<T>(F: Field<T>, r: Q.Rational): Value<T> {
  const v = F.fromRational(r);
  return isInexact(v) ? v : numOf(v, r);
}

function lift<T>(x: T | Inexact): Value<T> {
  return isInexact(x) ? x : numOf(x);
}

/** x within the band of 0 (FloatField: |x| < BAND), which counts as 0; exact elsewhere. */
function zeroInBand<T>(F: Field<T>, x: T, ctx: EvalContext): boolean {
  return F.isZero(x, 'dimensionless', ctx) || F.sign(x, 'dimensionless', ctx) === 'ambiguous';
}

/**
 * √x for an exact x. Degenerate cases: x < 0 → Undefined; x the square of a rational →
 * that root, exact in every field; otherwise √ in F of x's value in F (≥ 0, so in the
 * domain): a double in FloatField, Inexact over Q and mod p.
 */
function sqrtOfExact<T>(F: Field<T>, x: Q.Rational): Value<T> {
  if (Q.sign(x) < 0) return undef(NEGATIVE);
  const root = Q.sqrtExact(x);
  if (root !== undefined) return exactNum(F, root);
  const v = F.fromRational(x);
  return isInexact(v) ? v : lift(F.sqrt(v));
}

/**
 * sqrt(x), continuous on (−BAND, ∞) in FloatField. Degenerate cases: x ≤ −BAND →
 * Undefined("sqrt of a negative number") (over Q: any x < 0); −BAND < x < 0 counts as 0 →
 * 0; x ≥ 0 → √x as computed, also inside the band; x not the square of a rational →
 * Inexact over Q; mod p → Inexact unless x is an exact square. Inside the band the side
 * of 0 is read from F.toNumber, which is x itself in FloatField; the exact fields reach
 * that branch only for an exact 0 (their sign is never 'ambiguous').
 */
function sqrt<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const a = argOf(args);
  if (a === undefined) return badArgs('sqrt');
  if (a.exact !== undefined) return sqrtOfExact(F, a.exact);
  const s = F.sign(a.v, 'dimensionless', ctx);
  switch (s) {
    case 1:
    case 'none': // mod p: no order and no domain; num answers Inexact
      return lift(F.sqrt(a.v));
    case 0:
    case 'ambiguous':
      return F.toNumber(a.v) > 0 ? lift(F.sqrt(a.v)) : numOf(F.zero);
    case -1:
      return undef(NEGATIVE);
    default:
      return assertNever(s, 'field sign');
  }
}

/**
 * sin or cos in degrees. No degenerate input. Exact (in every field) when the argument is
 * exact and the value is rational (multiples of 30° where num's tables have it); otherwise
 * F's own value: a double in FloatField, Inexact over Q off those angles and mod p.
 */
function trig(which: 'sin' | 'cos'): ToolSpec['compute'] {
  return <T>(F: Field<T>, args: readonly Value<T>[]): Value<T> => {
    const a = argOf(args);
    if (a === undefined) return badArgs(which);
    if (a.exact !== undefined) {
      const e = RationalField[which](a.exact);
      if (!isInexact(e)) return exactNum(F, e);
    }
    return lift(F[which](a.v));
  };
}

/**
 * tan θ = sin 2θ / (1 + cos 2θ), used when sin θ or cos θ is not representable: over Q it
 * is exact at the odd multiples of 45° (sin 2θ = ±1, cos 2θ = 0). `missing` is the reason
 * reported when it fails too. 1 + cos 2θ = 2cos²θ is 0 only at 90° (mod 180°), where
 * cos θ = 0 is representable and was decided by the caller; it is still tested, so no
 * field ever divides by it.
 */
function tanByDoubleAngle<U>(G: Field<U>, x: U, ctx: EvalContext, missing: Inexact): Value<U> {
  const twice = G.add(x, x);
  const [s2, c2] = [G.sin(twice), G.cos(twice)];
  if (isInexact(s2) || isInexact(c2)) return missing;
  const den = G.add(G.one, c2);
  return zeroInBand(G, den, ctx) ? undef(RIGHT) : numOf(G.div(s2, den));
}

/**
 * tan θ in degrees over G. Degenerate cases: cos θ zero, or within the band of 0 in
 * FloatField (it counts as 0) → Undefined("tan is undefined at 90° (mod 180°)"); tan θ
 * not rational → Inexact over Q (with the reason of sin θ or cos θ); mod p → Inexact.
 */
function tanOf<U>(G: Field<U>, x: U, ctx: EvalContext): Value<U> {
  const c = G.cos(x);
  if (!isInexact(c) && zeroInBand(G, c, ctx)) return undef(RIGHT);
  const s = G.sin(x);
  if (isInexact(s)) return tanByDoubleAngle(G, x, ctx, s);
  if (isInexact(c)) return tanByDoubleAngle(G, x, ctx, c);
  return numOf(G.div(s, c));
}

/**
 * tan(θ). An exact θ is decided over Q first: 90° (mod 180°) → Undefined in every field, a
 * rational tan θ (0, ±1) → exact in every field. Otherwise F decides (tanOf), so FloatField
 * also refuses a θ whose cosine is within the band of 0, as `div` refuses a divisor that
 * is zero in FloatField although its exact value is not.
 */
function tan<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T> {
  const a = argOf(args);
  if (a === undefined) return badArgs('tan');
  if (a.exact !== undefined) {
    const e = tanOf(RationalField, a.exact, ctx);
    if (e.kind === 'undefined') return e;
    if (e.kind === 'number') return exactNum(F, e.v);
  }
  return tanOf(F, a.v, ctx);
}

function spec(
  id: Fn,
  compute: ToolSpec['compute'],
  doc: string,
  degenerate: readonly string[],
  examples: readonly string[],
): ToolSpec {
  return {
    id,
    name: id,
    family: 'arithmetic',
    signatures: [{ params: ['number'] }],
    outputKinds: ['number'],
    compute,
    degenerate,
    export: 'numeric',
    doc,
    examples: examples.map((x) => ({ args: [x] })),
  };
}

const TRIG_INEXACT =
  'off the angles where it is rational → Inexact (over Q; mod p unless the angle is exact)';

export const FUNCTION_TOOLS: readonly ToolSpec[] = [
  spec(
    'sqrt',
    sqrt,
    '√x, the non-negative square root (exact on squares of rationals).',
    [
      'x ≤ −BAND, or an exact x < 0 → Undefined (sqrt of a negative number)',
      '−BAND < x < 0 counts as 0 → 0 (x ≥ 0 → √x: continuous)',
      'x not the square of a rational → Inexact (over Q; mod p unless x is an exact square)',
    ],
    ['9/4', '2'],
  ),
  spec(
    'sin',
    trig('sin'),
    'sin θ, θ in degrees (exact where rational).',
    [TRIG_INEXACT],
    ['30', '45'],
  ),
  spec(
    'cos',
    trig('cos'),
    'cos θ, θ in degrees (exact where rational).',
    [TRIG_INEXACT],
    ['60', '45'],
  ),
  spec(
    'tan',
    tan,
    'tan θ, θ in degrees (exact where rational: multiples of 45°).',
    [
      'θ ≡ 90° (mod 180°) → Undefined',
      'cos θ within the band of 0 counts as 0 → Undefined',
      'tan θ not rational → Inexact (over Q; mod p unless θ is an exact multiple of 45°)',
    ],
    ['45', '30'],
  ),
];
