/**
 * The tool state machine (SPEC §12): ONE machine runs every tool of tools.ts. Inputs are
 * clicks (the scene's hit-test result at the cursor and its world position), objects chosen
 * in the panel, `finish`, `cancel`, and typed text. A pick that needs a point and lands on
 * no point CREATES one (create.ts: free, a glider, or an intersection with the GUI selector
 * choice), at once and as its own edit. When a tool's picks are complete it builds its
 * object (one edit). Every change goes through applyEdit, so history, invariants and
 * derived layers stay right; a refused input leaves the state unchanged. New objects are
 * built in the active layer and named by names.ts.
 */
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import type { ClaimParam } from '@geomira/claims/kind';
import { exprKinds, objectKinds } from '@geomira/kernel/derived';
import { call, ref, type Expr } from '@geomira/kernel/expr';
import { requireOnCircle } from '@geomira/kernel/incidence';
import type { Value, Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import type { HitResult } from '@geomira/scene/hit';
import { chooseSelectors } from './choice';
import { createdPoint, gliderAt } from './create';
import { applyEdit } from './edit';
import { conventionalName, preferredName } from './conventional-names';
import { freshName, type NameKind } from './names';
import { done, refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';
import { idleTool, type Choosing, type ToolState } from './tool-state';
import { toolUI, type PickKind, type ToolStep, type ToolUI } from './tools';

export type ToolInput =
  | { readonly kind: 'click'; readonly hit: HitResult; readonly world: Vec<number> }
  | { readonly kind: 'object'; readonly id: number }
  | { readonly kind: 'finish' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'text'; readonly value: string };

const OBJECT_PARAMS: readonly ClaimParam[] = ['point', 'line', 'circle', 'curve'];

/** Claim kinds the claim tool offers: those whose parameters are all objects. */
export function claimToolKinds(): string[] {
  const objects = (p: ClaimParam) => OBJECT_PARAMS.includes(p);
  return CLAIM_KINDS.filter(
    (k) => k.params.every(objects) && (k.rest === undefined || objects(k.rest)),
  ).map((k) => k.name);
}

function pickOfParam(p: ClaimParam): PickKind {
  return p === 'point' || p === 'line' || p === 'circle' ? p : 'curve';
}

/** The steps of the active tool (the claim tool's come from its claim kind). */
export function stepsOf(
  tool: ToolUI,
  ts: ToolState,
): { steps: readonly ToolStep[]; rest?: ToolStep } {
  if (tool.build.kind !== 'claim') return tool;
  const k = CLAIM_KINDS.find((x) => x.name === ts.claimKind);
  if (k === undefined || !claimToolKinds().includes(k.name)) return { steps: [] };
  const step = (p: ClaimParam): ToolStep => ({ pick: pickOfParam(p), prompt: `${k.name}: ${p}` });
  const steps = k.params.map(step);
  return k.rest === undefined ? { steps } : { steps, rest: step(k.rest) };
}

/** The hit kinds (scene shapes) each pick kind accepts. */
const HIT_KINDS: Readonly<Record<PickKind, readonly string[]>> = Object.freeze({
  point: ['point'],
  line: ['line'],
  circle: ['circle'],
  curve: ['line', 'circle'],
  figure: ['point', 'line', 'circle', 'polygon'],
  mirror: ['point', 'line'],
  transform: [],
});

/** Whether an object's value fits a pick kind (panel choices). */
function fits(v: Value<number> | undefined, pick: PickKind): boolean {
  const k = v?.kind;
  return pick === 'transform' ? k === 'transform' : k !== undefined && HIT_KINDS[pick].includes(k);
}

/**
 * The name kind of a new object: its static kind, or, when that is ambiguous (reflect(X, l)
 * is a point, a curve or a polygon), the kind of its value now (a call of references).
 */
function nameKind(state: EditorState, def: Expr, env: EditorEnv, fallback: NameKind): NameKind {
  const kinds = exprKinds(def, objectKinds(state.doc, env.registry), env.registry);
  const known = (k: string | undefined): k is 'point' | 'line' | 'circle' | 'polygon' =>
    k === 'point' || k === 'line' || k === 'circle' || k === 'polygon';
  const k = kinds?.length === 1 ? kinds[0] : valueKind(state, def, env);
  return known(k) ? k : fallback;
}

function valueKind(state: EditorState, def: Expr, env: EditorEnv): string | undefined {
  if (def.kind !== 'call' || !def.args.every((a) => a.kind === 'ref')) return undefined;
  const args = def.args.map((a) => state.values.values.get(a.id));
  const vals = args.filter((v): v is Value<number> => v !== undefined);
  const r = env.registry.resolve(def.tool, vals);
  if (!r.ok || vals.length !== args.length) return undefined;
  return r.tool.compute(FloatField, vals, state.values.ctx).kind;
}

function add(
  state: EditorState,
  def: Expr,
  kind: NameKind,
  env: EditorEnv,
  wanted?: string,
): EditResult {
  const name = preferredName(state.doc, nameKind(state, def, env, kind), wanted);
  return applyEdit(state, { kind: 'add', object: { name, def, layers: [state.activeLayer] } }, env);
}

function withTool(r: EditResult, ts: ToolState): EditResult {
  return r.ok ? { ...r, state: { ...r.state, toolState: ts } } : r;
}

function reset(state: EditorState): ToolState {
  return idleTool(state.toolState.claimKind);
}

/** A branchable build: one candidate is built at once, two wait for the click that chooses. */
function branch(state: EditorState, choosing: Choosing, env: EditorEnv): EditResult {
  const values = choosing.args.map((id) => state.values.values.get(id));
  const decider = choosing.tool === 'tangent_from' ? 'tangent_point' : choosing.tool;
  const known = values.filter((v): v is Value<number> => v !== undefined);
  const r = env.registry.resolve(decider, known);
  if (!r.ok || known.length !== values.length)
    return refuse(state, r.ok ? 'an object is gone' : r.reason);
  if (r.signature.branch?.candidates !== 2) {
    return withTool(
      add(state, call(choosing.tool, choosing.args.map(ref)), 'point', env),
      reset(state),
    );
  }
  return done({ ...state, toolState: { ...state.toolState, picks: [], choosing } });
}

function tangent(state: EditorState, picks: readonly number[], env: EditorEnv): EditResult {
  const [p, c] = picks;
  const [P, C] = [state.values.values.get(p ?? -1), state.values.values.get(c ?? -1)];
  if (p === undefined || c === undefined || P?.kind !== 'point' || C?.kind !== 'circle')
    return refuse(state, 'pick a point and a circle');
  const on = requireOnCircle(FloatField, P, C, state.values.ctx, 'tangent') === undefined;
  if (on) return withTool(add(state, call('tangent', [ref(p), ref(c)]), 'line', env), reset(state));
  return branch(state, { tool: 'tangent_from', args: [p, c] }, env);
}

/** Builds the tool's object from complete picks. */
function build(
  state: EditorState,
  tool: ToolUI,
  picks: readonly number[],
  env: EditorEnv,
): EditResult {
  const b = tool.build;
  switch (b.kind) {
    case 'none':
      return done({ ...state, toolState: reset(state) });
    case 'call': {
      const first = state.doc.objects.find((o) => o.id === picks[0])?.name;
      const wanted = conventionalName(b.prefer, first);
      return withTool(add(state, call(b.tool, picks.map(ref)), b.name, env, wanted), reset(state));
    }
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
      return branch(state, { tool: 'intersect', args: picks }, env);
    case 'tangent':
      return tangent(state, picks, env);
    case 'text':
      // The anchor is picked; the string comes as a `text` input.
      return done({ ...state, toolState: { ...state.toolState, picks } });
    default:
      return assertNever(b, 'tool build');
  }
}

/** Adds a pick; builds when the tool has all it needs. */
function pushPick(state: EditorState, tool: ToolUI, id: number, env: EditorEnv): EditResult {
  const picks = state.toolState.picks;
  const { steps, rest } = stepsOf(tool, state.toolState);
  const closes = rest?.pick === 'point' && picks.length >= steps.length && id === picks[0];
  if (closes) return build(state, tool, picks, env);
  if (picks.includes(id)) return refuse(state, 'this object is already picked');
  const next = [...picks, id];
  if (next.length >= steps.length && rest === undefined) return build(state, tool, next, env);
  return done({ ...state, toolState: { ...state.toolState, picks: next } });
}

/** The step the next pick is for, or undefined when the tool takes no more picks. */
function nextStep(tool: ToolUI, ts: ToolState): ToolStep | undefined {
  const { steps, rest } = stepsOf(tool, ts);
  return steps[ts.picks.length] ?? rest;
}

function click(
  state: EditorState,
  tool: ToolUI,
  input: Extract<ToolInput, { kind: 'click' }>,
  env: EditorEnv,
): EditResult {
  const ts = state.toolState;
  if (ts.choosing !== null) return choose(state, ts.choosing, input.world, env);
  const hits = input.hit.hits;
  if (tool.id === 'move') {
    const top = hits[0];
    return applyEdit(
      state,
      { kind: 'select', ids: top === undefined ? [] : [top.id], mode: 'replace' },
      env,
    );
  }
  if (tool.id === 'glider') {
    const curve = hits.find((h) => h.kind === 'line' || h.kind === 'circle')?.id;
    const v = input.hit.virtual;
    const at = v.kind === 'on' ? v.world : input.world;
    if (curve === undefined) return refuse(state, 'click a line or a circle');
    const def = gliderAt(state, curve, at);
    return typeof def === 'string'
      ? refuse(state, def)
      : withTool(add(state, def, 'point', env), reset(state));
  }
  const step = nextStep(tool, ts);
  if (step === undefined)
    return refuse(state, tool.build.kind === 'text' ? 'type the text' : 'nothing to pick');
  const hit = hits.find((h) => HIT_KINDS[step.pick].includes(h.kind));
  if (hit !== undefined) return pushPick(state, tool, hit.id, env);
  if (step.pick !== 'point') return refuse(state, `${step.prompt}: click a ${step.pick}`);
  const def = createdPoint(state, input.hit.virtual, env);
  if (typeof def === 'string') return refuse(state, def);
  const made = add(state, def, 'point', env);
  if (!made.ok || made.id === undefined) return made.ok ? refuse(state, 'no point was made') : made;
  const r = pushPick(made.state, tool, made.id, env);
  // A later refusal keeps the new point (its own edit); the tool's picks stay as they were.
  return r.ok ? r : { ...made, state: { ...made.state, toolState: ts } };
}

function choose(state: EditorState, c: Choosing, at: Vec<number>, env: EditorEnv): EditResult {
  const ch = chooseSelectors(state.doc, state.values, env.registry, c.tool, c.args, at);
  if (!ch.ok) return refuse(state, ch.reason);
  const def = call(c.tool, c.args.map(ref), ch.selectors);
  return withTool(add(state, def, c.tool === 'intersect' ? 'point' : 'line', env), reset(state));
}

/** One input to the active tool (see the module comment). Never throws. */
export function toolInput(state: EditorState, input: ToolInput, env: EditorEnv): EditResult {
  const tool = toolUI(state.tool);
  if (tool === undefined) return refuse(state, `there is no tool "${state.tool}"`);
  const ts = state.toolState;
  switch (input.kind) {
    case 'cancel':
      return done({ ...state, toolState: reset(state) });
    case 'click':
      return click(state, tool, input, env);
    case 'object': {
      const step = nextStep(tool, ts);
      if (ts.choosing !== null || step === undefined) return refuse(state, 'nothing to pick');
      if (!fits(state.values.values.get(input.id), step.pick))
        return refuse(state, `${step.prompt}: pick a ${step.pick}`);
      return pushPick(state, tool, input.id, env);
    }
    case 'finish': {
      const { steps, rest } = stepsOf(tool, ts);
      if (rest === undefined || ts.picks.length < steps.length)
        return refuse(state, 'not enough picks to finish');
      return build(state, tool, ts.picks, env);
    }
    case 'text': {
      const [anchor] = ts.picks;
      if (tool.build.kind !== 'text' || anchor === undefined)
        return refuse(state, 'no text is expected');
      if (input.value === '') return refuse(state, 'the text is empty');
      const def = call('text', [ref(anchor), { kind: 'str', value: input.value }]);
      return withTool(add(state, def, 'text', env), reset(state));
    }
    default:
      return assertNever(input, 'tool input');
  }
}
