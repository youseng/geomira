/**
 * The closure's midpoint rules (ADR-0039): a midpoint M of XY (recorded by equalDistances when
 * M is at one distance from distinct X, Y on one line through M) gives, with a midpoint N of XZ,
 * the midline MN ∥ YZ and YZ = 2·MN (the homothety at X with ratio 1/2). Thales: the points P
 * whose lines to X and to Y are perpendicular are on one circle with diameter XY, centred at
 * the midpoint of XY when one is known (so MP = MX by the radii).
 * And two segments with one ratio k to one segment are equal, as are two segments one segment
 * has one ratio k to. Every rule is a theorem about the facts it reads, so it stays sound.
 */
import type { ClosureState } from './closure-view';
import type { Ticking } from './ticking';

/** Midpoints the closure records (beyond them it records none: fewer facts follow). */
export const MAX_MIDPOINTS = 200;

/** Length ratios the closure records (beyond them it records none: fewer facts follow). */
const MAX_RATIOS = 5000;

/** Records |s| = k·|t| as `s&t&k` (k as `q…`) while the closure is under MAX_RATIOS. */
export function addRatio(c: ClosureState, s: string, t: string, k: string): void {
  if (c.ratios.size < MAX_RATIOS) c.ratios.add(`${s}&${t}&${k}`);
}

/** Midlines the rules use (beyond them they use none: fewer facts follow). */
const MAX_MIDLINES = 500;

/** A midpoint M of the segment XY, by point classes. */
export interface Midpoint {
  readonly m: string;
  readonly x: string;
  readonly y: string;
}

/** The recorded midpoints with their current point classes, without repeats. */
export function midpointsOf(c: ClosureState): Midpoint[] {
  const seen = new Set<string>();
  const out: Midpoint[] = [];
  for (const key of c.mids) {
    const [m, x, y] = key.split('|').map((k) => c.points.find(k));
    if (m === undefined || x === undefined || y === undefined) continue;
    const id = `${m}|${[x, y].sort().join('|')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ m, x, y });
    if (out.length >= MAX_MIDPOINTS) break;
  }
  return out;
}

/** Midlines: (M, N, Y, Z) with M the midpoint of XY and N of XZ, Y and Z apart. */
export function midlines(c: ClosureState): (readonly [string, string, string, string])[] {
  const mids = midpointsOf(c);
  const ends = (d: Midpoint) =>
    [
      [d.x, d.y],
      [d.y, d.x],
    ] as const;
  const out: (readonly [string, string, string, string])[] = [];
  for (let i = 0; i < mids.length; i++)
    for (let j = i + 1; j < mids.length; j++) {
      const [a, b] = [mids[i], mids[j]];
      if (a === undefined || b === undefined || a.m === b.m) continue;
      for (const [x, y] of ends(a))
        for (const [x2, z] of ends(b))
          if (x === x2 && y !== z && c.apart(y, z)) {
            out.push([a.m, b.m, y, z]);
            if (out.length >= MAX_MIDLINES) return out;
          }
    }
  return out;
}

/** Circles on a diameter recorded per closure pass (beyond them the rule ignores the rest). */
const MAX_DIAMETERS = 400;

/** The line classes of each parallel class. */
function byDirection(c: ClosureState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of c.lineSets.keys()) {
    const p = c.parallelClass(l);
    out.set(p, [...(out.get(p) ?? []), l]);
  }
  return out;
}

/** For each segment XY: the points P with PX ⟂ PY (on two perpendicular known lines). */
function rightAngles(c: ClosureState): Map<string, { x: string; y: string; ps: Set<string> }> {
  const dirs = byDirection(c);
  const out = new Map<string, { x: string; y: string; ps: Set<string> }>();
  for (const [p, qs] of c.perps)
    for (const q of qs) {
      if (p >= q) continue;
      for (const lx of dirs.get(p) ?? [])
        for (const ly of dirs.get(q) ?? []) {
          const [sx, sy] = [c.lineSets.get(lx) ?? new Set<string>(), c.lineSets.get(ly)];
          for (const v of sx) {
            if (sy?.has(v) !== true) continue;
            for (const x of sx)
              for (const y of sy) {
                if (x === v || y === v || !c.apart(x, v) || !c.apart(y, v)) continue;
                const key = c.segment(x, y);
                const e = out.get(key) ?? { x, y, ps: new Set<string>() };
                e.ps.add(v);
                if (out.size < MAX_DIAMETERS || out.has(key)) out.set(key, e);
              }
          }
        }
    }
  return out;
}

/**
 * Thales: the points P with PX ⟂ PY are on the circle with diameter XY (a raw circle `~dia:…`
 * with X, Y and two such points at least), centred at the midpoint of XY when one is known.
 */
function diameters(c: ClosureState, raw: Map<string, Set<string>>): boolean {
  const mid = new Map(midpointsOf(c).map((d) => [c.segment(d.x, d.y), d.m]));
  let changed = false;
  for (const [seg, { x, y, ps }] of rightAngles(c)) {
    const m = mid.get(seg);
    if (ps.size < 2 && m === undefined) continue;
    const key = `~dia:${seg}`;
    const set = raw.get(key) ?? new Set<string>();
    const have = new Set([...set].map((q) => c.points.find(q)));
    for (const p of [x, y, ...ps])
      if (!have.has(c.points.find(p))) {
        set.add(p);
        changed = true;
      }
    raw.set(key, set);
    if (m !== undefined) c.virtualCenters.set(key, m);
  }
  return changed;
}

/** Segments with one ratio to one segment are equal (both ways). */
function ratioUnions(c: ClosureState): boolean {
  let changed = false;
  const byBig = new Map<string, string>();
  const bySmall = new Map<string, string>();
  for (const r of [...c.ratios]) {
    const [big, small, k] = r.split('&');
    if (big === undefined || small === undefined || k === undefined) continue;
    const kb = `${c.lengths.find(big)}&${k}`;
    const ks = `${c.lengths.find(small)}&${k}`;
    const s = byBig.get(kb);
    if (s === undefined) byBig.set(kb, small);
    else if (c.lengths.union(s, small)) changed = true;
    const b = bySmall.get(ks);
    if (b === undefined) bySmall.set(ks, big);
    else if (c.lengths.union(b, big)) changed = true;
  }
  return changed;
}

/** One pass of the midpoint rules (raw: the raw circles); returns whether anything was added. */
export function* midpointRules(c: ClosureState, raw: Map<string, Set<string>>): Ticking<boolean> {
  const before = c.ratios.size;
  for (const [m, n, y, z] of midlines(c)) addRatio(c, c.segment(y, z), c.segment(m, n), 'q2');
  yield undefined;
  const t = diameters(c, raw);
  yield undefined;
  const r = ratioUnions(c);
  return t || r || c.ratios.size !== before;
}
