/**
 * Following the two candidates of an intersection along a LOCAL-regime path (note C of Run
 * 8a, test/choice-robust.test.ts): local copies of a figure (a random similarity and
 * Gaussian noise on the free points, both scaled by t ∈ [0, 1]), continuity tracking of both
 * candidates with velocity prediction and bisection, and their structural labels.
 */
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { call, lit, ref, refsOf, type Selector } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { registry } from './editor';

export const STEPS = 4;
export const SIGMA = 0.02;

export type V = { x: number; y: number };

/** The values of a document's objects (FloatField). */
export function valuesOf(doc: Document): ReadonlyMap<number, Value<number>> | undefined {
  const c = evalContextFor(doc);
  return c.ok ? evaluate(doc, registry, FloatField, c.ctx).values : undefined;
}

/** The intersect value of (a, b) with selector `sel` in a figure. */
export function withSelector(
  doc: Document,
  a: number,
  b: number,
  sel: Selector,
): Value<number> | undefined {
  const x = {
    id: doc.nextId,
    name: 'x_probe',
    def: call('intersect', [ref(a), ref(b)], [sel]),
    style: {},
    layers: ['main'],
  };
  return valuesOf({ ...doc, nextId: doc.nextId + 1, objects: [...doc.objects, x] })?.get(x.id);
}

export function candidatesOf(doc: Document, a: number, b: number): V[] | undefined {
  const vals = valuesOf(doc);
  const c = evalContextFor(doc);
  const args = [vals?.get(a), vals?.get(b)].filter((v): v is Value<number> => v !== undefined);
  if (!c.ok || args.length !== 2) return undefined;
  const list = registry.get('intersect')?.candidates?.(FloatField, args, c.ctx) ?? [];
  return list.flatMap((v) => (v.kind === 'point' ? [{ x: v.x, y: v.y }] : []));
}

/** The free points of a figure (point(lit, lit)) and their coordinates. */
export function freePoints(doc: Document): { id: number; at: V }[] {
  return doc.objects.flatMap((o) => {
    const d = o.def;
    const [x, y] = d.kind === 'call' && d.tool === 'point' ? d.args : [];
    return x?.kind === 'lit' && y?.kind === 'lit'
      ? [{ id: o.id, at: { x: toNumber(x.value), y: toNumber(y.value) } }]
      : [];
  });
}

export interface Copy {
  /** The figure at t ∈ [0, 1] of the path from the original to the copy. */
  readonly at: (t: number) => Document;
  /** A position of the figure at t taken back through the similarity at t. */
  readonly back: (t: number, p: V) => V;
}

/** The objects `ids` are built from, and they themselves, in construction order. */
export function ancestors(doc: Document, ids: readonly number[]): Document {
  const keep = new Set(ids);
  for (const o of [...doc.objects].reverse())
    if (keep.has(o.id)) for (const r of refsOf(o.def)) keep.add(r);
  return {
    ...doc,
    objects: doc.objects.filter((o) => keep.has(o.id)),
    claims: [],
    assumptions: [],
  };
}

/** A local-regime copy: random similarity and noise, both scaled by t along the path. */
export function localCopy(doc: Document, scale: number, rng: Rng): Copy {
  const free = freePoints(doc);
  const c = free.reduce(
    (s, p) => ({ x: s.x + p.at.x / free.length, y: s.y + p.at.y / free.length }),
    { x: 0, y: 0 },
  );
  const [theta, u] = [rng.uniform(-Math.PI, Math.PI), rng.uniform(-1, 1)];
  const b = { x: rng.uniform(-scale / 2, scale / 2), y: rng.uniform(-scale / 2, scale / 2) };
  const noise = free.map(() => ({
    x: SIGMA * scale * rng.gaussian(),
    y: SIGMA * scale * rng.gaussian(),
  }));
  const sim = (t: number) => ({
    cos: Math.cos(t * theta),
    sin: Math.sin(t * theta),
    s: 2 ** (t * u),
  });
  return {
    back(t: number, p: V): V {
      // S_t⁻¹: the copy is S_t applied to the original figure plus (turned) noise, and the
      // candidates are equivariant, so in this frame only the noise moves them.
      const { cos, sin, s } = sim(t);
      const d = { x: p.x - c.x - t * b.x, y: p.y - c.y - t * b.y };
      return { x: c.x + (cos * d.x + sin * d.y) / s, y: c.y + (-sin * d.x + cos * d.y) / s };
    },
    at(t: number): Document {
      const { cos, sin, s } = sim(t);
      const moved = new Map(
        free.map((p, i) => {
          const d = { x: p.at.x - c.x, y: p.at.y - c.y };
          const n = noise[i] ?? { x: 0, y: 0 };
          const x = c.x + s * (cos * d.x - sin * d.y) + t * (b.x + n.x);
          const y = c.y + s * (sin * d.x + cos * d.y) + t * (b.y + n.y);
          return [p.id, call('point', [lit(fromNumber(x)), lit(fromNumber(y))])];
        }),
      );
      return { ...doc, objects: doc.objects.map((o) => ({ ...o, def: moved.get(o.id) ?? o.def })) };
    },
  };
}

/** The first step of a path, which gives the candidates' velocities (see `follow`). */
export const FIRST_STEP = 2 ** -20;

