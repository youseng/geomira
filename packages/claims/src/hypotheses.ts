/**
 * Hypotheses (SPEC §10.3): `assume` lines are OPEN conditions, checked in the float figure
 * with a BAND margin: a deciding quantity inside the band is AMBIGUOUS (the sample is
 * rejected, never silently accepted). Equality assumptions are refused ("construct it"):
 * a figure that satisfies an equality must be constructed, and right angles are
 * constructed, never assumed.
 *   acute(A, B, C) · scalene(A, B, C) · convex(A, B, C, D, …) · inside(P, polygon) ·
 *   in_order(P₁, …, Pₙ, curve) (along a line either way, or cyclically on a circle either
 *   way) · less(x, y) · greater(x, y) · not_equal(x, y), where x and y are angle(…) or
 *   dist(…) measures or numbers (angles in degrees, compared with angles; lengths with
 *   lengths).
 */
import { assertNever } from '@geomira/num/assert';
import { sign3, type Sign3, type ToleranceContext } from '@geomira/num/tolerance';
import type { Assumption } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import * as f from './float';
import { CLAIM_KINDS } from './kinds';

export type HypStatus = 'holds' | 'fails' | 'ambiguous';

/** The unit a comparison is decided in: degrees (as a fraction of a half turn) or lengths. */
export type MeasureDim = 'angle' | 'length' | 'number';

export const ASSUMPTION_KINDS: readonly string[] = Object.freeze([
  'acute',
  'scalene',
  'convex',
  'inside',
  'in_order',
  'less',
  'greater',
  'not_equal',
]);

/** Kinds that state an equality (or a right angle): refused with "construct it". */
const EQUALITY_KINDS: readonly string[] = Object.freeze([
  'equal',
  'eq',
  'equals',
  'right',
  'isosceles',
  'equilateral',
  ...CLAIM_KINDS.map((k) => k.name),
]);

function measureDim(e: Expr): MeasureDim | undefined {
  if (e.kind === 'lit') return 'number';
  if (e.kind !== 'call') return undefined;
  if (e.tool === 'angle' && e.args.length === 3 && e.selectors.length === 0) return 'angle';
  if (e.tool === 'dist' && e.args.length === 2 && e.selectors.length === 0) return 'length';
  return undefined;
}

export type DimResult =
  { readonly ok: true; readonly dim: MeasureDim } | { readonly ok: false; readonly reason: string };

/** The dimension of a comparison, or a problem (mixed or unsupported measures). */
export function comparisonDim(args: readonly Expr[]): DimResult {
  const [x, y] = args;
  if (args.length !== 2 || x === undefined || y === undefined) {
    return { ok: false, reason: 'a comparison takes two measures' };
  }
  const [dx, dy] = [measureDim(x), measureDim(y)];
  if (dx === undefined || dy === undefined) {
    return {
      ok: false,
      reason: 'compare angle(…) or dist(…) measures with each other or with a number',
    };
  }
  if (dx !== 'number' && dy !== 'number' && dx !== dy) {
    return { ok: false, reason: 'compare angles with angles and lengths with lengths' };
  }
  return { ok: true, dim: dx === 'number' ? dy : dx };
}

/**
 * Why an assumption is not acceptable (the language run reports it as a parse error), or
 * undefined. Equality assumptions → "construct it".
 */
export function assumptionProblem(a: Assumption): string | undefined {
  if (EQUALITY_KINDS.includes(a.kind)) {
    return `equality assumptions are not allowed: construct it instead of assuming ${a.kind}(…)`;
  }
  if (!ASSUMPTION_KINDS.includes(a.kind)) return `unknown assumption "${a.kind}"`;
  const n = a.args.length;
  switch (a.kind) {
    case 'acute':
    case 'scalene':
      return n === 3 ? undefined : `${a.kind} takes three points`;
    case 'convex':
      return n >= 3 ? undefined : 'convex takes at least three points';
    case 'inside':
      return n === 2 ? undefined : 'inside takes a point and a polygon';
    case 'in_order':
      return n >= 3 ? undefined : 'in_order takes at least two points and a curve';
    case 'less':
    case 'greater':
    case 'not_equal': {
      const d = comparisonDim(a.args);
      return d.ok ? undefined : d.reason;
    }
    default:
      return `unknown assumption "${a.kind}"`;
  }
}

function pts(args: readonly Value<number>[], from: number, to: number): f.V[] | undefined {
  const out: f.V[] = [];
  for (let i = from; i < to; i++) {
    const v = args[i];
    if (v?.kind !== 'point') return undefined;
    out.push(v);
  }
  return out;
}

/** All signs strictly ±1 and equal → holds; any ambiguous → ambiguous; else fails. */
function sameSign(signs: readonly Sign3[]): HypStatus {
  if (signs.includes('ambiguous')) return 'ambiguous';
  if (signs.every((s) => s === 1) || signs.every((s) => s === -1)) return 'holds';
  return 'fails';
}

function allPositive(signs: readonly Sign3[]): HypStatus {
  if (signs.every((s) => s === 1)) return 'holds';
  return signs.some((s) => s === 0 || s === -1) ? 'fails' : 'ambiguous';
}

/** The smallest height of triangle abc (signed by orientation), as a length. */
function height(a: f.V, b: f.V, c: f.V): number {
  const longest = Math.max(f.dist(a, b), f.dist(a, c), f.dist(b, c));
  return longest > 0 ? f.cross(f.sub(b, a), f.sub(c, a)) / longest : 0;
}

