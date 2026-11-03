# ADR-0056: gcd by Lehmer's algorithm; bitLength in hexadecimal

Status: accepted (maintainer request "usability", found by its cold nightly, 2026-10-31). Changes
`packages/num/src/bigint.ts` only (the internal helpers behind RationalField); no public surface
changes.

## Context

The cold nightly on 5fef14e (run 41218368581, dispatched with `full`) ran thirteen of its twenty
mutation shards into Stryker's 100-minute limit. ADR-0038 had brought every shard's cold run within
it (the longest 91 minutes). In the kernel shards the minutes went to timed-out mutants. Each one costs
about 1.5 times the run time of the tests that cover it. One frozen test that covers almost every
tool, `packages/kernel/test/hunt-extreme.test.ts`, took 118 s under the mutation config instead
of 33 s on run-16c: its RationalField part went from 14.7 s to 95.7 s.

The test draws its documents from a seeded generator that walks the registry's tools and
signatures. Item 1 (ADR-0045) adds tools and overloads, so the walk draws other documents. One of
them calls `foci` over Q on a conic whose coefficients have about 16,700 digits. That single
call took 37–48 s. A CPU profile put 97 % of it in `gcd`, which normalises every exact rational
result: Euclid's algorithm with BigInt remainders is quadratic, about 0.5–1.1 s per gcd of two
55,000-bit numbers here.

## Decision

1. **gcd by Lehmer's algorithm** (Knuth, TAOCP vol. 2, §4.5.2, Algorithm L) for numbers of 2⁶⁴
   and more. The quotients of Euclid's steps are computed on the leading 63 bits as long as both
   bounds of the cosequence agree, then applied to the full numbers in one step. When the first
   quotient already disagrees, one Euclid step is taken. Smaller numbers keep Euclid. The result
   is Euclid's on every input: each accepted quotient is a true quotient, and the combined step is
   a product of Euclid steps. The shift that cuts the leading bits is measured once and again only
   when the leading part has fallen below 40 bits. A larger shift than necessary is as correct,
   only less efficient.
2. **bitLength from the hexadecimal string** (a quarter of the binary string's length; the first
   digit gives its bits). The value is unchanged; it is also used by the exact rung's size budget.
3. Measured (this container): one gcd of two 55,000-bit numbers 1,109 → 54 ms, 10,000-bit 13.8 →
   2.4 ms, 1,000-bit 0.15 → 0.10 ms. The `foci` call above 37 s → 3.5 s. `hunt-extreme` under the
   mutation config: RationalField 95.7 → 14.2 s (run-16c: 14.7). The kernel's mutation test set
   (`vitest.kernel.config.ts`): 302 → 213 s (run-16c: 199).

## Consequences

- Every exact computation on large numbers is faster: the kernel's exact oracle, the claims' exact
  rung, Randomize's rounding.
- `packages/num/test/gcd-lehmer.test.ts` checks the result against Euclid on 1,500 random pairs
  with common factors, around the 64-bit switch, on consecutive Fibonacci numbers (every quotient
  1), on a huge quotient, equal numbers, powers of two and zero. It also checks that Lehmer is at
  least three times faster than Euclid on 30,000-bit numbers, a relative measure that holds on any
  machine. That test failed before the change.
- num's mutation gate (≥ 80 %) covers the new loop; the tests above are its behaviour tests.

## Alternatives considered

- **Restoring the old documents of `hunt-extreme`** by putting new tools at the end of the
  registry's walk: it hides the slow path instead of removing it.
- **A size budget in the kernel's exact evaluation** (as the claims' exact rung has): a semantic
  change to the oracle for a performance problem of one helper.
- **Binary gcd**: no faster than Euclid with BigInt shifts in V8.
