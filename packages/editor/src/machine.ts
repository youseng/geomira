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
import { onSides, polygonSide, sideObject } from './create-side';
import { applyEdit } from './edit';
import { add, build, reset, withTool } from './machine-build';
import { done, refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';
import type { ToolState } from './tool-state';
import { filledSteps, mayRepeat, openSteps, pendingPair, pickGroups, stepsOf } from './tool-steps';
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
  line_or_points: ['line', 'point'],
  circle: ['circle'],
  oval: ['circle', 'conic'],
  // A conic is a curve too (ADR-0042); the words name it (ADR-0044).
  curve: ['line', 'circle', 'conic'],
  figure: ['point', 'line', 'circle', 'polygon'],
  mirror: ['point', 'line'],
  transform: [],
});

/** What a pick kind asks the user to click, in words ("a point, line, circle or polygon"). */
const PICK_WORDS: Readonly<Record<PickKind, string>> = Object.freeze({
  point: 'point',
  line: 'line',
  line_or_points: 'line, or a point',
  circle: 'circle',
  oval: 'circle or conic',
  curve: 'line, circle or conic',
  figure: 'point, line, circle or polygon',
  mirror: 'line or point',
  transform: 'transform',
});

/** Whether an object's value fits a pick kind (panel choices). */
function fits(v: Value<number> | undefined, pick: PickKind): boolean {
  const k = v?.kind;
  return pick === 'transform' ? k === 'transform' : k !== undefined && HIT_KINDS[pick].includes(k);
}

/** The picks in the order of the tool's steps (an order-free tool may have filled them out of order). */
function inStepOrder(picks: readonly number[], slots: readonly number[]): number[] {
  return pickGroups(picks, slots).flat();
}

function buildPicks(
  state: EditorState,
  tool: ToolUI,
  picks: readonly number[],
  slots: readonly number[],
  env: EditorEnv,
): EditResult {
  return build(state, tool, inStepOrder(picks, slots), env, pickGroups(picks, slots));
}

/**
 * A point picked for a claim tool's line step (ADR-0051): the first point of a line given by
 * two points, or its second point. Returns the tool state with the pick, the reason it is
 * refused, or undefined when the pick is not such a point.
 */
function pairPick(
  state: EditorState,
  tool: ToolUI,
  id: number,
  slot: number,
): ToolState | string | undefined {
  const ts = state.toolState;
  const pending = pendingPair(ts);
  const picks = [...ts.picks, id];
  const slots = [...ts.slots, slot];
  if (pending !== undefined) {
    const first = ts.picks[ts.slots.indexOf(pending)];
    if (first === id) return 'pick a second point: a line needs two points';
    return { ...ts, picks, slots };
  }
  const { steps, rest } = stepsOf(tool, ts);
  const step = steps[slot] ?? rest;
  if (step?.pick !== 'line_or_points' || state.values.values.get(id)?.kind !== 'point')
    return undefined;
  return { ...ts, picks, slots, pairs: [...(ts.pairs ?? []), slot] };
}

/** Whether picking `id` again ends the tool (a polygon closes; a claim's list of lines ends). */
function closes(tool: ToolUI, ts: ToolState, id: number): boolean {
  const { steps, rest } = stepsOf(tool, ts);
  const again = rest?.pick === 'point' || (tool.build.kind === 'claim' && rest !== undefined);
  const first = ts.picks[0] === id && ts.pairs?.includes(0) !== true;
  return again && first && pendingPair(ts) === undefined && filledSteps(ts) >= steps.length;
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
  if (closes(tool, ts, id)) return buildPicks(state, tool, ts.picks, ts.slots, env);
  const pair = pairPick(state, tool, id, slot);
  if (typeof pair === 'string') return refuse(state, pair);
  if (pair === undefined && ts.picks.includes(id) && !mayRepeat(tool, ts))
    return refuse(state, 'this object is already picked');
  const next: ToolState = pair ?? { ...ts, picks: [...ts.picks, id], slots: [...ts.slots, slot] };
  if (filledSteps(next) >= steps.length && rest === undefined && pendingPair(next) === undefined)
    return buildPicks(state, tool, next.picks, next.slots, env);
  return done({ ...state, toolState: next });
}

function moveClick(state: EditorState, hit: HitResult, env: EditorEnv): EditResult {
  const top = hit.hits[0];
  return applyEdit(
    state,
    { kind: 'select', ids: top === undefined ? [] : [top.id], mode: 'replace' },
    env,
  );
}

function addGlider(state: EditorState, curve: number, at: Vec<number>, env: EditorEnv) {
  const def = gliderAt(state, curve, at);
  return typeof def === 'string' ? refuse(state, def) : add(state, def, 'point', env);
}

/**
 * The glider tool: a point on the line, circle or conic under the click (never on a point that is
 * there already), or on a polygon's side, its segment(A, B) (an existing one, or a new one
 * as its own edit, ADR-0024 item 8).
 */