/** Bisections of one path step at most (a step of 1/(STEPS·2^MAX_DEPTH) of the path). */
export const MAX_DEPTH = 14;

/** Both candidates (the clicked one first) and their velocities along the path. */
export interface Track {
  readonly p: V;
  readonly q: V;
  readonly vp: V;
  readonly vq: V;
}

export const dist = (p: V, q: V) => Math.hypot(p.x - q.x, p.y - q.y);
export const ahead = (p: V, v: V, h: number): V => ({ x: p.x + v.x * h, y: p.y + v.y * h });

/**
 * The two candidates followed from `cur` (at t0) to t1, or undefined when they cannot be
 * told apart there. Both are followed with their velocities: the candidates at t1 are
 * assigned to the branches whose predicted positions they are nearest to, and the step is
 * accepted only when both lie within a quarter of the smaller gap between the two (before
 * and after) of their predictions, and when the vector from one to the other turns by less
 * than 90° over the step (assigned and predicted: two candidates can meet BETWEEN the ends of
 * a step whose ends are far apart, and the ends alone would not show it); otherwise the step
 * is bisected. Two candidates meeting make the gap vanish, or the vector reverse within ever
 * smaller steps, which no bisection depth resolves (a tangency).
 */
export function track(
  copy: Copy,
  a: number,
  b: number,
  t0: number,
  t1: number,
  cur: Track,
  depth: number,
): Track | undefined {
  const [cp, cq] = candidatesOf(copy.at(t1), a, b) ?? [];
  if (cp === undefined || cq === undefined) return undefined;
  const [x, y] = [copy.back(t1, cp), copy.back(t1, cq)];
  const h = t1 - t0;
  const [pp, pq] = [ahead(cur.p, cur.vp, h), ahead(cur.q, cur.vq, h)];
  const [np, nq] = dist(x, pp) + dist(y, pq) <= dist(y, pp) + dist(x, pq) ? [x, y] : [y, x];
  const gap = Math.min(dist(cur.p, cur.q), dist(np, nq));
  const turned = (u: V, w: V) =>
    (cur.p.x - cur.q.x) * (u.x - w.x) + (cur.p.y - cur.q.y) * (u.y - w.y) <= 0;
  if (Math.max(dist(np, pp), dist(nq, pq)) * 4 < gap && !turned(np, nq) && !turned(pp, pq)) {
    const v = (to: V, from: V): V => ({ x: (to.x - from.x) / h, y: (to.y - from.y) / h });
    return { p: np, q: nq, vp: v(np, cur.p), vq: v(nq, cur.q) };
  }
  if (depth >= MAX_DEPTH) return undefined;
  const mid = (t0 + t1) / 2;
  const half = track(copy, a, b, t0, mid, cur, depth + 1);
  return half === undefined ? undefined : track(copy, a, b, mid, t1, half, depth + 1);
}

/**
 * The clicked candidate (and the other) followed along the copy's whole path, as positions
 * of the copy (undefined: a tangency met on the way).
 */
export function follow(
  copy: Copy,
  a: number,
  b: number,
  start: readonly [V, V],
): [V, V] | undefined {
  const still = { x: 0, y: 0 };
  // The velocities first, from a step too short for the candidates to pass each other: with
  // zero velocities, two candidates that cross inside one step, each ending near where the
  // other began, would look like two that barely moved.
  let cur: Track | undefined = track(
    copy,
    a,
    b,
    0,
    FIRST_STEP,
    { p: start[0], q: start[1], vp: still, vq: still },
    0,
  );
  for (let i = 1; i <= STEPS && cur !== undefined; i++)
    cur = track(copy, a, b, i === 1 ? FIRST_STEP : (i - 1) / STEPS, i / STEPS, cur, 0);
  if (cur === undefined) return undefined;
  // Back in the copy's own frame: the candidates of the copy nearest to the followed ones.
  const [p, q] = candidatesOf(copy.at(1), a, b) ?? [];
  if (p === undefined || q === undefined) return undefined;
  return dist(copy.back(1, p), cur.p) <= dist(copy.back(1, q), cur.p) ? [p, q] : [q, p];
}

/**
 * The structural label of p against the other candidate q (ADR-0006 item 7): along the
 * line's direction for line ∩ circle, across the line of centres for two circles. Along a
 * followed branch it changes only when the configuration does: at a tangency (which `track`
 * reports) or when a curve passes through a degenerate state (a line's direction reversing
 * as its two points pass through each other, a circle through three points passing through
 * a line, which takes its centre through infinity).
 */
export function label(doc: Document, a: number, b: number, p: V, q: V): number {
  const vals = valuesOf(doc);
  const [va, vb] = [vals?.get(a), vals?.get(b)];
  const line = va?.kind === 'line' ? va : vb?.kind === 'line' ? vb : undefined;
  if (line !== undefined) return Math.sign((p.x - q.x) * line.d.x + (p.y - q.y) * line.d.y);
  if (va?.kind !== 'circle' || vb?.kind !== 'circle') return 0;
  const [u, w] = [
    { x: vb.c.x - va.c.x, y: vb.c.y - va.c.y },
    { x: p.x - va.c.x, y: p.y - va.c.y },
  ];
  return Math.sign(u.x * w.y - u.y * w.x);
}
