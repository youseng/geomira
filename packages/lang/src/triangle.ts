/**
 * `triangle A B C [type]` (SPEC §6.2, §11.1): three free points, the polygon and the
 * `assume` lines of the type. Types: `acute`, `scalene`, `obtuse_at_V` (V one of the three
 * names). The points are deterministic: a seeded generator (num's rng) whose seed is a hash
 * of the statement (names and types), drawing points on a 0.1 grid in [−5, 5]² until the
 * triangle has the type with a clear margin (every angle at least 15°; acute: every angle
 * at most 80°; obtuse at V: 100° to 150° at V; scalene: sides differing by 10%). Right
 * angles are constructed, never assumed.
 */
import { createRng } from '@geomira/num/rng';
import type { Condition, ExprNode, NameRef } from './ast';
import type { Span } from './diagnostic';

export interface TriangleType {
  readonly acute: boolean;
  readonly scalene: boolean;
  /** Index (0–2) of the obtuse vertex. */
  readonly obtuse?: number;
}

export interface Expansion {
  /** Exact decimal coordinates, as written in the definitions. */
  readonly points: readonly (readonly [string, string])[];
  readonly conditions: readonly Condition[];
  /** The statement's seed (names and sorted types), for vertices drawn around existing ones. */
  readonly seed: number;
}

/** FNV-1a (32 bit) of a string's UTF-16 code units. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export type P = readonly [number, number];

/** The angle at b, in degrees. */
export function angleAt(a: P, b: P, c: P): number {
  const [ux, uy, vx, vy] = [a[0] - b[0], a[1] - b[1], c[0] - b[0], c[1] - b[1]];
  return (Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * 180) / Math.PI;
}

/** The angles at the three vertices, in degrees. */
export function anglesOf(a: P, b: P, c: P): [number, number, number] {
  return [angleAt(c, a, b), angleAt(a, b, c), angleAt(b, c, a)];
}

/** The sides opposite the three vertices. */
export function sidesOf(a: P, b: P, c: P): [number, number, number] {
  return [
    Math.hypot(b[0] - c[0], b[1] - c[1]),
    Math.hypot(c[0] - a[0], c[1] - a[1]),
    Math.hypot(a[0] - b[0], a[1] - b[1]),
  ];
}

/**
 * Whether the triangle has the type with the margin of ADR-0009 decision 11. Lengths are
 * in `unit`s (sides ≥ 2 units); a side marked `given` (both ends exist) is not checked
 * for length. Degenerate: fewer than three points → false.
 */
export function fits(
  pts: readonly P[],
  t: TriangleType,
  unit = 1,
  given: readonly boolean[] = [],
): boolean {
  const [a, b, c] = pts;
  if (a === undefined || b === undefined || c === undefined) return false;
  const angles = anglesOf(a, b, c);
  if (angles.some((x) => x < 15)) return false;
  if (t.acute && angles.some((x) => x > 80)) return false;
  const o = t.obtuse === undefined ? undefined : angles[t.obtuse];
  if (o !== undefined && (o < 100 || o > 150)) return false;
  if (t.obtuse === undefined && !t.acute && angles.some((x) => x > 150)) return false;
  const sides = sidesOf(a, b, c);
  if (sides.some((x, i) => given[i] !== true && x < 2 * unit)) return false;
  if (!t.scalene) return true;
  const s = [...sides].sort((x, y) => x - y);
  return (s[1] ?? 0) > 1.1 * (s[0] ?? 0) && (s[2] ?? 0) > 1.1 * (s[1] ?? 0);
}

/**
 * `units` × 10^`exp` as an exact decimal (`decimal(-35)` = "-3.5", `decimal(4, 2)` = "400",
 * `decimal(7, -3)` = "0.007"); units is an integer.
 */
export function decimal(units: number, exp = -1): string {
  const sign = units < 0 ? '-' : '';
  const digits = String(Math.abs(units));
  if (exp >= 0) return units === 0 ? '0' : `${sign}${digits}${'0'.repeat(exp)}`;
  const padded = digits.padStart(1 - exp, '0');
  const whole = padded.slice(0, exp);
  const frac = padded.slice(exp).replace(/0+$/u, '');
  return frac === '' ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
}

/** The points for a hash; a fixed fallback after 10 000 draws (never reached in tests). */
function draw(seed: number, t: TriangleType): (readonly [number, number])[] {
  const rng = createRng(seed);
  for (let k = 0; k < 10_000; k++) {
    const tenths = Array.from({ length: 6 }, () => rng.nextInt(101) - 50);
    const pts: P[] = [0, 1, 2].map((i) => [
      (tenths[2 * i] ?? 0) / 10,
      (tenths[2 * i + 1] ?? 0) / 10,
    ]);
    if (fits(pts, t)) return [0, 1, 2].map((i) => [tenths[2 * i] ?? 0, tenths[2 * i + 1] ?? 0]);
  }
  return [
    [-30, -20],
    [35, -15],
    [5, 30],
  ];
}

function call(tool: string, args: readonly ExprNode[], span: Span): ExprNode {
  return { kind: 'call', tool, args, selectors: [], span };
}

/** The expansion of a triangle statement whose type is already checked. */
export function expandTriangle(
  names: readonly NameRef[],
  t: TriangleType,
  types: readonly string[],
  span: Span,
): Expansion {
  const key = `triangle ${names.map((n) => n.name).join(' ')} [${[...types].sort().join(',')}]`;
  const seed = fnv1a(key);
  const points = draw(seed, t).map(([x, y]) => [decimal(x), decimal(y)] as const);
  const refs: ExprNode[] = names.map((n) => ({ kind: 'name', name: n.name, span: n.span }));
  const conditions: Condition[] = [];
  if (t.acute) conditions.push({ kind: 'acute', args: refs, span });
  if (t.scalene) conditions.push({ kind: 'scalene', args: refs, span });
  if (t.obtuse !== undefined) {
    const at = refs[t.obtuse];
    const others = refs.filter((_, i) => i !== t.obtuse);
    const [p, q] = others;
    if (at !== undefined && p !== undefined && q !== undefined) {
      conditions.push({
        kind: 'greater',
        args: [call('angle', [p, at, q], span), { kind: 'num', text: '90', span }],
        span,
      });
    }
  }
  return { points, conditions, seed };
}

/** The polygon's name: `tri_` and the vertex names (letters, digits, `_`), unused. */
export function polygonName(names: readonly string[], taken: (n: string) => boolean): string {
  const base = `tri_${names.map((n) => n.replace(/[^A-Za-z0-9_]/gu, '')).join('')}`;
  if (!taken(base)) return base;
  for (let k = 2; ; k++) if (!taken(`${base}_${String(k)}`)) return `${base}_${String(k)}`;
}
