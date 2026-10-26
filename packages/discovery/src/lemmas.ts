/**
 * Lemma tags (ADR-0035 decision 14): well-known named results a reported fact is an instance
 * of, each with a one-line hint, matched on the construction (the closure's classes and the
 * definitions' tools), never on names. Only classical results with no attribution: Euler line,
 * nine-point circle, Simson line, radical centre, Miquel point. A tag never decides whether a
 * fact is reported; it adds the hint and ranks the fact (decision 12c). LEMMA_TOOLS lists every
 * registry tool a tag reads (a test checks they exist).
 */
import type { CallExpr, Expr } from '@geomira/kernel/expr';
import type { Closure, FactData } from './closure';
import { objectKey } from './terms';
import type { LemmaTag } from './types';

export const LEMMA_TOOLS: readonly string[] = Object.freeze([
  'circumcenter',
  'centroid',
  'orthocenter',
  'ninepoint_center',
  'midpoint',
  'foot',
  'line',
  'ninepoint_circle',
  'radical_axis',
]);

const CENTERS = ['circumcenter', 'centroid', 'orthocenter', 'ninepoint_center'];

export const EULER: LemmaTag = {
  name: 'Euler line',
  hint: 'The circumcenter, centroid, orthocenter and nine-point center of a triangle are collinear.',
};
export const NINE_POINT: LemmaTag = {
  name: 'Nine-point circle',
  hint: 'The midpoints of the sides, the feet of the altitudes and the midpoints of AH, BH, CH lie on one circle.',
};
export const SIMSON: LemmaTag = {
  name: 'Simson line',
  hint: 'The feet of the perpendiculars from a point of the circumcircle to the three side lines are collinear.',
};
export const RADICAL: LemmaTag = {
  name: 'Radical center',
  hint: 'The radical axes (common chords) of three circles with non-collinear centers pass through one point.',
};
export const MIQUEL: LemmaTag = {
  name: 'Miquel point',
  hint: 'For points D, E, F on the side lines BC, CA, AB, the circles AEF, BFD and CDE share a point.',
};

/** A view of the closure for matching: classes of keys and the definitions in each class. */
class View {
  private readonly members = new Map<string, CallExpr[]>();
  constructor(readonly c: Closure) {
    for (const [key, t] of c.terms.terms)
      if (t.expr.kind === 'call') {
        const p = c.points.find(key);
        this.members.set(p, [...(this.members.get(p) ?? []), t.expr]);
        const l = `L${c.lines.find(key)}`;
        this.members.set(l, [...(this.members.get(l) ?? []), t.expr]);
        const k = `C${c.circles.find(key)}`;
        this.members.set(k, [...(this.members.get(k) ?? []), t.expr]);
      }
  }

  /** The point class of an expression (a registered term), or undefined. */
  point(e: Expr | undefined): string | undefined {
    if (e === undefined) return undefined;
    const k = e.kind === 'ref' ? objectKey(e.id) : this.c.terms.exprKeys.get(e);
    return k === undefined ? undefined : this.c.points.find(k);
  }

  calls(cls: string, tool: string): CallExpr[] {
    return (this.members.get(cls) ?? []).filter((x) => x.tool === tool);
  }

  /** "a|b|c": a triangle as its sorted vertex classes. */
  tri(args: readonly Expr[]): string | undefined {
    const ps = args.map((a) => this.point(a));
    if (ps.length !== 3 || ps.some((p) => p === undefined) || new Set(ps).size !== 3)
      return undefined;
    return ps.sort().join('|');
  }
}

function pointClass(c: Closure, id: number): string {
  return c.points.find(objectKey(id));
}

/** The triangle centres a point class is (type and triangle). */
function centers(v: View, p: string): { type: string; tri: string }[] {
  return CENTERS.flatMap((type) =>
    v.calls(p, type).flatMap((x) => {
      const tri = v.tri(x.args);
      return tri === undefined ? [] : [{ type, tri }];
    }),
  );
}

