/**
 * The closure's rules for the v1 claim kinds (ADR-0035 decision 7): when a fact about the
 * figure's objects follows from the construction facts. A kind without a rule here is judged
 * by the generic rule alone (an instance of a declared guarantee, closure.ts), so a kind added
 * later is never wrongly hidden. Arguments are the objects' keys (undefined for literals).
 */
import type { Rational } from '@geomira/num/rational';
import { formatRational } from '@geomira/num/rational';
import type { ScreenArg } from '@geomira/claims/screen';
import type { ClosureView as Closure } from './closure-view';

type Keys = readonly (string | undefined)[];

function defined(keys: Keys): string[] | undefined {
  return keys.every((k): k is string => k !== undefined) ? [...keys] : undefined;
}

/** All points on one line class (or one circle class). */
function onOne(c: Closure, pts: readonly string[], circle: boolean): boolean {
  const classes = new Set(pts.map((p) => c.points.find(p)));
  if (classes.size < pts.length) return false;
  for (const s of (circle ? c.circleSets : c.lineSets).values())
    if ([...classes].every((p) => s.has(p))) return true;
  return false;
}

function lineClass(c: Closure, k: string): string | undefined {
  return c.isLine(k) ? c.lines.find(k) : undefined;
}

function concurrent(c: Closure, ls: readonly string[]): boolean {
  const classes = ls.map((l) => lineClass(c, l));
  const sets = classes.map((l) => (l === undefined ? undefined : c.lineSets.get(l)));
  if (sets.some((s) => s === undefined) || new Set(classes).size < ls.length) return false;
  const [first, ...rest] = sets;
  return [...(first ?? [])].some((p) => rest.every((s) => s?.has(p) === true));
}

function perpendicular(c: Closure, a: string, b: string): boolean {
  const [la, lb] = [lineClass(c, a), lineClass(c, b)];
  if (la === undefined || lb === undefined) return false;
  return c.perps.get(c.parallelClass(la))?.has(c.parallelClass(lb)) === true;
}

/**
 * A direction as the closure knows it: the class of a line up to parallels, written relative
 * to its perpendicular partner (`base` is the smaller of the pair, `turned` whether this
 * direction is the base turned by 90°). Turning both arms of a directed angle by 90° keeps it.
 */
function direction(
  c: Closure,
  x: string,
  y: string,
): { base: string; turned: boolean } | undefined {
  if (c.points.same(x, y)) return undefined;
  // Two points without a known line through them: that pair is its own direction.
  const l = c.lineThrough(x, y) ?? `pair:${c.segment(x, y)}`;
  const p = c.parallelClass(l);
  const [q] = [...(c.perps.get(p) ?? [])].map((x2) => c.parallels.find(x2));
  const base = q !== undefined && q < p ? q : p;
  return { base, turned: base !== p };
}

/**
 * ∡ABC = ∡DEF follows when the arms are, in order, parallel in the closure, or both turned by
 * 90° (line ED ⟂ line BA and line EF ⟂ line BC: the orthocentre's angles).
 */
function sameDirected(c: Closure, p: readonly string[]): boolean {
  const [a, b, cc, d, e, f] = p;
  if (a === undefined || b === undefined || cc === undefined) return false;
  if (d === undefined || e === undefined || f === undefined) return false;
  const [u1, v1, u2, v2] = [
    direction(c, b, a),
    direction(c, b, cc),
    direction(c, e, d),
    direction(c, e, f),
  ];
  if (u1 === undefined || v1 === undefined || u2 === undefined || v2 === undefined) return false;
  return (
    u1.base === u2.base &&
    v1.base === v2.base &&
    (u1.turned !== u2.turned) === (v1.turned !== v2.turned)
  );
}

/**
 * ∠ABC = ∠DEF (undirected) follows only for one vertex and the same arm points, in either
 * order. Arms on the same lines are not enough: with one arm reversed the angles are
 * supplementary, equal only at 90° (a finding, never to be hidden), and which side of the
 * vertex a point lies on is the configuration's, not the construction's.
 */
function sameUndirected(c: Closure, p: readonly string[]): boolean {
  const [a, b, cc, d, e, f] = p;
  if (a === undefined || b === undefined || cc === undefined) return false;
  if (d === undefined || e === undefined || f === undefined) return false;
  if (!c.points.same(b, e)) return false;
  const same = (x: string, y: string) => c.points.same(x, y);
  return (same(a, d) && same(cc, f)) || (same(a, f) && same(cc, d));
}

function litOf(args: readonly ScreenArg[], i: number): Rational | undefined {
  const a = args[i];
  return a !== undefined && 'lit' in a ? a.lit : undefined;
}

function lengthFact(c: Closure, k: readonly string[], lit: Rational | undefined): boolean {
  const [a, b, p, q] = k;
  if (a === undefined || b === undefined || p === undefined || q === undefined || lit === undefined)
    return false;
  const [s, t] = [c.segment(a, b), c.segment(p, q)];
  if (lit.num === 1n && lit.den === 1n) return c.lengths.same(s, t);
  const want = `q${formatRational(lit)}`;
  for (const r of c.ratios) {
    const [x, y, kk] = r.split('&');
    if (
      kk === want &&
      x !== undefined &&
      y !== undefined &&
      c.lengths.same(x, s) &&
      c.lengths.same(y, t)
    )
      return true;
  }
  return false;
}

/** Whether a fact of a v1 kind follows from the closure (false for kinds without a rule). */
export function constructionRule(
  c: Closure,
  kind: string,
  keys: Keys,
  args: readonly ScreenArg[],
): boolean {
  const k = defined(keys.filter((_, i) => !('lit' in (args[i] ?? { lit: 0 }))));
  if (k === undefined) return false;
  const [a, b] = k;
  switch (kind) {
    case 'collinear':
      return onOne(c, k, false);
    case 'concyclic':
      return onOne(c, k, true);
    case 'concurrent':
      return concurrent(c, k);
    case 'parallel': {
      const [la, lb] = [
        a === undefined ? undefined : lineClass(c, a),
        b === undefined ? undefined : lineClass(c, b),
      ];
      return (
        la !== undefined &&
        lb !== undefined &&
        la !== lb &&
        c.parallelClass(la) === c.parallelClass(lb)
      );
    }
    case 'perpendicular':
      return a !== undefined && b !== undefined && perpendicular(c, a, b);
    case 'on': {
      if (a === undefined || b === undefined) return false;
      const sets = c.isLine(b)
        ? c.lineSets.get(c.lines.find(b))
        : c.isCircle(b)
          ? c.circleSets.get(c.circles.find(b))
          : undefined;
      return sets?.has(c.points.find(a)) === true;
    }
    case 'tangent':
      return (
        a !== undefined &&
        b !== undefined &&
        c.tangents.has([c.classOf(a), c.classOf(b)].sort().join('&'))
      );
    case 'equal':
      return a !== undefined && b !== undefined && c.points.same(a, b);
    case 'length':
      return lengthFact(c, k, litOf(args, 4));
    case 'dangle':
      return litOf(args, 0)?.num === 1n && litOf(args, 0)?.den === 1n && sameDirected(c, k);
    case 'angle_eq':
      return sameUndirected(c, k);
    default:
      return false;
  }
}
