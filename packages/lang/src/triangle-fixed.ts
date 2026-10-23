/**
 * `triangle ABC [type]` when some of the vertices exist (ADR-0025 decision 3, ADR-0028).
 * The new vertices are drawn from the statement's seed (as for three new points) so that
 * the triangle WITH the existing points has the type with the margin of ADR-0009 decision
 * 11. The drawing grid follows the existing points: centred on them, and with two of them
 * at distance d, scaled so that d counts as 4 units (the grid step is a power of ten, so the
 * coordinates stay exact decimals). With three existing points nothing is drawn: their
 * triangle must have the type (strictly, with the kernel's tolerance band).
 */
import { createRng } from '@geomira/num/rng';
import { MAX_SCALE, sign3, toleranceContext } from '@geomira/num/tolerance';
import { anglesOf, decimal, fits, sidesOf, type P, type TriangleType } from './triangle';

export type Placement =
  | { readonly ok: true; readonly points: readonly (readonly [string, string] | undefined)[] }
  | { readonly ok: false; readonly reason: string };

const DRAWS = 10_000;

/** The type's words, for messages: "acute", "obtuse at B", "scalene", "acute and scalene". */
export function typeWords(t: TriangleType, names: readonly string[]): string {
  const words: string[] = [];
  if (t.acute) words.push('acute');
  if (t.obtuse !== undefined) words.push(`obtuse at ${names[t.obtuse] ?? '?'}`);
  if (t.scalene) words.push('scalene');
  return words.join(' and ');
}

/**
 * Why three existing points do not have the type, or undefined when they do. Degenerate:
 * collinear points (within the band) have no type; a sign inside the band counts as not
 * having it (never reported as holding when it is not clear).
 */
function violation(
  pts: readonly [P, P, P],
  t: TriangleType,
  names: readonly string[],
): string | undefined {
  if (!t.acute && !t.scalene && t.obtuse === undefined) return undefined;
  const [a, b, c] = pts;
  const sides = sidesOf(a, b, c);
  const ctx = toleranceContext(Math.min(MAX_SCALE, Math.max(...sides)));
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const s = sign3(cross, 'area', ctx);
  if (s !== 1 && s !== -1)
    return `${names.join(', ').replace(/, ([^,]*)$/u, ' and $1')} are collinear`;
  const angles = anglesOf(a, b, c);
  const dots = pts.map((v, i) => {
    const p = pts[(i + 1) % 3] ?? v;
    const q = pts[(i + 2) % 3] ?? v;
    return sign3((p[0] - v[0]) * (q[0] - v[0]) + (p[1] - v[1]) * (q[1] - v[1]), 'area', ctx);
  });
  const angle = (i: number): string =>
    `its angle at ${names[i] ?? '?'} is ${String(Math.round(angles[i] ?? 0))}°`;
  const notAcute = dots.findIndex((d) => d !== 1);
  if (t.acute && notAcute >= 0) return angle(notAcute);
  if (t.obtuse !== undefined && dots[t.obtuse] !== -1) return angle(t.obtuse);
  const differ = (i: number, j: number): boolean => {
    const d = sign3((sides[i] ?? 0) - (sides[j] ?? 0), 'length', ctx);
    return d === 1 || d === -1;
  };
  if (t.scalene && !(differ(0, 1) && differ(1, 2) && differ(0, 2)))
    return 'two of its sides are equal';
  return undefined;
}

/** The unit length and the grid exponent (step 10^exp) for the existing points. */
function scaleOf(fixed: readonly P[]): { unit: number; exp: number } {
  const [p, q] = fixed;
  if (p === undefined || q === undefined) return { unit: 1, exp: -1 };
  const unit = Math.hypot(q[0] - p[0], q[1] - p[1]) / 4;
  return { unit, exp: Math.round(Math.log10(unit)) - 1 };
}

type Grid = readonly [number, number];