function euler(v: View, pts: readonly string[]): boolean {
  if (pts.length !== 3) return false;
  const cs = pts.map((p) => centers(v, p));
  for (const a of cs[0] ?? [])
    for (const b of cs[1] ?? [])
      for (const c of cs[2] ?? [])
        if (a.tri === b.tri && b.tri === c.tri && new Set([a.type, b.type, c.type]).size === 3)
          return true;
  return false;
}

/** The triangles for which point class p is one of the nine points; side midpoints flagged. */
function ninePoints(v: View, p: string): { tri: string; side: boolean }[] {
  const out: { tri: string; side: boolean }[] = [];
  for (const m of v.calls(p, 'midpoint')) {
    const [x, y] = m.args.map((a) => v.point(a));
    if (x === undefined || y === undefined) continue;
    for (const h of v.calls(y, 'orthocenter')) {
      const tri = v.tri(h.args);
      if (tri?.split('|').includes(x) === true) out.push({ tri, side: false });
    }
    for (const h of v.calls(x, 'orthocenter')) {
      const tri = v.tri(h.args);
      if (tri?.split('|').includes(y) === true) out.push({ tri, side: false });
    }
    out.push({ tri: `side:${[x, y].sort().join('|')}`, side: true });
  }
  for (const f of v.calls(p, 'foot')) {
    const [q, ...rest] = f.args;
    const side =
      rest.length === 2
        ? rest
        : rest[0]?.kind === 'call' && rest[0].tool === 'line'
          ? rest[0].args
          : [];
    const tri = q === undefined ? undefined : v.tri([q, ...side]);
    if (tri !== undefined) out.push({ tri, side: false });
  }
  return out;
}

function onNinePointCircle(v: View, pts: readonly string[], circle?: string): boolean {
  const tris = new Set<string>();
  if (circle !== undefined)
    for (const x of v.calls(circle, 'ninepoint_circle')) {
      const t = v.tri(x.args);
      if (t !== undefined) tris.add(t);
    }
  const lists = pts.map((p) => ninePoints(v, p));
  for (const l of lists) for (const x of l) if (!x.side) tris.add(x.tri);
  for (const tri of tris) {
    const sides = new Set(
      tri
        .split('|')
        .flatMap((a, i, all) => all.slice(i + 1).map((b) => `side:${[a, b].sort().join('|')}`)),
    );
    const fits = (x: { tri: string; side: boolean }) =>
      x.tri === tri || (x.side && sides.has(x.tri));
    if (
      lists.every((l) => l.some(fits)) &&
      lists.some((l) => l.some((x) => !x.side && x.tri === tri))
    )
      return true;
  }
  return false;
}

function simson(v: View, pts: readonly string[]): boolean {
  if (pts.length !== 3) return false;
  const feet = pts.map((p) =>
    v.calls(p, 'foot').flatMap((f) => {
      const [q, ...rest] = f.args;
      const side =
        rest.length === 2
          ? rest
          : rest[0]?.kind === 'call' && rest[0].tool === 'line'
            ? rest[0].args
            : [];
      const [from, a, b] = [v.point(q), v.point(side[0]), v.point(side[1])];
      return from === undefined || a === undefined || b === undefined
        ? []
        : [{ from, side: [a, b].sort() }];
    }),
  );
  for (const x of feet[0] ?? [])
    for (const y of feet[1] ?? [])
      for (const z of feet[2] ?? []) {
        if (x.from !== y.from || y.from !== z.from) continue;
        const vs = new Set([...x.side, ...y.side, ...z.side]);
        const sides = new Set([x.side, y.side, z.side].map((s) => s.join('|')));
        if (vs.size === 3 && sides.size === 3) return true;
      }
  return false;
}

