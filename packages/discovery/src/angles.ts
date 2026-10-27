/**
 * Angle chasing as linear algebra (ADR-0039): directed angles mod 180° are linear in the
 * directions of lines. Each direction is a variable (a parallel class of the closure, or the
 * line through two points the closure knows no line for), each point of a circle has a
 * half-angle variable t (a chord PQ has direction t_P + t_Q + 90°, the radius OP direction
 * 2·t_P, the tangent at P direction 2·t_P + 90°), and each map a turn variable φ. The known facts
 * become integer congruences in the lattice (lattice.ts): perpendicular classes, the circles and
 * the circles of equal distances of the closure, tangents at their points, the maps' rules, and
 * the shown angle facts (the maps' rows: angle-maps.ts; the lattice: angle-lattice.ts).
 *
 * Every rule here is exact and holds wherever the points it uses stay apart (the closure's
 * convention, ADR-0035 decision 7); an undirected angle uses the orientations of this figure.
 */
import type { Rational } from '@geomira/num/rational';
import { constructionRows, lineDir, pointDir } from './angle-rules';
import type { ClosureState, TermArg } from './closure-view';
import { CONST, type Vector } from './lattice';

/** Points per circle whose chords are related (pairs grow quadratically). */
export const MAX_CIRCLE_POINTS = 30;

/** Direction and auxiliary variables by name → lattice column. */
export class AngleVars {
  private readonly cols = new Map<string, number>();

  col(name: string): number {
    const c = this.cols.get(name);
    if (c !== undefined) return c;
    const n = this.cols.size;
    this.cols.set(name, n);
    return n;
  }
}

/** A congruence under construction: Σ terms ≡ constant (degrees). */
export class Row {
  readonly v: Vector = new Map();
  constructor(private readonly vars: AngleVars) {}

  add(name: string, k: number): this {
    const c = this.vars.col(name);
    const x = (this.v.get(c) ?? 0) + k;
    if (x === 0) this.v.delete(c);
    else this.v.set(c, x);
    return this;
  }

  /** Σ ≡ degrees: the constant column holds −degrees. */
  equals(degrees: number): Vector {
    const out = new Map(this.v);
    if (degrees !== 0) out.set(CONST, -degrees);
    return out;
  }
}

/** Integer degrees of an exact literal, if it is one. */
export function degrees(r: Rational | undefined): number | undefined {
  if (r === undefined || r.den !== 1n) return undefined;
  const n = Number(r.num);
  return Number.isSafeInteger(n) ? n : undefined;
}

/** The orientation of A, B, C in the figure (sign of cross(A − B, C − B)), if clear. */
function orientation(c: ClosureState, a: string, b: string, cc: string): 1 | -1 | undefined {
  const [pa, pb, pc] = [c.at(a), c.at(b), c.at(cc)];
  if (pa === undefined || pb === undefined || pc === undefined) return undefined;
  const cross = (pa.x - pb.x) * (pc.y - pb.y) - (pa.y - pb.y) * (pc.x - pb.x);
  const size = Math.hypot(pa.x - pb.x, pa.y - pb.y) * Math.hypot(pc.x - pb.x, pc.y - pb.y);
  if (!(size > 0) || Math.abs(cross) <= c.band * Math.sqrt(size)) return undefined;
  return cross > 0 ? 1 : -1;
}

/** ∡ABC as a row (d(BC) − d(BA)), scaled by s; undefined when a direction is unknown. */
function angleRow(c: ClosureState, r: Row, a: string, b: string, cc: string, s: number): boolean {
  const [ba, bc] = [pointDir(c, b, a), pointDir(c, b, cc)];
  if (ba === undefined || bc === undefined) return false;
  r.add(bc, s).add(ba, -s);
  return true;
}

function keysOf(args: readonly TermArg[]): string[] | undefined {
  const out: string[] = [];
  for (const a of args) if ('key' in a) out.push(a.key);
  return out;
}

function litAt(args: readonly TermArg[], i: number): Rational | undefined {
  const a = args[i];
  return a !== undefined && 'lit' in a ? a.lit : undefined;
}

