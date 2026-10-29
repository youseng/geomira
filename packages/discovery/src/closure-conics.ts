/**
 * Conics in the closure (ADR-0042). The conic sets: the points recorded on a conic object (the
 * instances on(X, k) its guarantees give: the five points of conic(A, B, C, D, E), its gliders,
 * its intersections and touch points) and the six points of a conconic fact taken as given. The
 * rules: on(P, k) for a conic k follows when P's class is in k's set; conconic(A…F) follows when
 * the six point classes are distinct and lie in one conic set or in one circle class (a circle
 * is a conic). A projective map whose image of a conic k is a circle (conic_to_circle(k):
 * `MapFacts.circleImage`) puts the images of k's points on one circle: a raw circle set, merged
 * like any other, so the images' concyclic facts are construction facts. Sound: each rule only
 * follows recorded incidences and declared map data; it may miss a fact, never invent one.
 */
import { formatRational } from '@geomira/num/rational';
import type { Sets } from './closure-merge';
import type { ClosureState, ClosureView } from './closure-view';
import { imagesOf } from './closure-maps';
import type { Instance } from './terms';

/** Conic class (its terms' class in the points' union-find) or `~cnc…` fact → its points' term keys. */
export type ConicSets = ReadonlyMap<string, ReadonlySet<string>>;

/** Whether a term is a conic in every evaluation (its static kinds). */
export function isConic(c: ClosureView, k: string): boolean {
  const t = c.terms.terms.get(k)?.kinds;
  return t !== undefined && t.length > 0 && t.every((x) => x === 'conic');
}

function addTo(sets: Sets, k: string, member: string): void {
  const s = sets.get(k) ?? new Set<string>();
  s.add(member);
  sets.set(k, s);
}

/** The raw conic sets (term keys) from the incidence instances (see the module comment). */
export function conicSetsOf(c: ClosureView, inst: readonly Instance[]): Sets {
  const sets: Sets = new Map();
  inst.forEach((x, i) => {
    const [p, q] = x.args;
    if (x.claim === 'on' && p !== undefined && q !== undefined && isConic(c, q))
      addTo(sets, c.points.find(q), p);
    if (x.claim === 'conconic') for (const a of x.args) addTo(sets, `~cnc${String(i)}`, a);
  });
  return sets;
}

/** Whether point P's class is in conic k's set. */
export function onConicSet(c: ClosureView, sets: ConicSets, p: string, k: string): boolean {
  const cls = c.points.find(p);
  return [...(sets.get(c.points.find(k)) ?? [])].some((x) => c.points.find(x) === cls);
}

/** Whether the points are distinct classes all in one conic set or one circle class. */
export function onOneConic(c: ClosureView, sets: ConicSets, pts: readonly string[]): boolean {
  const classes = new Set(pts.map((p) => c.points.find(p)));
  if (classes.size < pts.length) return false;
  const holds = (s: ReadonlySet<string>) => [...classes].every((p) => s.has(p));
  for (const s of c.circleSets.values()) if (holds(s)) return true;
  for (const s of sets.values())
    if (holds(new Set([...s].map((x) => c.points.find(x))))) return true;
  return false;
}

/**
 * The points of a conic named by its parameter in declared data (the known point on(k, 1, 0) of
 * conic(A, …)'s guarantee and of conic_to_circle(k)'s fixed point): two terms on(k, u, v) that
 * are not objects (an object is a glider the user moves), on one conic class with the same
 * literals, are one point. Returns whether any class merged.
 */
export function conicParameterUnions(c: ClosureState): boolean {
  const first = new Map<string, string>();
  let changed = false;
  for (const t of c.terms.terms.values()) {
    const e = t.expr;
    if (t.key.startsWith('#') || e.kind !== 'call' || e.tool !== 'on' || e.args.length !== 3)
      continue;
    const [k, u, v] = e.args;
    const kk = k === undefined ? undefined : c.terms.exprKeys.get(k);
    if (kk === undefined || !isConic(c, kk) || u?.kind !== 'lit' || v?.kind !== 'lit') continue;
    const id = `${c.points.find(kk)}|${formatRational(u.value)}|${formatRational(v.value)}`;
    const seen = first.get(id);
    if (seen === undefined) first.set(id, t.key);
    else if (c.points.union(seen, t.key)) changed = true;
  }
  return changed;
}

/**
 * The images of the points of a map's invariant line or circle lie on it (it is its own image;
 * circle_to_centre(c, P) keeps c): added to the curve's raw incidences. Returns whether any was.
 */
export function invariantIncidences(
  c: ClosureState,
  raw: { readonly lines: Sets; readonly circles: Sets },
): boolean {
  let changed = false;
  for (const m of c.terms.maps.values())
    for (const k of m.invariant) {
      const [sets, cls] = c.isLine(k)
        ? [raw.lines, c.lineSets.get(c.lines.find(k))]
        : c.isCircle(k)
          ? [raw.circles, c.circleSets.get(c.circles.find(k))]
          : [undefined, undefined];
      if (sets === undefined || cls === undefined) continue;
      for (const x of imagesOf(c, m)) {
        if (c.isLine(x.pre) || c.isCircle(x.pre) || c.at(x.img) === undefined) continue;
        if (!cls.has(c.points.find(x.pre)) || sets.get(k)?.has(x.img) === true) continue;
        addTo(sets, k, x.img);
        changed = true;
      }
    }
  return changed;
}

/**
 * The circles of the maps with a circle image: the images of the points of the conic go to one
 * raw circle set `~cimg|map`. Returns whether any set grew.
 */
export function conicImageCircles(
  c: ClosureState,
  raw: { readonly circles: Sets },
  sets: ConicSets,
): boolean {
  let changed = false;
  for (const m of c.terms.maps.values()) {
    const k = m.circleImage;
    if (m.type !== 'projective' || k === undefined) continue;
    const on = new Set([...(sets.get(c.points.find(k)) ?? [])].map((x) => c.points.find(x)));
    const key = `~cimg|${m.key}`;
    for (const x of imagesOf(c, m)) {
      if (!on.has(c.points.find(x.pre)) || c.at(x.img) === undefined) continue;
      const set = raw.circles.get(key) ?? new Set<string>();
      if (!set.has(x.img)) {
        addTo(raw.circles, key, x.img);
        changed = true;
      }
    }
  }
  return changed;
}
