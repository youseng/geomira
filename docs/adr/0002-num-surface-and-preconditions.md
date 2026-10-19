# ADR-0002: Package surfaces via subpath exports; numeric preconditions; coverage gate

Status: accepted (Run 1). Extends ADR-0001 (items 13 and 14); supersedes nothing.

## Context

Run 1 builds packages/num (SPEC §3). Several decisions taken here bind later runs:

1. Every package's frozen Run 0 test `packages/*/test/index.test.ts` asserts that the root
   entry exports exactly `VERSION`. Test files from earlier runs are add-only, so the
   root entry cannot grow without an ADR-justified test change.
2. SPEC §3 fixes the constants, the Field operations and the verdict thresholds, but not
   what a numeric primitive does when called outside its domain (division by an exact
   zero, √ of a negative number, atan2(0, 0), NaN), nor the exact boundary conventions of
   the zero tests and the band.
3. CLAUDE.md requires num coverage ≥ 95% (lines and branches) for this run; nothing in
   `pnpm verify` measured coverage.

## Decision

### Public surface (all packages)

- A package's root entry (`.`) exports only `VERSION`. Its API lives in **subpath
  modules** declared one by one in package.json `exports`, e.g. `@geomira/num/field`,
  `@geomira/num/tolerance`. Modules not listed there (num's `bigint.ts`, `trig.ts`) are
  internal. A test per package lists every subpath and the exact names each exports
  (num: `packages/num/test/exports.test.ts`), so the surface only changes deliberately.
- num's subpaths: `tolerance`, `rng`, `rational`, `field`, `float-field`,
  `rational-field`, `modp`, `complex`, `assert` (`assertNever`, shared by all packages
  because num is the bottom of the dependency graph).

### Numeric conventions (num)

- **Preconditions throw `RangeError`.** A call outside a primitive's domain is a caller
  bug, never a silent answer and never NaN/±Infinity: `div` by an exact zero (every
  field), `sqrt` of a negative element (Float, Rational), `atan2(0, 0)`, non-finite
  input to the zero tests, sin/cos/atan2 of FloatField, invalid seeds or RNG states,
  `toNumber` of a rational beyond the double range. Callers (the kernel) test with
  `F.isZero` / `F.sign` first and turn the degenerate case into an Undefined Value with a
  reason (SPEC §4); law L1 fuzzing then guards that no throw escapes `evaluate`.
- **Not representable → `Inexact`** (never a throw): √ of a non-square rational, trig off
  the special angles, anything sqrt/trig mod p, `fromRational` of a value beyond the
  double range (FloatField) or with a denominator divisible by p (ModPField). So
  `Field.fromRational` returns `T | Inexact`.
- **Zero tests are inclusive**: |x| ≤ EPS·scale^k. **`sign3`**: |x| ≤ EPS·scale^k → 0;
  below BAND·scale^k → `'ambiguous'`; from BAND·scale^k on → ±1. FloatField's `sign` is
  `sign3`, so a decision never flips between −1 and 1 without passing through 0 or
  `'ambiguous'`.
- **Scale**: `toleranceContext(diameter)` gives scale = max(1, diameter) (SPEC: ≥ 1). A
  new constant `MAX_SCALE = 1e100` bounds it: above it EPS·scale² approaches the double
  range, so such a figure is rejected (RangeError) instead of getting meaningless
  thresholds.
- **Angles are in degrees** in every field (the language's unit). atan2 is in
  (−180°, 180°]. FloatField returns the same exact special values as RationalField
  (sin/cos at multiples of 30° where rational; atan2 on axes and diagonals), so the two
  fields agree bit for bit there (helps law L3).
- **Field** carries `kind: 'float' | 'rational' | 'modp'` and a `name` (for rung reports).
  ModPField's `toNumber` returns the symmetric representative (diagnostics only).
- **RNG**: xoshiro128\*\* seeded through splitmix32/fmix32 from a safe-integer seed; the
  first outputs of several seeds are pinned by a test so that a verdict's seed reproduces
  its samples across versions. Changing the generator or the seeding needs an ADR.

### Coverage and mutation testing

- `pnpm verify` runs `pnpm test:coverage` (`vitest run --coverage`) instead of
  `pnpm test`: the same tests, plus per-package thresholds in vitest.config.ts. num:
  lines and branches ≥ 95%. Later runs add their packages to `coverage.include` and
  `coverage.thresholds`.
- Mutation testing: one Stryker config per package (`stryker.<pkg>.json`, vitest runner,
  TypeScript checker, incremental) with a vitest config limited to that package's tests
  (`vitest.<pkg>.config.ts`), run nightly by nightly.yml with the incremental file kept
  in the Actions cache. No break threshold until v1.1 (SPEC §17 L15).

## Consequences

- Kernel code imports `@geomira/num/field` etc.; no barrel file can drift from the tests.
- Kernel tools must check divisors and radicands before dividing or taking roots; a
  forgotten check shows up as a thrown RangeError in L1 fuzzing, never as a NaN.
- A coverage regression in num fails `pnpm verify` locally and in CI.

## Alternatives considered

- Changing the frozen `index.test.ts` under an ADR to allow a barrel root entry: rejected;
  subpath modules need no frozen-test change and make the surface explicit per module.
- Returning `Inexact` (or NaN) for out-of-domain calls: rejected; `Inexact` means "not
  representable in this field", not "the caller skipped a degeneracy check", and NaN is
  forbidden.
- Clamping a tiny negative radicand to 0 inside `sqrt`: rejected as a silent decision;
  the caller decides with `F.isZero`/`F.sign`, where the band applies.
- A separate coverage command outside verify: rejected; CI would need a second step to
  enforce what CLAUDE.md makes an acceptance criterion.