/** Pairwise apart, and the first three not collinear (a circle through them). */
function circleBase(c: ClosureState, pts: readonly string[]): boolean {
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) if (!c.apart(pts[i] ?? '', pts[j] ?? '')) return false;
  const [a, b, d] = pts;
  return (
    a !== undefined && b !== undefined && d !== undefined && orientation(c, a, d, b) !== undefined
  );
}

/**
 * The congruences a fact amounts to (all must hold), or undefined when the lattice cannot speak
 * of it (a kind without angle content, a literal it cannot use, a degenerate configuration).
 */
export function factRows(
  c: ClosureState,
  vars: AngleVars,
  kind: string,
  args: readonly TermArg[],
): Vector[] | undefined {
  const k = keysOf(args) ?? [];
  const row = () => new Row(vars);
  switch (kind) {
    case 'dangle': {
      const [a, b, cc, d, e, f] = k;
      const n = litAt(args, 0);
      if (n?.num !== 1n || n.den !== 1n || f === undefined || a === undefined || b === undefined)
        return undefined;
      const r = row();
      if (cc === undefined || d === undefined || e === undefined) return undefined;
      return angleRow(c, r, a, b, cc, 1) && angleRow(c, r, d, e, f, -1) ? [r.equals(0)] : undefined;
    }
    case 'angle_eq': {
      const [a, b, cc, d, e, f] = k;
      if (a === undefined || b === undefined || cc === undefined) return undefined;
      if (d === undefined || e === undefined || f === undefined) return undefined;
      const [s1, s2] = [orientation(c, a, b, cc), orientation(c, d, e, f)];
      if (s1 === undefined || s2 === undefined) return undefined;
      const r = row();
      return angleRow(c, r, a, b, cc, s1) && angleRow(c, r, d, e, f, -s2)
        ? [r.equals(0)]
        : undefined;
    }
    case 'angle_sum':
    case 'angle_diff':
      return linearForm(c, vars, k, degrees(litAt(args, 6)), kind === 'angle_sum' ? 1 : -1);
    case 'dangle_lines':
    case 'parallel':
    case 'perpendicular':
      return lineRows(c, vars, kind, k, args);
    case 'collinear':
      return collinearRows(c, vars, k);
    case 'concyclic':
      return concyclicRows(c, vars, k);
    default:
      return undefined;
  }
}

/** ∡(l, m) = θ, l ∥ m, l ⟂ m over two line terms. */
function lineRows(
  c: ClosureState,
  vars: AngleVars,
  kind: string,
  k: readonly (string | undefined)[],
  args: readonly TermArg[],
): Vector[] | undefined {
  const [l, m] = k;
  const [dl, dm] = [
    l === undefined ? undefined : lineDir(c, l),
    m === undefined ? undefined : lineDir(c, m),
  ];
  if (dl === undefined || dm === undefined) return undefined;
  if (kind !== 'dangle_lines')
    return [
      new Row(vars)
        .add(dl, 1)
        .add(dm, -1)
        .equals(kind === 'parallel' ? 0 : 90),
    ];
  const theta = degrees(litAt(args, 2));
  return theta === undefined ? undefined : [new Row(vars).add(dm, 1).add(dl, -1).equals(theta)];
}

/**
 * angle(A, B, C) ± angle(D, E, F) = θ in this configuration: an undirected angle is its directed
 * angle times the orientation of its points (mod 180°), and the congruence mod 180° with the
 * figure's own value (which the screen confirmed) fixes the sum where the angles stay proper.
 */
function linearForm(
  c: ClosureState,
  vars: AngleVars,
  k: readonly string[],
  theta: number | undefined,
  sigma: 1 | -1,
): Vector[] | undefined {
  const [a, b, cc, d, e, f] = k;
  if (a === undefined || b === undefined || cc === undefined || theta === undefined)
    return undefined;
  if (d === undefined || e === undefined || f === undefined) return undefined;
  const [s1, s2] = [orientation(c, a, b, cc), orientation(c, d, e, f)];
  if (s1 === undefined || s2 === undefined) return undefined;
  const r = new Row(vars);
  return angleRow(c, r, a, b, cc, s1) && angleRow(c, r, d, e, f, sigma * s2)
    ? [r.equals(theta)]
    : undefined;
}

