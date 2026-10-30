/**
 * What a GUI tool builds once its picks are complete (machine.ts runs the picks). Every
 * object is added through applyEdit (history, invariants, derived layers), in the active
 * layer, named by names.ts. A tool that builds several objects (both tangents from a point,
 * every new intersection of two curves) adds them as ONE batch: one history entry, undone
 * together (ADR-0024).
 */
import type { DocumentEdit } from './edit';
import { sameConstruction } from '@geomira/kernel/construction-key';
import { exprKinds, objectKinds } from '@geomira/kernel/derived';
import type { DocObject, Document } from '@geomira/kernel/document';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { onConicSign } from '@geomira/kernel/conic';
import { requireOnCircle } from '@geomira/kernel/incidence';
import type { Value, Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import { parseRational, toNumber } from '@geomira/num/rational';
import { alreadyMessage } from '@geomira/lang/same-construction';
import { pointsCoincide } from '@geomira/scene/coincide';
import { chooseSelectors } from './choice';
import { applyEdit } from './edit';
import { conventionalName, preferredName } from './conventional-names';
import { descriptiveName, wantedName, type Description } from './descriptive-names';
import { freshName, type NameKind } from './names';
import { done, refuse, type EditResult } from './result';
import { localResponses } from './robust';
import type { EditorEnv, EditorState } from './state';
import { idleTool, type ToolState } from './tool-state';
import type { ToolUI } from './tool-ui';

/** The idle tool after a build: no picks; the claim kind and the typed number stay. */
export function reset(state: EditorState): ToolState {
  const t = state.toolState;
  return idleTool(t.claimKind, t.value, t.typed, t.mapOnly === true);
}

export function withTool(r: EditResult, ts: ToolState): EditResult {
  return r.ok ? { ...r, state: { ...r.state, toolState: ts } } : r;
}

function numberOf(v: number): Value<number> {
  return { kind: 'number', v };
}

function valueKind(state: EditorState, def: Expr, env: EditorEnv): string | undefined {
  if (def.kind !== 'call' || !def.args.every((a) => a.kind === 'ref' || a.kind === 'lit'))
    return undefined;
  const args = def.args.map((a) =>
    a.kind === 'ref' ? state.values.values.get(a.id) : numberOf(toNumber(a.value)),
  );
  const vals = args.filter((v): v is Value<number> => v !== undefined);
  const r = env.registry.resolve(def.tool, vals);
  if (!r.ok || vals.length !== args.length) return undefined;
  return r.tool.compute(FloatField, vals, state.values.ctx).kind;
}

/**
 * The name kind of a new object: its static kind, or, when that is ambiguous (reflect(X, l)
 * is a point, a curve or a polygon), the kind of its value now.
 */
function nameKind(state: EditorState, def: Expr, env: EditorEnv, fallback: NameKind): NameKind {
  const kinds = exprKinds(def, objectKinds(state.doc, env.registry), env.registry);
  const known = (k: string | undefined): k is 'point' | 'line' | 'circle' | 'polygon' =>
    k === 'point' || k === 'line' || k === 'circle' || k === 'polygon';
  const k = kinds?.length === 1 ? kinds[0] : valueKind(state, def, env);
  return known(k) ? k : fallback;
}

function addEdit(
  state: EditorState,
  def: Expr,
  kind: NameKind,
  env: EditorEnv,
  wanted?: string,
): DocumentEdit {
  const name = preferredName(state.doc, nameKind(state, def, env, kind), wanted);
  return { kind: 'add', object: { name, def, layers: [state.activeLayer] } };
}

/** "l is line(A, B) already; …": what reusing `objs` instead of adding them again says. */
function alreadyThere(state: EditorState, objs: readonly DocObject[]): string {
  const names = (id: number) => state.doc.objects.find((o) => o.id === id)?.name;
  return objs.map((o) => alreadyMessage(o, names)).join('; ');
}

/**
 * Instead of adding objects that are the same constructions as `objs` (ADR-0029): selects
 * them; the result's id is the last one (a tool that goes on picks it) and its notice says
 * so. Nothing is added, so there is no history entry.
 */
function reuse(state: EditorState, objs: readonly DocObject[], env: EditorEnv): EditResult {
  const ids = objs.map((o) => o.id);
  const r = applyEdit(state, { kind: 'select', ids, mode: 'replace' }, env);
  const last = ids[ids.length - 1];
  if (!r.ok || last === undefined) return r;
  return { ...r, id: last, notice: alreadyThere(state, objs) };
}

/**
 * Adds `def` as a new object, or, when an object of the figure is the same construction
 * (line(B, A) for l = line(A, B); ADR-0029), reuses that one (see reuse).
 */
export function add(
  state: EditorState,
  def: Expr,
  kind: NameKind,
  env: EditorEnv,
  wanted?: string,
): EditResult {
  const same = sameConstruction(state.doc, def, env.registry);
  if (same !== undefined) return reuse(state, [same], env);
  return applyEdit(state, addEdit(state, def, kind, env, wanted), env);
}

/**
 * Adds every definition as one batch (one history entry); names are chosen in turn. A
 * definition that is the same construction as an object of the figure is not added: that
 * object is reused (selected and named in the notice; ADR-0029); one that repeats an earlier
 * definition of the batch is left out.
 */
function addAll(
  state: EditorState,
  defs: readonly Expr[],
  kind: NameKind,
  env: EditorEnv,
  want: (doc: Document) => string | undefined = () => undefined,
): EditResult {
  const edits: DocumentEdit[] = [];
  const reused: DocObject[] = [];
  let probe = state;
  for (const def of defs) {
    const same = sameConstruction(probe.doc, def, env.registry);
    if (same !== undefined) {
      const old = state.doc.objects.some((o) => o.id === same.id);
      if (old && !reused.includes(same)) reused.push(same);
      continue;
    }
    const e = addEdit(probe, def, kind, env, want(probe.doc));
    const r = applyEdit(probe, e, env);
    if (!r.ok) return refuse(state, r.reason);
    probe = r.state;
    edits.push(e);
  }
  if (edits.length === 0) return reuse(state, reused, env);
  const [only] = edits;
  const names = edits.map((e) => (e.kind === 'add' ? e.object.name : '')).join(', ');
  const r =
    only !== undefined && edits.length === 1
      ? applyEdit(state, only, env)
      : applyEdit(state, { kind: 'batch', label: `add ${names}`, edits }, env);
  return r.ok && reused.length > 0 ? { ...r, notice: alreadyThere(state, reused) } : r;
}

/** Whether a point object of the figure is at `at` (within the decision band). */
function pointAt(state: EditorState, at: Vec<number>): boolean {
  for (const v of state.values.values.values())
    if (v.kind === 'point' && pointsCoincide(v, at, state.values.ctx)) return true;
  return false;
}

/**
 * Every branch of a branchable call: for intersect, each common point that is not a point of
 * the figure yet (one that is there makes the other `other(P)`, tier 1 of the GUI choice); for
 * tangent_from, both tangents. Each is written with the selectors of the GUI choice for its
 * candidate (SPEC §7), so each keeps its branch when the figure moves (ADR-0024).
 */
function branches(
  state: EditorState,
  tool: 'intersect' | 'tangent_from',
  args: readonly number[],
  kind: NameKind,
  env: EditorEnv,
): EditResult {
  const decider = tool === 'tangent_from' ? 'tangent_point' : tool;
  const vals = args.map((id) => state.values.values.get(id));
  const known = vals.filter((v): v is Value<number> => v !== undefined);
  const spec = env.registry.get(decider);
  if (spec?.candidates === undefined || known.length !== vals.length)
    return refuse(state, 'an object is gone');
  const cands = spec
    .candidates(FloatField, known, state.values.ctx)
    .flatMap((v) => (v.kind === 'point' ? [{ x: v.x, y: v.y }] : []));
  if (cands.length === 0)
    return refuse(
      state,
      tool === 'intersect'
        ? 'the curves do not meet here'
        : `the point is inside the ${known[1]?.kind === 'conic' ? 'conic' : 'circle'}: there is no tangent from it`,
    );
  const fresh = tool === 'intersect' ? cands.filter((c) => !pointAt(state, c)) : cands;
  if (fresh.length === 0)
    return refuse(state, 'every intersection of these curves is a point already');
  const defs: Expr[] = [];
  const missed: string[] = [];
  const notes: string[] = [];
  for (const at of fresh) {
    const ch = chooseSelectors(state.doc, state.values, env.registry, tool, args, at);
    // Two candidates: every one must be singled out (as before); more (conic ∩ conic,
    // ADR-0043): those that can be are built and the others named in the notice.
    if (!ch.ok && cands.length <= 2) return refuse(state, ch.reason);
    if (ch.ok) defs.push(call(tool, args.map(ref), ch.selectors));
    else missed.push(ch.reason);
    if (ch.ok && ch.note !== undefined) notes.push(ch.note);
  }
  if (defs.length === 0) return refuse(state, missed[0] ?? 'nothing to build');
  const r = addAll(state, defs, kind, env, (doc) =>
    tool === 'tangent_from' ? descriptiveName(doc, TANGENT, [nameOf(state, args[0])]) : undefined,
  );
  const said = [
    ...(missed.length === 0
      ? []
      : [
          `${String(defs.length)} of ${String(fresh.length)} intersections built; the others: ${missed[0] ?? ''}`,
        ]),
    ...notes.slice(0, 1),
  ];
  if (!r.ok || said.length === 0) return r;
  const notice = said.join('; ');
  return { ...r, notice: r.notice === undefined ? notice : `${notice}; ${r.notice}` };
}

function intersections(state: EditorState, picks: readonly number[], env: EditorEnv) {
  const [a, b] = picks;
  const [va, vb] = [state.values.values.get(a ?? -1), state.values.values.get(b ?? -1)];
  if (a === undefined || b === undefined || va === undefined || vb === undefined)
    return refuse(state, 'pick two curves');
  const r = env.registry.resolve('intersect', [va, vb]);
  if (!r.ok) return refuse(state, r.reason);
  if (r.signature.branch !== undefined && r.signature.branch.candidates > 1)
    return branches(state, 'intersect', [a, b], 'point', env);
  // One common point at most (two lines): parallel lines meet at their point at infinity
  // (ADR-0042, Run 16a's queue); lines that do not meet here (segments whose ranges miss) are
  // refused, as curves are, rather than adding an Undefined point.
  const p = r.tool.compute(FloatField, [va, vb], state.values.ctx);
  if (p.kind === 'ideal_point') return atInfinity(state, a, b, env);
  if (p.kind !== 'point') return refuse(state, 'the curves do not meet here');
  return add(state, call('intersect', [ref(a), ref(b)]), 'point', env);
}

/**
 * The common point at infinity of two parallel lines: added, selected (the Objects panel shows
 * it, as it is not drawn), with the notice "point at infinity, direction of l".
 */
function atInfinity(state: EditorState, a: number, b: number, env: EditorEnv): EditResult {
  const r = add(state, call('intersect', [ref(a), ref(b)]), 'point', env);
  if (!r.ok || r.id === undefined) return r;
  const sel = applyEdit(r.state, { kind: 'select', ids: [r.id], mode: 'replace' }, env);
  if (!sel.ok) return r;
  const l = state.doc.objects.find((o) => o.id === a)?.name ?? 'the lines';
  const notice = `point at infinity, direction of ${l}`;
  return {
    ...r,
    state: sel.state,
    notice: r.notice === undefined ? notice : `${notice}; ${r.notice}`,
  };
}

/** The tangent at A, and the tangents from A, are t_A (ADR-0050). */
const TANGENT: Description = { prefix: 't', picks: 'first' };

function nameOf(state: EditorState, id: number | undefined): string | undefined {
  return state.doc.objects.find((o) => o.id === id)?.name;
}

function tangent(state: EditorState, picks: readonly number[], env: EditorEnv): EditResult {
  const [p, c] = picks;
  const [P, C] = [state.values.values.get(p ?? -1), state.values.values.get(c ?? -1)];
  if (p === undefined || c === undefined || P?.kind !== 'point')
    return refuse(state, 'pick a point and a circle or a conic');
  if (C?.kind !== 'circle' && C?.kind !== 'conic')
    return refuse(state, 'pick a point and a circle or a conic');
  // A conic (ADR-0042): on it as the kernel decides it (the incidence length with the band).
  const on =
    C.kind === 'circle'
      ? requireOnCircle(FloatField, P, C, state.values.ctx, 'tangent') === undefined
      : onConicSign(FloatField, C, P, state.values.ctx) === 0;
  if (!on) return branches(state, 'tangent_from', [p, c], 'line', env);
  if (!tangentStays(state, p, c, env)) {
    const name = (id: number) => state.doc.objects.find((o) => o.id === id)?.name ?? '?';
    return refuse(
      state,
      `${name(p)} is on ${name(c)} only by coincidence: its tangent would be lost as soon as ` +
        `the figure moves (put the point on the ${C.kind} with "Point on object" first)`,
    );
  }
  const wanted = descriptiveName(state.doc, TANGENT, [nameOf(state, p)]);
  return add(state, call('tangent', [ref(p), ref(c)]), 'line', env, wanted);
}

/**
 * Whether tangent(P, c) stays defined in each figure of the local responses (each free input
 * moved by one local deviation), as the kernel's compute decides: P is on c by construction,
 * not by coincidence (the check ADR-0027 item 5 gave other(P) in choice.ts).
 */
function tangentStays(state: EditorState, p: number, c: number, env: EditorEnv): boolean {
  const spec = env.registry.get('tangent');
  if (spec === undefined) return false;
  const ctx = state.values.ctx;
  return localResponses(state.doc, state.values.values, env.registry, ctx).every((r) => {
    const [P, C] = [r.get(p), r.get(c)];
    return (
      P !== undefined && C !== undefined && spec.compute(FloatField, [P, C], ctx).kind === 'line'
    );
  });
}

/** The tool's typed number as an exact literal, or why it is not one. */
function typedValue(tool: ToolUI, text: string): Expr | string {
  const t = text.trim().replace(/°$/u, '');
  const r = parseRational(t);
  if (tool.value === undefined) return 'this tool takes no number';
  return r.ok ? lit(r.value, t) : `${tool.value.label}: ${r.reason}`;
}

function callBuild(
  state: EditorState,
  tool: ToolUI,
  b: Extract<ToolUI['build'], { kind: 'call' }>,
  picks: readonly number[],
  env: EditorEnv,
): EditResult {
  const names = picks.map((id) => nameOf(state, id));
  const conventional = conventionalName(b.prefer, names[0]);
  const wanted = wantedName(state.doc, conventional, b.describe, names);
  const value = tool.value === undefined ? undefined : typedValue(tool, state.toolState.value);
  if (typeof value === 'string') return refuse(state, value);
  const args = [...picks.map(ref), ...(value === undefined ? [] : [value])];
  // A map tool that builds the map alone (reflect(l)) names it as a transformation.
  const kind = tool.map === true && state.toolState.mapOnly === true ? 'transform' : b.name;
  return add(state, call(b.tool, args), kind, env, wanted);
}

/** Builds the tool's object(s) from complete picks, in the order of the tool's steps. */
export function build(
  state: EditorState,
  tool: ToolUI,
  picks: readonly number[],
  env: EditorEnv,
): EditResult {
  const b = tool.build;
  switch (b.kind) {
    case 'none':
      return done({ ...state, toolState: reset(state) });
    case 'call':
      return withTool(callBuild(state, tool, b, picks, env), reset(state));
    case 'claim': {
      const claim = { kind: state.toolState.claimKind, args: picks.map(ref) };
      return withTool(applyEdit(state, { kind: 'addClaim', claim }, env), reset(state));
    }
    case 'derivedLayer': {
      const [t] = picks;
      if (t === undefined) return refuse(state, 'pick a transformation');
      const spec = { name: freshName(state.doc, 'layer'), transform: t, source: state.activeLayer };
      return withTool(applyEdit(state, { kind: 'addDerivedLayer', spec }, env), reset(state));
    }
    case 'intersection':
      return withTool(intersections(state, picks, env), reset(state));
    case 'tangent':
      return withTool(tangent(state, picks, env), reset(state));
    case 'text':
      // The anchor is picked; the string comes as a `text` input.
      return done({ ...state, toolState: { ...state.toolState, picks, slots: [0] } });
    default:
      return assertNever(b, 'tool build');
  }
}
