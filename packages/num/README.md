# @geomira/num

Numerics for GEOMIRA (SPEC §3): tolerances, seeded randomness, exact rationals, and the
number fields every tool and claim is written against. Pure: no DOM, no framework, no
module-level mutable state. The root entry exports only `VERSION`; import the subpath
modules below (ADR-0002).

| Module                        | Contents                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@geomira/num/tolerance`      | `EPS`, `BAND`, `FLOOR_MIN`, `FLOOR_MAX`, `FLOOR_DELTA`, `FLOOR_SAMPLES`, `TRUE_FACTOR`, `FALSE_FACTOR`, `FALSE_ABS`, `MAX_SCALE`; `toleranceContext`, `zeroThreshold`, `bandThreshold`, `isZero`, `isZeroLen`, `isZeroArea`, `isZeroDimless`, `sign3`, `noiseFloor`, `residualThresholds`, `classifyResidual` |
| `@geomira/num/rng`            | `createRng`, `restoreRng`, `deriveSeed` (xoshiro128\*\*), `cryptoSource`, `uniformBigInt`                                                                                                                                                                                                                     |
| `@geomira/num/rational`       | `Rational` (BigInt fraction in normal form), `parseRational`, `formatRational`, arithmetic, `compare`, `toNumber` / `tryToNumber` (correctly rounded), `fromNumber` (exact), `bitSize`, `sqrtExact`                                                                                                           |
| `@geomira/num/field`          | `Field<T>`, `Inexact`, `isInexact`, `mapExact`, `allExact`, `withDivisorLog`, `withSqrtLog`                                                                                                                                                                                                                   |
| `@geomira/num/float-field`    | `FloatField`                                                                                                                                                                                                                                                                                                  |
| `@geomira/num/rational-field` | `RationalField`                                                                                                                                                                                                                                                                                               |
| `@geomira/num/modp`           | `ModPField`, `P` = 2^61 − 1                                                                                                                                                                                                                                                                                   |
| `@geomira/num/complex`        | `Complex<T>` and its operations over any field                                                                                                                                                                                                                                                                |
| `@geomira/num/assert`         | `assertNever`                                                                                                                                                                                                                                                                                                 |

## Degenerate cases (each is a test)

- Zero tests and `sign3`: inclusive at EPS·scale^k; `'ambiguous'` strictly between
  EPS·scale^k and BAND·scale^k; non-finite input → `RangeError`.
- `classifyResidual`: floor clamped at FLOOR_MIN (floor 0 included); floor > FLOOR_MAX →
  `'ill-conditioned'`; NaN or +∞ → `'ill-conditioned'`; negative → `RangeError`.
- Fields: `div` by an exact zero → `RangeError`; √ of a negative element → `RangeError`;
  `atan2(0, 0)` → `RangeError`; √ of a non-square, trig off the special angles, any √ or
  trig mod p → `Inexact` with a reason.
- `toNumber` of a rational beyond the double range → `RangeError` (`tryToNumber`:
  `undefined`); never ±Infinity.

## Fields

| Field           | zero / sign                          | sqrt                      | sin / cos (degrees)                      | atan2 (degrees)                 |
| --------------- | ------------------------------------ | ------------------------- | ---------------------------------------- | ------------------------------- |
| `FloatField`    | EPS / BAND relative to `ctx.scale`   | always (x ≥ 0)            | always; exact at special angles          | always; exact on axes/diagonals |
| `RationalField` | exact                                | squares of rationals only | exact at multiples of 30° where rational | axes and diagonals only         |
| `ModPField`     | exact zero; sign `'none'` (no order) | `Inexact`                 | `Inexact`                                | `Inexact`                       |

The exact trigonometric cases follow Niven's theorem: at a rational number of degrees,
sin is rational only when it is 0, ±1/2 or ±1, and tan only when it is 0 or ±1.

## Reserved for Phase 2 (documented only, no code)

- `QuadExt(F, d)`: the field F(√d), for example d = 3 for exact 60° rotations, which
  closes the main exactness gap of `rotate(O, θ)` (SPEC §3.4).
- `PolyFractionField`, `DegreeBoundField`: used by the Phase 2 prover.

## Testing

- `packages/num/test/field-conformance.test.ts` runs one generic suite (field axioms,
  inverses, `Inexact` propagation, the divisor and square-root logs, `Complex<T>`)
  against all three fields.
- Coverage: `pnpm test:coverage` (part of `pnpm verify`) fails below 95% lines or
  branches.
- Mutation testing: `pnpm mutation:num` (Stryker, incremental; nightly in CI). Reports in
  `reports/mutation/num/`.
