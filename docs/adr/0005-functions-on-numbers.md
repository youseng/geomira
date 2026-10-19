# ADR-0005: sqrt, sin, cos, tan on numbers (Run 3a completion)

Status: accepted (Run 3a completion; sqrt's band rule revised to the continuous form at
the maintainer's request before merge, see "Revision"). Extends ADR-0002 (numeric preconditions) and ADR-0003
(items 2, 17 and 19); supersedes nothing.

## Context

SPEC §6.2 lists "arithmetic and sqrt/sin/cos/tan (degrees) on numbers". Run 3a was accepted
with only `+ − × ÷` and negation; the maintainer asked to complete it with the four
functions, each with ONE `compute<T>`, with these requirements: over Rational, sqrt is
exact on perfect squares and Inexact otherwise; sin/cos/tan are exact only at the angles
num's trigonometric tables cover; sqrt of a negative and tan at 90° (mod 180°) are
Undefined with a reason; the argument is classified with tolerance.ts first ("a value
within the band of 0 counts as 0"), so num is never called with an out-of-domain value.
On review the maintainer fixed sqrt's rule for arguments without an exact value: x ≥ 0 →
√x as computed; −band < x < 0 → 0; x ≤ −band → Undefined("sqrt of a negative number"),
with a property test that sqrt is non-decreasing and has no jump across [−2·band,
10·band].

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
   `F.sign` / `F.isZero`; RationalField: exact; ModPField: `'none'`):
   - sqrt is **continuous**: sign 1 → `F.sqrt(x)`; sign −1 (x ≤ −BAND) →
     Undefined("sqrt of a negative number"); sign 0 or `'ambiguous'` (|x| < BAND) → `F.sqrt(x)`
     if x > 0, else 0 (a negative within the band counts as 0); `'none'` (mod p, no order
     and no domain) → `F.sqrt(x)`, which num answers with Inexact. Inside the band the side
     of 0 is read from `F.toNumber(x)`, which is x itself in FloatField; RationalField's sign
     is exact (it is 0 only for an exact 0, never `'ambiguous'`), so there the branch only
     sees 0. The result is √max(x, 0) on (−BAND, ∞): non-decreasing and ½-Hölder
     (|√⁺y − √⁺x| ≤ √|y − x|), so it never jumps.
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
- For a measured (non-exact) argument, FloatField's sqrt has no step anywhere on its
  domain: a rounding residue −1e-16 of a quantity that is 0 gives 0, a small positive x
  gives its root. The only discontinuity is the domain edge x = −BAND, where the value 0
  becomes Undefined (a genuine degeneracy). Tested by sqrt-continuity.test.ts and, call
  by call, by laws/l1-functions.test.ts.
- A positive x inside the band is not snapped to 0, so a discriminant that is 0 up to a
  positive rounding residue r gives √r (at most √BAND ≈ 3.2·10⁻⁴), not exactly 0; branch
  selection (a later run) must decide tangency on the discriminant itself, not on the
  root.
- The exact rungs see these tools as any other: the mod-p rung is never used for closures
  with sqrt or trigonometry (SPEC §10.5, L17, the claims run), even though an exact
  argument gives a value mod p here.

## Revision (before merge)

Decision 3's sqrt rule replaced "|x| < BAND → 0" by the continuous rule above, at the
maintainer's request; exact arguments are unchanged. Added: sqrt-continuity.test.ts
(seeded arguments, a grid and the doubles next to −BAND, 0, EPS and BAND; defined exactly
on (−BAND, ∞), non-decreasing, ½-Hölder on adjacent and random pairs). Only test files
added in this PR changed; frozen test files are untouched.

## Alternatives considered

- Ignoring `Num.exact` and letting each field decide: an exact −1e-30 would be 0 in
  FloatField but Undefined over Q, and `sqrt(9/4)` would lose its exact value 3/2.
- The first version of this ADR applied "within the band counts as 0" to both signs: sqrt
  was 0 on (−BAND, BAND) and stepped from 0 to √BAND ≈ 3.2·10⁻⁴ at x = BAND. Replaced on
  review by the continuous rule ("Revision"); the property test fails on it.
- In-band → Undefined("ambiguous"), as for selectors: √ of a rounding residue −1e-16 of a
  quantity that is 0 would be Undefined, which the requested rule excludes.
- tan = sin/cos only: tan 45° = 1 would be Inexact over Q although it is rational.
- Adding `tan` to num's `Field`: changes the interface fixed by SPEC §3.3 and num's frozen
  surface test, for nothing the kernel cannot do with sin and cos.
