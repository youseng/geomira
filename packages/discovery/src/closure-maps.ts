/**
 * What the closure learns from the document's maps (ADR-0039), from their declared facts
 * (`Signature.map`) and the images in the document: a point in a map's fixed set is its own
 * image; a fixed or invariant curve is its own image; a declared image is the image (spiral
 * sends A to C); an involution's image of an image is the source; an inversion's centre is
 * collinear with every point and its image; a similarity with an exact ratio multiplies every
 * distance between points with images by it. Facts that hold by the map alone are construction
 * facts, as those of a definition (ADR-0035 decision 7).
 */
import { abs, formatRational, fromInteger, sub } from '@geomira/num/rational';
import { addRatio } from './closure-mid';
import type { ClosureState } from './closure-view';
import type { ImageRecord, Instance, MapRecord } from './terms';

/** Points (with an image) per map whose distances a similarity relates (pairs grow quadratically). */
export const MAX_MAP_POINTS = 40;

/** The images of a map, both ways for an involution (the image of X* is X). */
export function imagesOf(c: ClosureState, m: MapRecord): ImageRecord[] {
  const own = c.terms.images.filter((x) => x.map === m.key);
  return m.involution ? [...own, ...own.map((x) => ({ map: x.map, pre: x.img, img: x.pre }))] : own;
}

/** The instances a map gives before any merging: X, X* and an inversion's centre collinear. */
export function mapInstances(c: ClosureState): Instance[] {
  const out: Instance[] = [];
  for (const m of c.terms.maps.values()) {
    // An inversion's centre, or a homothety's fixed point: on the line through X and X*.
    const o =
      m.type === 'inversion' ? m.center : m.factor === undefined ? undefined : m.fixedPoints[0];
    if (o === undefined) continue;
    for (const x of c.terms.images) {
      if (x.map !== m.key) continue;
      if (!c.isLine(x.pre) && !c.isCircle(x.pre))
        out.push({ claim: 'collinear', args: [o, x.pre, x.img] });
      // An inversion takes a line to a circle through its centre (or to itself, through it).
      else if (m.type === 'inversion' && c.isLine(x.pre))
        out.push({ claim: 'on', args: [o, x.img] });
    }
  }
  return out;
}

function onCurve(c: ClosureState, p: string, curve: string): boolean {
  const sets = c.isLine(curve)
    ? c.lineSets.get(c.lines.find(curve))
    : c.isCircle(curve)
      ? c.circleSets.get(c.circles.find(curve))
      : undefined;
  return sets?.has(c.points.find(p)) === true;
}

/** The union-find of a term's kind (points, lines or circles). */
function sameKindUnion(c: ClosureState, a: string, b: string): boolean {
  if (c.isLine(a) !== c.isLine(b) || c.isCircle(a) !== c.isCircle(b)) return false;
  if (c.isLine(a)) return c.lines.union(a, b);
  if (c.isCircle(a)) return c.circles.union(a, b);
  return c.points.union(a, b);
}

function same(c: ClosureState, a: string, b: string): boolean {
  if (c.isLine(a) && c.isLine(b)) return c.lines.same(a, b);
  if (c.isCircle(a) && c.isCircle(b)) return c.circles.same(a, b);
  return !c.isLine(a) && !c.isCircle(a) && !c.isLine(b) && !c.isCircle(b) && c.points.same(a, b);
}

/** Whether the map takes `pre` to itself (a fixed point, a point of the fixed curve, an invariant curve). */
export function fixedBy(c: ClosureState, m: MapRecord, pre: string): boolean {
  if (c.isLine(pre) || c.isCircle(pre))
    return [...(m.fixedCurve === undefined ? [] : [m.fixedCurve]), ...m.invariant].some((k) =>
      same(c, k, pre),
    );
  return (
    m.fixedPoints.some((p) => c.points.same(p, pre)) ||
    (m.fixedCurve !== undefined && onCurve(c, pre, m.fixedCurve))
  );
}

/** One pass of the maps' unions; returns whether any class merged. */
export function mapUnions(c: ClosureState): boolean {
  let changed = false;
  for (const m of c.terms.maps.values())
    for (const x of imagesOf(c, m)) {
      if (fixedBy(c, m, x.pre) && sameKindUnion(c, x.img, x.pre)) changed = true;
      for (const [a, b] of m.sends)
        if (same(c, a, x.pre) && sameKindUnion(c, x.img, b)) changed = true;
    }
  return changed;
}