function collinearRows(
  c: ClosureState,
  vars: AngleVars,
  pts: readonly string[],
): Vector[] | undefined {
  const [p, q, ...rest] = pts;
  if (p === undefined || q === undefined || rest.length === 0) return undefined;
  const pq = pointDir(c, p, q);
  if (pq === undefined) return undefined;
  const out: Vector[] = [];
  for (const x of rest) {
    const px = pointDir(c, p, x);
    if (px === undefined) return undefined;
    out.push(new Row(vars).add(px, 1).add(pq, -1).equals(0));
  }
  return out;
}

/** ∡P₁P₃P₂ = ∡P₁XP₂ for every further X: on the circle through P₁, P₂, P₃. */
function concyclicRows(
  c: ClosureState,
  vars: AngleVars,
  pts: readonly string[],
): Vector[] | undefined {
  const [p, q, s, ...rest] = pts;
  if (p === undefined || q === undefined || s === undefined || rest.length === 0) return undefined;
  if (!circleBase(c, pts)) return undefined;
  const out: Vector[] = [];
  for (const x of rest) {
    const r = new Row(vars);
    if (!angleRow(c, r, p, s, q, 1) || !angleRow(c, r, p, x, q, -1)) return undefined;
    out.push(r.equals(0));
  }
  return out;
}

/** The congruences of the closure's perpendicular classes and circles (with centres, tangents). */
export function* closureRows(c: ClosureState, vars: AngleVars): Generator<Vector, void, unknown> {
  for (const [p, qs] of c.perps)
    for (const q of qs)
      if (p < q) yield new Row(vars).add(`P:${p}`, 1).add(`P:${q}`, -1).equals(90);
  for (const [circle, set] of c.circleSets) {
    const out: Vector[] = [];
    const pts = [...set].slice(0, MAX_CIRCLE_POINTS);
    const t = (p: string) => `t:${circle}:${p}`;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const [p, q] = [pts[i] ?? '', pts[j] ?? ''];
        const d = pointDir(c, p, q);
        if (d !== undefined)
          out.push(new Row(vars).add(d, 1).add(t(p), -1).add(t(q), -1).equals(90));
      }
    const o = c.centerOf.get(circle);
    if (o !== undefined)
      for (const p of pts) {
        const d = pointDir(c, o, p);
        if (d !== undefined) out.push(new Row(vars).add(d, 1).add(t(p), -2).equals(0));
      }
    out.push(...tangentRows(c, vars, circle, pts, t));
    yield* out;
  }
  for (const r of constructionRows(c)) {
    const row = new Row(vars);
    for (const [name, k] of r.terms) row.add(name, k);
    yield row.equals(r.value);
  }
}

/** The tangent at P to a circle class: direction 2·t_P + 90°. */
function tangentRows(
  c: ClosureState,
  vars: AngleVars,
  circle: string,
  pts: readonly string[],
  t: (p: string) => string,
): Vector[] {
  const out: Vector[] = [];
  for (const pair of c.tangents) {
    const [x, y] = pair.split('&');
    const line =
      x?.startsWith('L') === true
        ? x.slice(1)
        : y?.startsWith('L') === true
          ? y.slice(1)
          : undefined;
    const circ =
      x?.startsWith('C') === true
        ? x.slice(1)
        : y?.startsWith('C') === true
          ? y.slice(1)
          : undefined;
    if (line === undefined || circ !== circle) continue;
    const on = c.lineSets.get(line);
    const touch = pts.find((p) => on?.has(p) === true);
    if (touch !== undefined)
      out.push(
        new Row(vars)
          .add(`P:${c.parallelClass(line)}`, 1)
          .add(t(touch), -2)
          .equals(90),
      );
  }
  return out;
}
