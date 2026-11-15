/**
 * Select first, then the tool (ADR-0064): when a tool is chosen while objects are selected,
 * the selection becomes the tool's picks, in the order the objects were selected, as if they
 * had been picked one by one in the Objects panel. So "select A, B, C, press Circumcenter"
 * builds the circumcenter, and "select a point and a circle, press Tangent" both tangents.
 *
 * When the selection does not fit the chosen tool at all (a pick refused, or more objects than
 * its steps), an alternative tool that takes it EXACTLY is used instead (TOOL_ALTERNATIVES:
 * three points pressed with Circle (center, point) build the circle through them); the tool
 * the user chose stays active afterwards. A selection the chosen tool can START with is its
 * own (two points with Circle (3 points) wait for the third).
 *
 * Only a selection made in the Move tool counts: a construction tool selects what it built, and
 * choosing the next tool after it must not take that object as a pick (build O, then choose
 * Incircle and click A, B, C).
 *
 * Degenerate cases: no selection, the Move tool chosen, or another tool active → the tool is
 * chosen as before. A selection
 * no tool takes (a pick refused, more objects than the tool's steps) → the tool is chosen with
 * no picks, the selection stays, and a notice says why; nothing is built. A selection that
 * fills only some steps → those picks are made and the tool waits for the rest (the selection
 * is cleared, the picks show it). A tool with a repeated step (polygon, a claim's list) takes
 * any number of objects from its step count on, and finishes.
 */
import { NO_REMOVAL } from '@geomira/kernel/derived-edit';
import type { EditResult } from './result';
import { applyEdit } from './edit';
import { toolInput } from './machine';
import type { EditorEnv, EditorState } from './state';
import type { ToolId } from './tool-state';
import { stepsOf } from './tool-steps';
import { toolUI } from './tools';

/**
 * Tools whose selection may go to another tool when it fits that one exactly and not this one.
 * Data, so the toolbar's help can say it.
 */
export const TOOL_ALTERNATIVES: Readonly<Partial<Record<ToolId, readonly ToolId[]>>> =
  Object.freeze({
    circle: ['circle3'],
    circle3: ['circle'],
  });

/** How a selection of `n` objects fits a tool: exactly, partly (fewer picks), or not. */
type Fit = 'exact' | 'partial' | 'none';

function fitOf(state: EditorState, tool: ToolId, n: number): Fit {
  const ui = toolUI(tool);
  if (ui === undefined || ui.build.kind === 'none') return 'none';
  const { steps, rest } = stepsOf(ui, state.toolState);
  if (steps.length === 0) return 'none';
  if (rest !== undefined) return n >= steps.length ? 'exact' : 'partial';
  return n === steps.length ? 'exact' : n < steps.length ? 'partial' : 'none';
}

/**
 * The selection given to `tool` as its picks (`chosen`: the tool just chosen, no picks; the
 * count already fits its steps). The result, or the reason a pick was refused.
 */
function feed(
  chosen: EditorState,
  tool: ToolId,
  ids: readonly number[],
  env: EditorEnv,
):
  | { readonly ok: true; readonly result: EditResult }
  | { readonly ok: false; readonly reason: string } {
  let r: EditResult = { ok: true, state: chosen, removed: NO_REMOVAL, added: [] };
  for (const id of ids) {
    r = toolInput(r.state, { kind: 'object', id }, env);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  const ui = toolUI(tool);
  const repeats = ui !== undefined && stepsOf(ui, r.state.toolState).rest !== undefined;
  if (repeats && r.state.toolState.picks.length > 0) {
    const f = toolInput(r.state, { kind: 'finish' }, env);
    if (f.ok) return { ok: true, result: f };
  }
  return { ok: true, result: r };
}

function names(state: EditorState): string {
  return state.selection
    .map((id) => state.doc.objects.find((o) => o.id === id)?.name ?? '?')
    .join(', ');
}

/** The selection's picks for `tool`, or why not (undefined: the selection does not fit it). */
function tryTool(
  state: EditorState,
  tool: ToolId,
  want: Fit,
  env: EditorEnv,
): EditResult | string | undefined {
  const chosen = applyEdit(state, { kind: 'tool', tool }, env);
  if (!chosen.ok) return chosen.reason;
  const fit = fitOf(chosen.state, tool, state.selection.length);
  if (fit === 'none' || (want === 'exact' && fit !== 'exact')) return undefined;
  const r = feed(chosen.state, tool, state.selection, env);
  return r.ok ? r.result : r.reason;
}

/**
 * Chooses `tool` (the UI edit) and gives it the selection as its picks (see the module
 * comment). Never throws; the result's state has `tool` active.
 */
export function chooseTool(state: EditorState, tool: ToolId, env: EditorEnv): EditResult {
  const plain = applyEdit(state, { kind: 'tool', tool }, env);
  if (!plain.ok || tool === 'move' || state.tool !== 'move' || state.selection.length === 0)
    return plain;
  const own = tryTool(state, tool, 'partial', env);
  if (typeof own === 'object' && own.ok) return withToolActive(own, tool, env);
  for (const alt of TOOL_ALTERNATIVES[tool] ?? []) {
    const r = tryTool(state, alt, 'exact', env);
    if (typeof r === 'object' && r.ok && r.state.doc !== state.doc)
      return withToolActive(r, tool, env);
  }
  const label = toolUI(tool)?.label ?? tool;
  const why = typeof own === 'string' ? own : 'it takes a different number of objects';
  return { ...plain, notice: `the selection (${names(state)}) is not ${label}'s input: ${why}` };
}

/**
 * The result with `tool` active: after an alternative built, the chosen tool comes back with
 * no picks; picks waiting for more keep their tool. The selection is cleared when picks wait
 * (the picks show it); a build leaves what the builder selected.
 */
function withToolActive(r: Extract<EditResult, { ok: true }>, tool: ToolId, env: EditorEnv) {
  let state = r.state;
  if (state.tool !== tool) {
    const back = applyEdit(state, { kind: 'tool', tool }, env);
    if (back.ok) state = back.state;
  } else if (state.toolState.picks.length > 0) {
    const cleared = applyEdit(state, { kind: 'select', ids: [], mode: 'replace' }, env);
    if (cleared.ok) state = cleared.state;
  }
  return { ...r, state };
}
