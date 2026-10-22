/**
 * The tool state machine (SPEC §12): ONE machine runs every tool of tools.ts. Inputs are
 * clicks (the scene's hit-test result at the cursor and its world position), objects chosen
 * in the panel, `finish`, `cancel`, and typed text. A pick that needs a point and lands on
 * no point CREATES one (create.ts: free, a glider, or an intersection with the GUI selector
 * choice), at once and as its own edit. A tool whose steps differ in kind may take its picks
 * in any order (ToolUI.anyOrder, Geomdraw's order-free tools, ADR-0024): a click fills the
 * first open step that takes what it hits. When a tool's picks are complete it builds its
 * object(s) (machine-build.ts: one edit). Every change goes through applyEdit, so history,
 * invariants and derived layers stay right; a refused input leaves the state unchanged.
 */
import { call, ref } from '@geomira/kernel/expr';
import type { Value, Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import type { HitResult } from '@geomira/scene/hit';
import { createdPoint, gliderAt } from './create';
import { applyEdit } from './edit';
import { add, build, reset, withTool } from './machine-build';
import { done, refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';
import { openSteps, stepsOf } from './tool-steps';
import { toolUI, type PickKind, type ToolUI } from './tools';

export { claimToolKinds, stepsOf } from './tool-steps';

export type ToolInput =
  | { readonly kind: 'click'; readonly hit: HitResult; readonly world: Vec<number> }
  | { readonly kind: 'object'; readonly id: number }
  | { readonly kind: 'finish' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'text'; readonly value: string };

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

/** The picks in the order of the tool's steps (an order-free tool may have filled them out of order). */
function inStepOrder(picks: readonly number[], slots: readonly number[]): number[] {
  return picks
    .map((id, i) => ({ id, slot: slots[i] ?? i }))
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.id);
}

/** Adds a pick for step `slot`; builds when the tool has all it needs. */
function pushPick(
  state: EditorState,
  tool: ToolUI,
  id: number,
  slot: number,
  env: EditorEnv,
): EditResult {
  const ts = state.toolState;
  const { steps, rest } = stepsOf(tool, ts);
  const closes = rest?.pick === 'point' && ts.picks.length >= steps.length && id === ts.picks[0];
  if (closes) return build(state, tool, inStepOrder(ts.picks, ts.slots), env);
  if (ts.picks.includes(id) && tool.repeats !== true)
    return refuse(state, 'this object is already picked');
  const picks = [...ts.picks, id];
  const slots = [...ts.slots, slot];
  if (picks.length >= steps.length && rest === undefined)
    return build(state, tool, inStepOrder(picks, slots), env);
  return done({ ...state, toolState: { ...ts, picks, slots } });
}

function moveClick(state: EditorState, hit: HitResult, env: EditorEnv): EditResult {
  const top = hit.hits[0];
  return applyEdit(
    state,
    { kind: 'select', ids: top === undefined ? [] : [top.id], mode: 'replace' },
    env,
  );
}

function gliderClick(
  state: EditorState,
  input: Extract<ToolInput, { kind: 'click' }>,
  env: EditorEnv,
): EditResult {
  const curve = input.hit.hits.find((h) => h.kind === 'line' || h.kind === 'circle')?.id;
  const v = input.hit.virtual;
  const at = v.kind === 'on' ? v.world : input.world;
  if (curve === undefined) return refuse(state, 'click a line or a circle');
  const def = gliderAt(state, curve, at);
  return typeof def === 'string'
    ? refuse(state, def)
    : withTool(add(state, def, 'point', env), reset(state));
}

function click(
  state: EditorState,
  tool: ToolUI,
  input: Extract<ToolInput, { kind: 'click' }>,
  env: EditorEnv,
): EditResult {
  const ts = state.toolState;
  if (tool.id === 'move') return moveClick(state, input.hit, env);
  if (tool.id === 'glider') return gliderClick(state, input, env);
  const open = openSteps(tool, ts);
  const [first] = open;
  if (first === undefined)
    return refuse(state, tool.build.kind === 'text' ? 'type the text' : 'nothing to pick');
  for (const h of input.hit.hits) {
    const o = open.find((x) => HIT_KINDS[x.step.pick].includes(h.kind));
    if (o !== undefined) return pushPick(state, tool, h.id, o.index, env);
  }
  const point = open.find((x) => x.step.pick === 'point');
  if (point === undefined) return refuse(state, `${first.step.prompt}: click a ${first.step.pick}`);
  const def = createdPoint(state, input.hit.virtual, env);
  if (typeof def === 'string') return refuse(state, def);
  const made = add(state, def, 'point', env);
  if (!made.ok || made.id === undefined) return made.ok ? refuse(state, 'no point was made') : made;
  const r = pushPick(made.state, tool, made.id, point.index, env);
  // A later refusal keeps the new point (its own edit); the tool's picks stay as they were.
  return r.ok ? r : { ...made, state: { ...made.state, toolState: ts } };
}

function objectInput(state: EditorState, tool: ToolUI, id: number, env: EditorEnv): EditResult {
  const open = openSteps(tool, state.toolState);
  const [first] = open;
  if (first === undefined) return refuse(state, 'nothing to pick');
  const v = state.values.values.get(id);
  const o = open.find((x) => fits(v, x.step.pick));
  if (o === undefined) return refuse(state, `${first.step.prompt}: pick a ${first.step.pick}`);
  return pushPick(state, tool, id, o.index, env);
}

function textInput(state: EditorState, tool: ToolUI, value: string, env: EditorEnv): EditResult {
  const [anchor] = state.toolState.picks;
  if (tool.build.kind !== 'text' || anchor === undefined)
    return refuse(state, 'no text is expected');
  if (value === '') return refuse(state, 'the text is empty');
  const def = call('text', [ref(anchor), { kind: 'str', value }]);
  return withTool(add(state, def, 'text', env), reset(state));
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
    case 'object':
      return objectInput(state, tool, input.id, env);
    case 'finish': {
      const { steps, rest } = stepsOf(tool, ts);
      if (rest === undefined || ts.picks.length < steps.length)
        return refuse(state, 'not enough picks to finish');
      return build(state, tool, inStepOrder(ts.picks, ts.slots), env);
    }
    case 'text':
      return textInput(state, tool, input.value, env);
    default:
      return assertNever(input, 'tool input');
  }
}
