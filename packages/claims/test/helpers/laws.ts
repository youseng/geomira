/**
 * The iteration count of a law test. `GEOMIRA_LAW_SCALE` (a factor in (0, 1]) is set ONLY
 * by vitest.claims.config.ts, so that mutation testing re-runs the corpora on fewer seeds
 * per mutant; `pnpm verify` and CI always run the full counts.
 */
export function lawCount(n: number): number {
  const raw = process.env.GEOMIRA_LAW_SCALE;
  const f = raw === undefined ? 1 : Number(raw);
  return f > 0 && f < 1 ? Math.max(1, Math.round(n * f)) : n;
}