function gliderClick(
  state: EditorState,
  input: Extract<ToolInput, { kind: 'click' }>,
  env: EditorEnv,
): EditResult {
  // As with the point tool, a click on a point never creates another one there.
  const point = input.hit.hits.find((h) => h.kind === 'point');
  if (point !== undefined)
    return refuse(state, `${point.name} is here already: click the curve where there is no point`);
  const curve = input.hit.hits.find(
    (h) => h.kind === 'line' || h.kind === 'circle' || h.kind === 'conic',
  )?.id;
  const v = input.hit.virtual;
  const at = v.kind === 'on' ? v.world : input.world;
  if (curve !== undefined) return withTool(addGlider(state, curve, at, env), reset(state));
  const side = polygonSide(state, input.hit, input.world);
  if (side === undefined) return refuse(state, 'click a line, a circle or a conic');
  const made = sideObject(state, side, env);
  if (!made.ok || made.id === undefined) return refuse(state, 'the side could not be made');
  const r = addGlider(made.state, made.id, at, env);
  // A refused glider leaves no stray side.
  return r.ok ? withTool(r, reset(state)) : refuse(state, r.reason);
}

/**
 * The second object of a pair (ToolUI.pair, ADR-0045): when only the pair's step is filled, a
 * pick of the same kind that is not the first object, with neither the first object nor a point
 * under the click (those keep their meaning: a glider on the first curve, the point).
 */
function secondCurvePick(
  state: EditorState,
  tool: ToolUI,
  candidates: readonly { readonly id: number; readonly kind: string }[],
): readonly [number, number] | undefined {
  const { pair } = tool;
  const ts = state.toolState;
  const [first] = ts.picks;
  if (pair === undefined || first === undefined || ts.slots.length !== 1) return undefined;
  if (ts.slots[0] !== pair.slot) return undefined;
  const step = stepsOf(tool, ts).steps[pair.slot];
  if (step === undefined || candidates.some((h) => h.id === first || h.kind === 'point'))
    return undefined;
  const second = candidates.find((h) => HIT_KINDS[step.pick].includes(h.kind));
  return second === undefined ? undefined : [first, second.id];
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
  const pair = secondCurvePick(state, tool, input.hit.hits);
  if (pair !== undefined) return build(state, tool, pair, env);
  for (const h of input.hit.hits) {
    const o = open.find((x) => HIT_KINDS[x.step.pick].includes(h.kind));
    if (o !== undefined) return pushPick(state, tool, h.id, o.index, env);
  }
  const line = open.find((x) => HIT_KINDS[x.step.pick].includes('line'));
  const side = line === undefined ? undefined : polygonSide(state, input.hit, input.world);
  if (line !== undefined && side !== undefined)
    return created(state, tool, sideObject(state, side, env), line.index, env);
  const point = open.find((x) => x.step.pick === 'point');
  if (point === undefined)
    return refuse(state, `${first.step.prompt}: click a ${PICK_WORDS[first.step.pick]}`);
  const sides = onSides(state, input.hit.virtual, env);
  if (typeof sides === 'string') return refuse(state, sides);
  const def = createdPoint(sides.state, sides.virtual, env);
  if (typeof def === 'string') return refuse(state, def);
  return created(state, tool, add(sides.state, def, 'point', env), point.index, env);
}

/**
 * Picks an object a click just created (its own edit) for step `slot`. When the pick or the
 * build it completes is refused, the whole click is: the reason is given and `origin` (the
 * state before the click) is kept, so no stray point or side is left behind.
 */
function created(
  origin: EditorState,
  tool: ToolUI,
  made: EditResult,
  slot: number,
  env: EditorEnv,
): EditResult {
  if (!made.ok) return refuse(origin, made.reason);
  if (made.id === undefined) return refuse(origin, 'nothing was made');
  const r = pushPick(made.state, tool, made.id, slot, env);
  // The notice of an object reused rather than made again (ADR-0029) stays with the click.
  const notice = r.ok ? (r.notice ?? made.notice) : undefined;
  if (!r.ok) return refuse(origin, r.reason);
  return notice === undefined ? r : { ...r, notice };
}

function objectInput(state: EditorState, tool: ToolUI, id: number, env: EditorEnv): EditResult {
  const open = openSteps(tool, state.toolState);
  const [first] = open;
  if (first === undefined) return refuse(state, 'nothing to pick');
  const v = state.values.values.get(id);
  const pair = v === undefined ? undefined : secondCurvePick(state, tool, [{ id, kind: v.kind }]);
  if (pair !== undefined) return build(state, tool, pair, env);
  const o = open.find((x) => fits(v, x.step.pick));
  if (o === undefined)
    return refuse(state, `${first.step.prompt}: pick a ${PICK_WORDS[first.step.pick]}`);
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
      if (pendingPair(ts) !== undefined)
        return refuse(state, 'pick the second point of the line first');
      if (rest === undefined || filledSteps(ts) < steps.length)
        return refuse(state, 'not enough picks to finish');
      return buildPicks(state, tool, ts.picks, ts.slots, env);
    }
    case 'text':
      return textInput(state, tool, input.value, env);
    default:
      return assertNever(input, 'tool input');
  }
}
