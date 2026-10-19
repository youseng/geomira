/** Shared machinery of the law tests. */
import type { Field } from '@geomira/num/field';
import { bandThreshold, type Dim, type ToleranceContext } from '@geomira/num/tolerance';

/**
 * The iteration count of a law test. `GEOMIRA_LAW_SCALE` (a factor in (0, 1]) is set ONLY
 * by vitest.kernel.config.ts, so that mutation testing re-runs the laws on fewer
 * documents per mutant; `pnpm verify` and CI always run the full counts.
 */
export function lawCount(n: number): number {
  const raw = process.env.GEOMIRA_LAW_SCALE;
  const f = raw === undefined ? 1 : Number(raw);
  return f > 0 && f < 1 ? Math.max(1, Math.round(n * f)) : n;
}

/**
 * FloatField that records whether any zero test or sign decision saw a quantity within
 * the BAND of zero (|x| < BAND·scale^k): such inputs are "within BAND of a degeneracy"
 * and are excluded from the exact-oracle comparison (law L3).
 */
export interface BandWatch {
  readonly field: Field<number>;
  touched(): boolean;
  reset(): void;
}

export function bandWatch(F: Field<number>): BandWatch {
  let hit = false;
  const near = (x: number, dim: Dim, ctx: ToleranceContext): void => {
    if (Math.abs(x) < bandThreshold(dim, ctx)) hit = true;
  };
  const field: Field<number> = {
    ...F,
    isZero: (x, dim, ctx) => {
      near(x, dim, ctx);
      return F.isZero(x, dim, ctx);
    },
    sign: (x, dim, ctx) => {
      near(x, dim, ctx);
      return F.sign(x, dim, ctx);
    },
  };
  return {
    field,
    touched: () => hit,
    reset: () => {
      hit = false;
    },
  };
}

/** Timeout of a law test (ms): they run thousands of evaluations, slower under coverage. */
export const LAW_TIMEOUT = 120_000;
