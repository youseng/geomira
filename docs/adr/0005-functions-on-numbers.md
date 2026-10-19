# ADR-0005: sqrt, sin, cos, tan on numbers (Run 3a completion)

Status: accepted (Run 3a completion). Extends ADR-0002 (numeric preconditions) and ADR-0003
(items 2, 17 and 19); supersedes nothing.

## Context

SPEC §6.2 lists "arithmetic and sqrt/sin/cos/tan (degrees) on numbers". Run 3a was accepted
with only `+ − × ÷` and negation; the maintainer asked to complete it with the four
functions, each with ONE `compute<T>`, with these requirements: over Rational, sqrt is
exact on perfect squares and Inexact otherwise; sin/cos/tan are exact only at the angles
num's trigonometric tables cover; sqrt of a negative and tan at 90° (mod 180°) are
Undefined with a reason; the argument is classified with tolerance.ts first ("a value
within the band of 0 counts as 0"), so num is never called with an out-of-domain value.

SPEC §3.3 fixes `Field.sqrt/sin/cos` but leaves open how the kernel classifies arguments,
whether the exact value a number carries (`Num.exact`, ADR-0003 item 2) is used, and how
tan is computed (Field has no tan).

## Decision

1. **Tools.** `sqrt`, `sin`, `cos`, `tan` in packages/kernel/src/tools/functions.ts:
   family `arithmetic`, signature `(number)`, output `number`, export `'numeric'`
   (ADR-0003 item 11), appended to the registry after `ext_bisector`. Angles are in
   degrees (ADR-0002). Numbers are dimensionless (ADR-0003 item 17), so every zero and
   sign test is `'dimensionless'`.
2. **An exact argument is decided exactly, in every field.** When the argument carries
   `Num.exact`, the domain is decided on that rational (exact sign; tan via RationalField),
   and a rational result is returned as `F.fromRational(result)` with `exact` set, in
   every field (also mod p: `sqrt(9/4)` is 3/2 mod p, `sin(30)` is 2⁻¹ mod p). This extends
   ADR-0003 item 2's list of exact-preserving operations by: √ of a square of a rational,
   sin/cos where num's tables give a rational value, tan at the multiples of 45° (other
   than 90° mod 180°). A literal `sqrt(1/100000000)` is therefore 1/10000 in FloatField,
   not 0: an exact number has no float uncertainty, so the band does not apply to it.
3. **Otherwise the field decides, with its own banded sign** (FloatField: tolerance.ts via
   `F.sign` / `F.isZero`; RationalField: exact; ModPField: `'none'`), and **a value within
   the band of 0 counts as 0**:
   - sqrt: sign 1 → `F.sqrt(x)`; sign 0 or `'ambiguous'` (|x| < BAND, either sign) → 0;
     sign −1 (x ≤ −BAND) → Undefined("sqrt of a negative number"); `'none'` (mod p, no
     order and no domain) → `F.sqrt(x)`, which num answers with Inexact.
   - tan: cos θ zero or `'ambiguous'` (|cos θ| < BAND) → Undefined("tan is undefined at
     90° (mod 180°)"). With an exact θ that is not 90° (mod 180°) but whose cosine is in
     the band in FloatField, the float run is still Undefined: it would otherwise divide
     by a cosine that may round to 0, as `div` refuses a divisor that is zero in
     FloatField although its exact value is not (ADR-0003 item 17).
   - sin, cos: no degenerate input (FloatField accepts every finite number).
4. **tan θ = sin θ / cos θ**, and where sin θ or cos θ is not representable, **tan θ =
   sin 2θ / (1 + cos 2θ)**, using only num's tables. Over Q this is exact exactly where tan
   is rational: by Niven's theorem tan of a rational number of degrees is rational only
   for 0 and ±1, i.e. at the multiples of 45°; sin/cos at θ give 0 at the multiples of
   180°, the double angle gives ±1 at the odd multiples of 45°. When both fail, the
   Inexact reason is the one of sin θ (or cos θ), e.g. "cos(30°) is not rational". In
   FloatField sin and cos always succeed, so only the first formula runs. 1 + cos 2θ =
   2cos²θ vanishes only at 90° (mod 180°), where cos θ = 0 is in num's table and was
   already decided; it is still tested before dividing (unreachable in the v1 fields).
5. **Float range** (ADR-0003 item 19): |√x| ≤ max(1, |x|), |sin|, |cos| ≤ 1 and, in
   FloatField, |tan θ| ≤ 1/BAND = 10⁷ (|cos θ| ≥ BAND), so the bound 2^200 on arguments
   still suffices. `evaluate` keeps turning a FloatField argument beyond 2^200 into
   Inexact before any tool runs: `sqrt(-1e200)` is Inexact in FloatField and Undefined
   over Q (both refuse; neither is a number).

## Consequences

- num is never asked for √ of a negative or for a division by zero (tested with
  `withSqrtLog`/`withDivisorLog` and by law L1, where num would throw).
- For a measured (non-exact) argument, FloatField's sqrt is 0 on (−BAND, BAND) and √x from
  BAND on: at x = BAND it steps from 0 to √BAND ≈ 3.2·10⁻⁴ (dimensionless). This is the
  "counts as 0" rule, the analogue of "tangency → the double point" (a discriminant that
  is 0 up to rounding gives one root). Recorded under "Uncertain" in STATUS.md.
- The exact rungs see these tools as any other: the mod-p rung is never used for closures
  with sqrt or trigonometry (SPEC §10.5, L17, the claims run), even though an exact
  argument gives a value mod p here.

## Alternatives considered

- Ignoring `Num.exact` and letting each field decide: a literal `sqrt(2/100000000)` would be
  0 in FloatField while its exact root is about 1.4·10⁻⁴; the float value of an exact
  number would be silently wrong by far more than its rounding.
- For a positive x inside the band, √x instead of 0 (continuous): needs the side of 0
  inside the band, a decision the band exists to avoid, and departs from the requested
  rule. Kept as an option for the maintainer (STATUS.md "Uncertain").
- In-band → Undefined("ambiguous"), as for selectors: √ of a rounding residue −1e-16 of a
  quantity that is 0 would be Undefined, which the requested rule excludes.
- tan = sin/cos only: tan 45° = 1 would be Inexact over Q although it is rational.
- Adding `tan` to num's `Field`: changes the interface fixed by SPEC §3.3 and num's frozen
  surface test, for nothing the kernel cannot do with sin and cos.
