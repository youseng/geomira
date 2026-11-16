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
import { filledSteps, pendingPair, stepsOf } from './tool-steps';
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

/** Fit is determined by the same sequential consumption as ordinary panel picks. */
type Fit = 'exact' | 'partial';
type Fed = { readonly result: Extract<EditResult, { ok: true }>; readonly fit: Fit };

/** Run tentatively: refusing any pick discards all tentative edits/history. */
function feed(chosen: EditorState, ids: readonly number[], env: EditorEnv): Fed | string {
  const ui = toolUI(chosen.tool);
  if (ui === undefined || ui.build.kind === 'none') return 'it takes a different number of objects';
  let r: Extract<EditResult, { ok: true }> = {
    ok: true,
    state: chosen,
    removed: NO_REMOVAL,
    added: [],
  };
  let complete = false;
  for (const id of ids) {
    if (complete) return 'it takes a different number of objects';
    const next = toolInput(r.state, { kind: 'object', id }, env);
    if (!next.ok) return next.reason;
    r = next;
    // Successful fixed-input builds reset their picks, including equivalent-object reuse.
    complete = r.state.toolState.picks.length === 0;
  }
  const ts = r.state.toolState;
  const { steps, rest } = stepsOf(ui, ts);
  if (rest !== undefined && filledSteps(ts) >= steps.length && pendingPair(ts) === undefined) {
    const finished = toolInput(r.state, { kind: 'finish' }, env);
    return {
      result: finished.ok ? finished : { ...r, notice: finished.reason },
      fit: 'exact',
    };
  }
  return { result: r, fit: complete ? 'exact' : 'partial' };
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
  const r = feed(chosen.state, state.selection, env);
  if (typeof r === 'string') return r;
  if (want === 'exact' && r.fit !== 'exact') return undefined;
  return r.result;
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