/**
 * Draws the new vertices around the existing ones, on the grid of step 10^exp. Degenerate:
 * no draw with the type in DRAWS tries, or grid coordinates beyond the safe integers (points
 * far from the origin with a tiny unit) → undefined.
 */
function drawAround(
  seed: number,
  t: TriangleType,
  given: readonly (P | undefined)[],
): (readonly [string, string] | undefined)[] | undefined {
  const fixed = given.filter((p): p is P => p !== undefined);
  const { unit, exp } = scaleOf(fixed);
  const step = 10 ** exp;
  const mean = (k: 0 | 1): number => fixed.reduce((s, p) => s + p[k], 0) / fixed.length;
  const centre: Grid = [Math.round(mean(0) / step), Math.round(mean(1) / step)];
  const half = Math.round((5 * unit) / step);
  const safe = centre.every((x) => Number.isSafeInteger(Math.abs(x) + half));
  if (!safe || !(half >= 1)) return undefined;
  const given2 = [0, 1, 2].map((i) => [1, 2].every((k) => given[(i + k) % 3] !== undefined));
  const rng = createRng(seed);
  const coord = (c: number): number => c + rng.nextInt(2 * half + 1) - half;
  for (let k = 0; k < DRAWS; k++) {
    const units = given.map((p): Grid | undefined =>
      p === undefined ? [coord(centre[0]), coord(centre[1])] : undefined,
    );
    const pts = given.map((p, i): P => {
      const u = units[i];
      return p ?? (u === undefined ? [0, 0] : [u[0] * step, u[1] * step]);
    });
    if (fits(pts, t, unit, given2)) {
      return units.map((u) =>
        u === undefined ? undefined : ([decimal(u[0], exp), decimal(u[1], exp)] as const),
      );
    }
  }
  return undefined;
}

/**
 * The places of the new vertices of `names` (undefined where `given` has the existing
 * point). Degenerate cases: three existing points without the type → not ok (why); two
 * existing points that coincide (within the band) → not ok; no draw with the type → not ok.
 */
export function placeAround(
  seed: number,
  t: TriangleType,
  names: readonly string[],
  given: readonly (P | undefined)[],
): Placement {
  const [a, b, c] = given;
  const label = `the triangle ${names.join('')}`;
  if (given.some((p) => p !== undefined && Math.max(Math.abs(p[0]), Math.abs(p[1])) > MAX_SCALE))
    return { ok: false, reason: `${label}: its points are too far out to be placed or checked` };
  if (a !== undefined && b !== undefined && c !== undefined) {
    const why = violation([a, b, c], t, names);
    return why === undefined
      ? { ok: true, points: [undefined, undefined, undefined] }
      : { ok: false, reason: `${label} is not ${typeWords(t, names)} here: ${why}` };
  }
  const fixedIdx = [0, 1, 2].filter((i) => given[i] !== undefined);
  const newNames = names.filter((_, i) => given[i] === undefined).join(' and ');
  const type = typeWords(t, names);
  const goal = type === '' ? 'a triangle' : `the triangle ${type}`;
  const [i, j] = fixedIdx;
  const p = i === undefined ? undefined : given[i];
  const q = j === undefined ? undefined : given[j];
  if (p !== undefined && q !== undefined) {
    const ctx = toleranceContext(Math.min(MAX_SCALE, Math.hypot(...p) + Math.hypot(...q)));
    if (sign3(Math.hypot(q[0] - p[0], q[1] - p[1]), 'length', ctx) !== 1) {
      const pair = `${names[i ?? 0] ?? '?'} and ${names[j ?? 0] ?? '?'}`;
      return {
        ok: false,
        reason: `triangle ${names.join('')}: ${pair} coincide here, so no place for ${newNames} makes ${goal}`,
      };
    }
  }
  const points = drawAround(seed, t, given);
  return points === undefined
    ? { ok: false, reason: `triangle ${names.join('')}: no place for ${newNames} makes ${goal}` }
    : { ok: true, points };
}
