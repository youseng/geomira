/**
 * Places for free points written without coordinates (ADR-0025, Geomdraw's `points A B C`
 * and `A = point()`): deterministic, as the `triangle` sugar's (triangle.ts): a seeded
 * generator (num's rng) whose seed is a hash of the statement's names, drawing points on a
 * 0.1 grid in [−5, 5]² until every two of them are at least MIN_APART apart. The text then
 * holds the coordinates (`A = (1.2, -0.4)`), so a saved file reproduces the figure.
 */
import { createRng } from '@geomira/num/rng';
import { fnv1a } from './triangle';

/** Two points of one statement are at least this far apart, in tenths (2 units). */
const MIN_APART = 20;

/** A coordinate on the 0.1 grid as an exact decimal. */
function decimal(tenths: number): string {
  const sign = tenths < 0 ? '-' : '';
  const n = Math.abs(tenths);
  const frac = n % 10;
  const whole = String(Math.floor(n / 10));
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac)}`;
}

function apart(pts: readonly (readonly [number, number])[]): boolean {
  return pts.every(([x, y], i) =>
    pts.slice(i + 1).every(([u, v]) => Math.hypot(x - u, y - v) >= MIN_APART),
  );
}

/**
 * The exact decimal coordinates of `names` (one statement's free points). Degenerate: more
 * names than fit apart in the square fall back, after 10 000 draws, to the last draw (two
 * points may then be close, never equal by construction of a draw: they are still free).
 */
export function freePlaces(keyword: string, names: readonly string[]): [string, string][] {
  const rng = createRng(fnv1a(`${keyword} ${names.join(' ')}`));
  let pts: [number, number][] = [];
  for (let k = 0; k < 10_000; k++) {
    pts = names.map(() => [rng.nextInt(101) - 50, rng.nextInt(101) - 50]);
    if (apart(pts)) break;
  }
  return pts.map(([x, y]) => [decimal(x), decimal(y)]);
}