/**
 * A point a reflection in a line or a circle inversion fixes is on its mirror (the fixed set
 * is exactly that curve): added to the curve's raw incidences (raw: the raw lines and circles).
 * Returns whether any was added.
 */
export function fixedIncidences(
  c: ClosureState,
  raw: { lines: Map<string, Set<string>>; circles: Map<string, Set<string>> },
): boolean {
  let changed = false;
  for (const m of c.terms.maps.values()) {
    const curve = m.fixedCurve;
    if (curve === undefined || (m.type !== 'inversion' && m.type !== 'anti-similarity')) continue;
    const sets = c.isLine(curve) ? raw.lines : c.isCircle(curve) ? raw.circles : undefined;
    if (sets === undefined) continue;
    for (const x of imagesOf(c, m)) {
      if (c.isLine(x.pre) || c.isCircle(x.pre) || !c.points.same(x.pre, x.img)) continue;
      const set = sets.get(curve) ?? new Set<string>();
      if (![...set].some((p) => c.points.same(p, x.pre))) {
        set.add(x.pre);
        sets.set(curve, set);
        changed = true;
      }
    }
  }
  return changed;
}

/** The pairs (X, X*) of points a similarity relates, with its fixed points as (P, P). */
export function pointPairs(c: ClosureState, m: MapRecord): (readonly [string, string])[] {
  const pairs = imagesOf(c, m)
    .filter((x) => !c.isLine(x.pre) && !c.isCircle(x.pre))
    .map((x) => [x.pre, x.img] as const);
  return [...pairs, ...m.fixedPoints.map((p) => [p, p] as const)].slice(0, MAX_MAP_POINTS);
}

/** A homothety with signed ratio k about P: XX* = |k − 1|·PX. */
function homothetyLengths(c: ClosureState, m: MapRecord): void {
  const p = m.fixedPoints[0];
  if (m.factor === undefined || p === undefined) return;
  const d = abs(sub(m.factor, fromInteger(1)));
  if (d.num === 0n) return;
  for (const [x, xi] of pointPairs(c, m)) {
    if (c.points.same(x, p)) continue;
    const [s, t] = [c.segment(x, xi), c.segment(p, x)];
    if (d.num === d.den) c.lengths.union(s, t);
    else addRatio(c, s, t, `q${formatRational(d)}`);
  }
}

/** Distances under a similarity with an exact ratio r: |X*Y*| = r·|XY|. */
export function mapLengths(c: ClosureState): void {
  for (const m of c.terms.maps.values()) {
    homothetyLengths(c, m);
    const r = m.ratio;
    if (r === undefined || (m.type !== 'similarity' && m.type !== 'anti-similarity')) continue;
    const pairs = pointPairs(c, m);
    for (let i = 0; i < pairs.length; i++)
      for (let j = i + 1; j < pairs.length; j++) {
        const [[x, xi], [y, yi]] = [pairs[i] ?? ['', ''], pairs[j] ?? ['', '']];
        if (c.points.same(x, y) || c.points.same(xi, yi)) continue;
        const [s, t] = [c.segment(x, y), c.segment(xi, yi)];
        if (r.num === r.den) c.lengths.union(s, t);
        else addRatio(c, t, s, `q${formatRational(r)}`);
      }
  }
}

/**
 * concyclic(X, X*, Y, Y*) under an inversion (the power of the centre on both lines is the
 * inversion's): whether four points are two points and their images, all distinct.
 */
export function inversionPairs(c: ClosureState, pts: readonly string[]): boolean {
  if (pts.length !== 4) return false;
  const want = new Set(pts.map((p) => c.points.find(p)));
  if (want.size !== 4) return false;
  for (const m of c.terms.maps.values()) {
    if (m.type !== 'inversion') continue;
    const pairs = imagesOf(c, m).filter(
      (x) => want.has(c.points.find(x.pre)) && want.has(c.points.find(x.img)),
    );
    for (const p of pairs)
      for (const q of pairs) {
        const got = new Set([p.pre, p.img, q.pre, q.img].map((k) => c.points.find(k)));
        if (got.size === 4) return true;
      }
  }
  return false;
}