/** The circle pairs a line class is the radical axis (or a common chord) of. */
function axisPairs(v: View, line: string): string[][] {
  const c = v.c;
  const out = v.calls(`L${line}`, 'radical_axis').flatMap((x) => {
    const ks = x.args.map((a) => (a.kind === 'ref' ? c.circles.find(objectKey(a.id)) : undefined));
    return ks.every((k): k is string => k !== undefined) ? [ks.sort()] : [];
  });
  const set = c.lineSets.get(line);
  if (set !== undefined) {
    const circles = [...c.circleSets.entries()];
    for (let i = 0; i < circles.length; i++)
      for (let j = i + 1; j < circles.length; j++) {
        const [ci, cj] = [circles[i], circles[j]];
        if (ci === undefined || cj === undefined) continue;
        const common = [...set].filter((p) => ci[1].has(p) && cj[1].has(p));
        if (common.length >= 2) out.push([ci[0], cj[0]].sort());
      }
  }
  return out;
}

function radical(v: View, lines: readonly string[]): boolean {
  if (lines.length !== 3) return false;
  const ps = lines.map((l) => axisPairs(v, l));
  for (const a of ps[0] ?? [])
    for (const b of ps[1] ?? [])
      for (const c of ps[2] ?? []) {
        const all = new Set([...a, ...b, ...c]);
        const pairs = new Set([a, b, c].map((x) => x.join('&')));
        if (all.size === 3 && pairs.size === 3) return true;
      }
  return false;
}

function onLine(c: Closure, ...pts: string[]): boolean {
  for (const s of c.lineSets.values()) if (pts.every((p) => s.has(p))) return true;
  return false;
}

/** Miquel: one of the points is M, on two circles AEF and BFD; the others are C, D, E. */
function miquel(c: Closure, pts: readonly string[]): boolean {
  if (pts.length !== 4) return false;
  const circles = [...c.circleSets.values()];
  for (const m of pts) {
    const rest = pts.filter((p) => p !== m);
    const through = circles.filter((s) => s.has(m) && !rest.every((p) => s.has(p)));
    for (const c1 of through)
      for (const c2 of through) {
        if (c1 === c2) continue;
        for (const f of c1) {
          if (f === m || !c2.has(f)) continue;
          for (const a of c1)
            for (const b of c2) {
              if ([a, b].some((x) => x === m || x === f) || a === b) continue;
              for (const cc of rest) {
                const [d, e] = rest.filter((p) => p !== cc);
                if (d === undefined || e === undefined) continue;
                for (const [dd, ee] of [
                  [d, e],
                  [e, d],
                ] as const)
                  if (
                    new Set([m, f, a, b, cc, dd, ee]).size === 7 &&
                    c1.has(ee) &&
                    c2.has(dd) &&
                    onLine(c, b, cc, dd) &&
                    onLine(c, cc, a, ee) &&
                    onLine(c, a, b, f)
                  )
                    return true;
              }
            }
        }
      }
  }
  return false;
}

/** The tag of a reported fact, or undefined. */
export function lemmaTag(c: Closure, fact: FactData): LemmaTag | undefined {
  const v = new View(c);
  const ids = fact.args.flatMap((a) => ('id' in a ? [a.id] : []));
  const pts = ids.map((id) => pointClass(c, id));
  switch (fact.kind) {
    case 'collinear':
      if (euler(v, pts)) return EULER;
      return simson(v, pts) ? SIMSON : undefined;
    case 'concyclic':
      if (onNinePointCircle(v, pts)) return NINE_POINT;
      return miquel(c, pts) ? MIQUEL : undefined;
    case 'on': {
      const [p, k] = ids;
      if (p === undefined || k === undefined) return undefined;
      const circle = `C${c.circles.find(objectKey(k))}`;
      const on = c.circleSets.get(c.circles.find(objectKey(k)));
      const known = [...(on ?? [])].filter((x) => x !== pointClass(c, p)).slice(0, 3);
      if (onNinePointCircle(v, [pointClass(c, p)], circle)) return NINE_POINT;
      return known.length === 3 && miquel(c, [pointClass(c, p), ...known]) ? MIQUEL : undefined;
    }
    case 'concurrent':
      return radical(
        v,
        ids.map((id) => c.lines.find(objectKey(id))),
      )
        ? RADICAL
        : undefined;
    default:
      return undefined;
  }
}
