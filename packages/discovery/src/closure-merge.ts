/**
 * The closure's merging steps (ADR-0035 decision 7, ADR-0039): line and circle sets from the
 * incidence instances, merging classes that share enough points that are APART in the figure,
 * parallel and perpendicular classes, tangent pairs, equal lengths, the radii of circles with a
 * known centre, and (ADR-0039) the circles of equal distances: the points at one distance from a
 * point M lie on a circle centred at M, and M is the midpoint of two of them on one line through
 * it. Every step only follows recorded facts; it may miss a fact, never invent one.
 */
import { addRatio, MAX_MIDPOINTS } from './closure-mid';
import type { ClosureState } from './closure-view';
import type { Instance } from './terms';
import type { UnionFind } from './uf';

export type Sets = Map<string, Set<string>>;

/** Circles of equal distances the closure keeps (beyond them it adds none: fewer facts follow). */
const MAX_VIRTUAL_CIRCLES = 150;

/** Isosceles triangles the closure records (beyond them it records none). */
const MAX_ISOSCELES = 2000;

export function addTo(sets: Sets, k: string, member: string): void {
  const s = sets.get(k) ?? new Set<string>();
  s.add(member);
  sets.set(k, s);
}

/** Line and circle sets from the incidence instances (on, collinear, concyclic). */
export function incidences(
  c: ClosureState,
  inst: readonly Instance[],
): { lines: Sets; circles: Sets } {
  const lines: Sets = new Map();
  const circles: Sets = new Map();
  inst.forEach((x, i) => {
    const [p, q] = x.args;
    if (x.claim === 'on' && p !== undefined && q !== undefined) {
      if (c.isLine(q)) addTo(lines, q, p);
      else if (c.isCircle(q)) addTo(circles, q, p);
    }
    if (x.claim === 'collinear') for (const a of x.args) addTo(lines, `~col${String(i)}`, a);
    if (x.claim === 'concyclic') for (const a of x.args) addTo(circles, `~cyc${String(i)}`, a);
    // Concurrent lines (a shown fact) meet at a point that is not an object.
    if (x.claim === 'concurrent')
      for (const l of x.args) if (c.isLine(l)) addTo(lines, l, `~meet${String(i)}`);
  });
  return { lines, circles };
}

/** Whether `need` of the shared points are pairwise apart in the figure (brute force: sets are small). */
function apartAmong(
  shared: readonly string[],
  need: number,
  apart: (a: string, b: string) => boolean,
): boolean {
  if (need === 2) return shared.some((p, i) => shared.slice(i + 1).some((q) => apart(p, q)));
  return shared.some((p, i) =>
    shared
      .slice(i + 1)
      .some(
        (q, j) => apart(p, q) && shared.slice(i + j + 2).some((r) => apart(p, r) && apart(q, r)),
      ),
  );
}

/**
 * One merging pass: two classes sharing `need` points that are pairwise APART in the current
 * figure are one (two lines through two distinct points, two circles through three). Points
 * that are only known as different terms may coincide (the medians' intersection is G), so
 * the figure decides distinctness; a merge then holds wherever those points stay apart.
 */
export function merge(
  uf: UnionFind,
  raw: Sets,
  points: UnionFind,
  need: number,
  apart: (a: string, b: string) => boolean,
): { sets: Sets; changed: boolean } {
  const sets: Sets = new Map();
  for (const [k, s] of raw) for (const p of s) addTo(sets, uf.find(k), points.find(p));
  // Only classes that share a point can merge: index the classes through each point, and
  // collect the shared points of each such pair (canonical pair order: the smaller key first).
  const through = new Map<string, string[]>();
  for (const [k, s] of sets)
    for (const p of s) {
      const ks = through.get(p);
      if (ks === undefined) through.set(p, [k]);
      else ks.push(k);
    }
  const shared = new Map<string, { a: string; b: string; pts: string[] }>();
  for (const [p, ks] of through)
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const [x, y] = [ks[i] ?? '', ks[j] ?? ''];
        const [a, b] = x < y ? [x, y] : [y, x];
        const key = `${a}\u0000${b}`;
        const e = shared.get(key);
        if (e === undefined) shared.set(key, { a, b, pts: [p] });
        else e.pts.push(p);
      }
  let changed = false;
  for (const { a, b, pts } of shared.values())
    if (pts.length >= need && apartAmong(pts, need, apart) && uf.union(a, b)) changed = true;
  return { sets, changed };
}

/** Lines of one parallel class through one point are one line; returns whether any merged. */
export function parallelsThroughOne(c: ClosureState): boolean {
  const byClass = new Map<string, string[]>();
  for (const l of c.lineSets.keys()) {
    const p = c.parallelClass(l);
    byClass.set(p, [...(byClass.get(p) ?? []), l]);
  }
  let changed = false;
  for (const ls of byClass.values())
    for (let i = 0; i < ls.length; i++)
      for (let j = i + 1; j < ls.length; j++) {
        const [a, b] = [c.lineSets.get(ls[i] ?? ''), c.lineSets.get(ls[j] ?? '')];
        if (a !== undefined && b !== undefined && [...a].some((p) => b.has(p)))
          if (c.lines.union(ls[i] ?? '', ls[j] ?? '')) changed = true;
      }
  return changed;
}