function acute(p: readonly f.V[], ctx: ToleranceContext): HypStatus {
  const signs: Sign3[] = [0, 1, 2].map((i) => {
    const [a, b, c] = [p[i], p[(i + 1) % 3], p[(i + 2) % 3]];
    if (a === undefined || b === undefined || c === undefined) return 0;
    const [u, v] = [f.sub(b, a), f.sub(c, a)];
    const n = f.norm(u) * f.norm(v);
    return n > 0 ? sign3(f.dot(u, v) / n, 'dimensionless', ctx) : 0;
  });
  return allPositive(signs);
}

function scalene(p: readonly f.V[], ctx: ToleranceContext): HypStatus {
  const [a, b, c] = p;
  if (a === undefined || b === undefined || c === undefined) return 'fails';
  const [ab, bc, ca] = [f.dist(a, b), f.dist(b, c), f.dist(c, a)];
  return allPositive([ab - bc, bc - ca, ca - ab].map((d) => sign3(Math.abs(d), 'length', ctx)));
}

function convex(p: readonly f.V[], ctx: ToleranceContext): HypStatus {
  const n = p.length;
  const turns: Sign3[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b, c] = [p[i], p[(i + 1) % n], p[(i + 2) % n]];
    turns.push(
      a === undefined || b === undefined || c === undefined
        ? 0
        : sign3(height(a, b, c), 'length', ctx),
    );
  }
  const first = p[0];
  for (let i = 1; i + 1 < n && first !== undefined; i++) {
    const [b, c] = [p[i], p[i + 1]];
    if (b !== undefined && c !== undefined) turns.push(sign3(height(first, b, c), 'length', ctx));
  }
  return sameSign(turns);
}

/** Distance from P to segment AB. */
function segmentDistance(P: f.V, A: f.V, B: f.V): number {
  const d = f.sub(B, A);
  const dd = f.dot(d, d);
  const t = dd > 0 ? Math.min(1, Math.max(0, f.dot(f.sub(P, A), d) / dd)) : 0;
  return f.dist(P, { x: A.x + t * d.x, y: A.y + t * d.y });
}

function inside(P: f.V, poly: readonly f.V[], ctx: ToleranceContext): HypStatus {
  let crossings = 0;
  for (let i = 0; i < poly.length; i++) {
    const [A, B] = [poly[i], poly[(i + 1) % poly.length]];
    if (A === undefined || B === undefined) return 'fails';
    const s = sign3(segmentDistance(P, A, B), 'length', ctx);
    if (s === 0) return 'fails';
    if (s === 'ambiguous') return 'ambiguous';
    if (A.y > P.y !== B.y > P.y && P.x < A.x + ((P.y - A.y) * (B.x - A.x)) / (B.y - A.y))
      crossings++;
  }
  return crossings % 2 === 1 ? 'holds' : 'fails';
}

function inOrder(p: readonly f.V[], curve: Value<number>, ctx: ToleranceContext): HypStatus {
  if (curve.kind === 'line') {
    const len = f.norm(curve.d);
    const ts = p.map((q) => f.dot(f.sub(q, curve.p), curve.d) / len);
    return sameSign(ts.slice(1).map((t, i) => sign3(t - (ts[i] ?? t), 'length', ctx)));
  }
  if (curve.kind === 'circle') {
    const first = p[0];
    const fan: Sign3[] = [];
    for (let i = 1; i + 1 < p.length && first !== undefined; i++) {
      const [b, c] = [p[i], p[i + 1]];
      if (b !== undefined && c !== undefined) fan.push(sign3(height(first, b, c), 'length', ctx));
    }
    return p.length < 3 ? 'holds' : sameSign(fan);
  }
  return 'fails';
}

function compare(
  kind: 'less' | 'greater' | 'not_equal',
  x: number,
  y: number,
  dim: MeasureDim,
  ctx: ToleranceContext,
): HypStatus {
  const d = dim === 'angle' ? (x - y) / 180 : x - y;
  const s = sign3(d, dim === 'length' ? 'length' : 'dimensionless', ctx);
  if (s === 'ambiguous') return 'ambiguous';
  switch (kind) {
    case 'less':
      return s === -1 ? 'holds' : 'fails';
    case 'greater':
      return s === 1 ? 'holds' : 'fails';
    case 'not_equal':
      return s === 0 ? 'fails' : 'holds';
    default:
      return assertNever(kind, 'comparison');
  }
}

/**
 * Checks an (acceptable) assumption on the float values of its arguments. An argument of
 * the wrong kind (an undefined object) → fails: the sample does not satisfy it.
 */
export function checkAssumption(
  kind: string,
  args: readonly Value<number>[],
  dim: MeasureDim,
  ctx: ToleranceContext,
): HypStatus {
  const n = args.length;
  switch (kind) {
    case 'acute':
    case 'scalene': {
      const p = pts(args, 0, 3);
      if (p === undefined) return 'fails';
      return kind === 'acute' ? acute(p, ctx) : scalene(p, ctx);
    }
    case 'convex': {
      const p = pts(args, 0, n);
      return p === undefined ? 'fails' : convex(p, ctx);
    }
    case 'inside': {
      const [P, poly] = args;
      return P?.kind === 'point' && poly?.kind === 'polygon' ? inside(P, poly.pts, ctx) : 'fails';
    }
    case 'in_order': {
      const p = pts(args, 0, n - 1);
      const c = args[n - 1];
      return p === undefined || c === undefined ? 'fails' : inOrder(p, c, ctx);
    }
    case 'less':
    case 'greater':
    case 'not_equal': {
      const [x, y] = args;
      return x?.kind === 'number' && y?.kind === 'number'
        ? compare(kind, x.v, y.v, dim, ctx)
        : 'fails';
    }
    default:
      return 'fails';
  }
}
