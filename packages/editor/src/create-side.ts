/**
 * A side of a polygon as a line pick (ADR-0024): where a tool wants a line and the click is
 * on a side of a polygon `polygon(A, B, C, …)` of named points, the side is created as
 * `segment(A, B)` (its own edit, as a point a click creates), drawn exactly over the edge;
 * later clicks there pick that segment. Geomdraw's triangles were three segments, so its
 * users drop perpendiculars on a triangle's side with one click.
 */
import { findObject } from '@geomira/kernel/document';
import { NO_REMOVAL } from '@geomira/kernel/derived-edit';
import { call, type Expr } from '@geomira/kernel/expr';
import type { Vec } from '@geomira/kernel/value';
import type { HitResult, VirtualHit } from '@geomira/scene/hit';
import { applyEdit } from './edit';
import { descriptiveName } from './descriptive-names';
import { freshName } from './names';
import type { EditResult } from './result';
import type { EditorEnv, EditorState } from './state';

type V = Vec<number>;

function segmentDistance(a: V, b: V, q: V): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(a.x + t * dx - q.x, a.y + t * dy - q.y);
}

/** segment(A, B) for the side of the topmost polygon edge under the click, or undefined. */
export function polygonSide(state: EditorState, hit: HitResult, at: V): Expr | undefined {
  const edge = hit.hits.find((h) => h.kind === 'polygon' && h.part === 'curve');
  return edge === undefined ? undefined : sideOf(state, edge.id, at);
}

/** segment(A, B) for the side of polygon `id` nearest to `at`, or undefined. */
function sideOf(state: EditorState, id: number, at: V): Expr | undefined {
  const def = findObject(state.doc, id)?.def;
  if (def?.kind !== 'call' || def.tool !== 'polygon') return undefined;
  const corners = def.args.map((a) => {
    const v = a.kind === 'ref' ? state.values.values.get(a.id) : undefined;
    return v?.kind === 'point' ? { ref: a, at: { x: v.x, y: v.y } } : undefined;
  });
  const known = corners.flatMap((c) => (c === undefined ? [] : [c]));
  if (known.length !== corners.length || known.length < 2) return undefined;
  let best: { d: number; i: number } | undefined;
  for (const [i, c] of known.entries()) {
    const n = known[(i + 1) % known.length] ?? c;
    const d = segmentDistance(c.at, n.at, at);
    if (best === undefined || d < best.d) best = { d, i };
  }
  const a = best === undefined ? undefined : known[best.i];
  const b = best === undefined ? undefined : known[(best.i + 1) % known.length];
  return a === undefined || b === undefined ? undefined : call('segment', [a.ref, b.ref]);
}

/** The ids of segment(A, B)'s two points (references only), or undefined. */
function ends(def: Expr): [number, number] | undefined {
  if (def.kind !== 'call' || def.tool !== 'segment' || def.selectors.length > 0) return undefined;
  const [a, b] = def.args;
  return a?.kind === 'ref' && b?.kind === 'ref' && def.args.length === 2 ? [a.id, b.id] : undefined;
}

/** An object defined as segment(A, B) or segment(B, A) for the side `side`, hidden or not. */
function existingSide(state: EditorState, side: Expr): number | undefined {
  const s = ends(side);
  if (s === undefined) return undefined;
  const same = (def: Expr) => {
    const e = ends(def);
    return (
      e !== undefined && ((e[0] === s[0] && e[1] === s[1]) || (e[0] === s[1] && e[1] === s[0]))
    );
  };
  return state.doc.objects.find((o) => same(o.def))?.id;
}

/**
 * The object of a side (segment(A, B) from polygonSide): an existing segment of it, reused
 * even when hidden (a click cannot hit it), else a new one as its own edit.
 */
export function sideObject(state: EditorState, side: Expr, env: EditorEnv): EditResult {
  const id = existingSide(state, side);
  if (id !== undefined) return { ok: true, state, removed: NO_REMOVAL, added: [], id };
  const object = { name: sideName(state, side), def: side, layers: [state.activeLayer] };
  return applyEdit(state, { kind: 'add', object }, env);
}

/** The side AB is s_AB, as the Segment tool names it (ADR-0050), else l, l_1, …. */
function sideName(state: EditorState, side: Expr): string {
  const names = (ends(side) ?? []).map((id) => findObject(state.doc, id)?.name);
  const wanted = descriptiveName(state.doc, { prefix: 's', picks: 'all' }, names);
  return wanted ?? freshName(state.doc, 'line');
}

/**
 * A virtual hit on polygon sides made into one on segments: each polygon it names (a point
 * on a side, a side meeting a curve) gets its side as a segment (sideObject: an existing one,
 * or one edit each), so the point the click creates is a glider on that side or the
 * intersection with it.
 */
export function onSides(
  state: EditorState,
  v: VirtualHit,
  env: EditorEnv,
): { state: EditorState; virtual: VirtualHit } | string {
  const isPolygon = (id: number) => state.values.values.get(id)?.kind === 'polygon';
  if (v.kind === 'none' || v.kind === 'free') return { state, virtual: v };
  const ids = v.kind === 'on' ? [v.curve] : [v.a, v.b];
  let s = state;
  const swap = new Map<number, number>();
  for (const id of ids.filter(isPolygon)) {
    const side = sideOf(s, id, v.world);
    if (side === undefined) return 'there is no curve there';
    const r = sideObject(s, side, env);
    if (!r.ok || r.id === undefined) return r.ok ? 'the side could not be made' : r.reason;
    swap.set(id, r.id);
    s = r.state;
  }
  const to = (id: number) => swap.get(id) ?? id;
  const virtual: VirtualHit =
    v.kind === 'on' ? { ...v, curve: to(v.curve) } : { ...v, a: to(v.a), b: to(v.b) };
  return { state: s, virtual };
}