export function relate(c: ClosureState, inst: readonly Instance[]): void {
  for (const x of inst) {
    const [a, b, p, q, k] = x.args;
    if (a === undefined || b === undefined) continue;
    if (x.claim === 'parallel' && c.isLine(a) && c.isLine(b))
      c.parallels.union(c.lines.find(a), c.lines.find(b));
    if (x.claim === 'tangent') c.tangents.add([c.classOf(a), c.classOf(b)].sort().join('&'));
    if (x.claim === 'length' && p !== undefined && q !== undefined) {
      if (k === 'q1') c.lengths.union(c.segment(a, b), c.segment(p, q));
      else if (k !== undefined) addRatio(c, c.segment(a, b), c.segment(p, q), k);
    }
  }
  // Perpendicular pairs, then: lines perpendicular to one line are parallel (to a fixpoint).
  for (let changed = true; changed;) {
    changed = false;
    c.perps.clear();
    for (const x of inst) {
      const [a, b] = x.args;
      if (x.claim !== 'perpendicular' || a === undefined || b === undefined) continue;
      if (!c.isLine(a) || !c.isLine(b)) continue;
      const [pa, pb] = [c.parallelClass(c.lines.find(a)), c.parallelClass(c.lines.find(b))];
      addTo(c.perps, pa, pb);
      addTo(c.perps, pb, pa);
    }
    for (const partners of c.perps.values()) {
      const [first, ...rest] = [...partners];
      for (const r of rest) if (first !== undefined && c.parallels.union(first, r)) changed = true;
    }
  }
}

/** Radii: every point of a circle with a known centre is at one distance from it. */
export function radii(c: ClosureState): void {
  for (const [circle, pts] of c.circleSets) {
    const o = c.centerOf.get(circle);
    if (o === undefined) continue;
    const [first, ...rest] = [...pts];
    if (first === undefined) continue;
    for (const p of rest)
      if (!c.points.same(p, o)) c.lengths.union(c.segment(o, first), c.segment(o, p));
  }
}

/**
 * The circles of equal distances (ADR-0039): for each point M and length class, three or more
 * points at that distance from M are a raw circle centred at M (named `~eq…`), so that the
 * closure and the angle chase see them as concyclic with their centre; two such points are an
 * isosceles triangle with apex M (its base angles); and a point M at one distance from
 * two distinct points X, Y on one line through M is their midpoint (XY = 2·MX). Segment keys
 * made before point classes merged are first joined to their current names. Returns whether
 * anything was added.
 */
export function equalDistances(
  c: ClosureState,
  raw: Sets,
  apart: (a: string, b: string) => boolean,
): boolean {
  let changed = false;
  for (const k of c.lengths.keys()) {
    const [a, b] = k.split('|');
    if (a === undefined || b === undefined || a === '' || b === '') continue;
    const now = c.segment(a, b);
    if (now !== k && c.lengths.union(k, now)) changed = true;
  }
  const stars = new Map<string, { center: string; pts: Set<string> }>();
  for (const k of c.lengths.keys()) {
    const [a, b] = k.split('|').map((x) => c.points.find(x));
    if (a === undefined || b === undefined || a === b || k !== c.segment(a, b)) continue;
    const cls = c.lengths.find(k);
    for (const [m, x] of [
      [a, b],
      [b, a],
    ] as const) {
      const key = `~eq:${m}:${cls}`;
      const star = stars.get(key) ?? { center: m, pts: new Set<string>() };
      star.pts.add(x);
      stars.set(key, star);
    }
  }
  let virtual = [...raw.keys()].filter((k) => k.startsWith('~eq:')).length;
  for (const [key, star] of stars) {
    const pts = [...star.pts];
    if (pts.length < 2) continue;
    midpoints(c, star.center, pts, apart);
    // Two points at one distance from M: the base angles of MXY (angle-rules.ts); three or more:
    // a circle centred at M, while the closure keeps at most MAX_VIRTUAL_CIRCLES of them.
    const [x, y] = pts;
    if (pts.length === 2 && x !== undefined && y !== undefined) {
      if (c.isosceles.size < MAX_ISOSCELES) c.isosceles.add(`${star.center}|${x}|${y}`);
      continue;
    }
    if (!raw.has(key) && virtual >= MAX_VIRTUAL_CIRCLES) continue;
    if (!raw.has(key)) virtual++;
    for (const p of pts)
      if (!(raw.get(key)?.has(p) ?? false)) {
        addTo(raw, key, p);
        changed = true;
      }
    c.virtualCenters.set(key, star.center);
  }
  return changed;
}

/** M at one distance from distinct X, Y on one line through M: XY = 2·MX (and 2·MY). */
function midpoints(
  c: ClosureState,
  m: string,
  pts: readonly string[],
  apart: (a: string, b: string) => boolean,
): void {
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const [x, y] = [pts[i] ?? '', pts[j] ?? ''];
      if (!apart(x, y)) continue;
      const line = c.lineThrough(x, y);
      if (line === undefined || !(c.lineSets.get(line)?.has(c.points.find(m)) ?? false)) continue;
      addRatio(c, c.segment(x, y), c.segment(m, x), 'q2');
      addRatio(c, c.segment(x, y), c.segment(m, y), 'q2');
      if (c.mids.size < MAX_MIDPOINTS) c.mids.add(`${m}|${x}|${y}`);
    }
}
