/**
 * What a GUI tool builds once its picks are complete (machine.ts runs the picks). Every
 * object is added through applyEdit (history, invariants, derived layers), in the active
 * layer, named by names.ts. A tool that builds several objects (both tangents from a point,
 * every new intersection of two curves) adds them as ONE batch: one history entry, undone
 * together (ADR-0024).
 */
import type { DocumentEdit } from './edit';
import { exprKinds, objectKinds } from '@geomira/kernel/derived';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { requireOnCircle } from '@geomira/kernel/incidence';
import type { Value, Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import { parseRational, toNumber } from '@geomira/num/rational';
import { pointsCoincide } from '@geomira/scene/coincide';
import { chooseSelectors } from './choice';
import { applyEdit } from './edit';
import { conventionalName, preferredName } from './conventional-names';
import { freshName, type NameKind } from './names';
import { done, refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';
import { idleTool, type ToolState } from './tool-state';
import type { ToolUI } from './tool-ui';

/** The idle tool after a build: no picks; the claim kind and the typed number stay. */
export function reset(state: EditorState): ToolState {
  return idleTool(state.toolState.claimKind, state.toolState.value);
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

export function add(
  state: EditorState,
  def: Expr,
  kind: NameKind,
  env: EditorEnv,
  wanted?: string,
): EditResult {
  return applyEdit(state, addEdit(state, def, kind, env, wanted), env);
}

/** Adds every definition as one batch (one history entry); names are chosen in turn. */
function addAll(
  state: EditorState,
  defs: readonly Expr[],
  kind: NameKind,
  env: EditorEnv,
): EditResult {
  const edits: DocumentEdit[] = [];
  let probe = state;
  for (const def of defs) {
    const e = addEdit(probe, def, kind, env);
    const r = applyEdit(probe, e, env);
    if (!r.ok) return refuse(state, r.reason);
    probe = r.state;
    edits.push(e);
  }
  const [only] = edits;
  if (only !== undefined && edits.length === 1) return applyEdit(state, only, env);
  const names = edits.map((e) => (e.kind === 'add' ? e.object.name : '')).join(', ');
  return applyEdit(state, { kind: 'batch', label: `add ${names}`, edits }, env);
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
        : 'the point is inside the circle: there is no tangent from it',
    );
  const fresh = tool === 'intersect' ? cands.filter((c) => !pointAt(state, c)) : cands;
  if (fresh.length === 0)
    return refuse(state, 'every intersection of these curves is a point already');
  const defs: Expr[] = [];
  for (const at of fresh) {
    const ch = chooseSelectors(state.doc, state.values, env.registry, tool, args, at);
    if (!ch.ok) return refuse(state, ch.reason);
    defs.push(call(tool, args.map(ref), ch.selectors));
  }
  return addAll(state, defs, kind, env);
}

function intersections(state: EditorState, picks: readonly number[], env: EditorEnv) {
  const [a, b] = picks;
  const [va, vb] = [state.values.values.get(a ?? -1), state.values.values.get(b ?? -1)];
  if (a === undefined || b === undefined || va === undefined || vb === undefined)
    return refuse(state, 'pick two curves');
  const r = env.registry.resolve('intersect', [va, vb]);
  if (!r.ok) return refuse(state, r.reason);
  if (r.signature.branch?.candidates !== 2)
    return add(state, call('intersect', [ref(a), ref(b)]), 'point', env);
  return branches(state, 'intersect', [a, b], 'point', env);
}

function tangent(state: EditorState, picks: readonly number[], env: EditorEnv): EditResult {
  const [p, c] = picks;
  const [P, C] = [state.values.values.get(p ?? -1), state.values.values.get(c ?? -1)];
  if (p === undefined || c === undefined || P?.kind !== 'point' || C?.kind !== 'circle')
    return refuse(state, 'pick a point and a circle');
  const on = requireOnCircle(FloatField, P, C, state.values.ctx, 'tangent') === undefined;
  if (on) return add(state, call('tangent', [ref(p), ref(c)]), 'line', env);
  return branches(state, 'tangent_from', [p, c], 'line', env);
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
  const first = state.doc.objects.find((o) => o.id === picks[0])?.name;
  const wanted = conventionalName(b.prefer, first);
  const value = tool.value === undefined ? undefined : typedValue(tool, state.toolState.value);
  if (typeof value === 'string') return refuse(state, value);
  const args = [...picks.map(ref), ...(value === undefined ? [] : [value])];
  return add(state, call(b.tool, args), b.name, env, wanted);
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
