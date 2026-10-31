/**
 * UI edits (SPEC §12: outside history): the selection, the hovered object, the viewport,
 * the active layer (where new objects are built), and the active tool. None changes the
 * document. Each refers only to what exists: unknown ids and layers are refused.
 */
import type { Viewport } from '@geomira/kernel/document';
import { assertNever } from '@geomira/num/assert';
import type { EditorState } from './state';
import { idleTool, type ToolId } from './tool-state';
import { TOOLS, toolUI } from './tools';
import { toolValue, typedKey } from './tool-steps';
import { done as ok, refuse, viewportProblem, type EditResult } from './result';

export type UiEdit =
  /** replace: the selection becomes `ids`; add: appended; toggle: each id in or out. */
  | {
      readonly kind: 'select';
      readonly ids: readonly number[];
      readonly mode: 'replace' | 'add' | 'toggle';
    }
  | { readonly kind: 'hover'; readonly id: number | null }
  | { readonly kind: 'viewport'; readonly viewport: Viewport }
  | { readonly kind: 'activeLayer'; readonly id: string }
  /**
   * Switches tools; the claim tool takes a claim kind. The new tool starts with no picks and,
   * when it asks for a number, the number last typed for it (else its initial text).
   */
  | { readonly kind: 'tool'; readonly tool: ToolId; readonly claimKind?: string }
  /** The text of the active tool's number (rotate's angle, …); its picks stay. */
  | { readonly kind: 'toolValue'; readonly value: string }
  /**
   * A map tool builds the map alone (`f = reflect(l)`) or an object's image (ToolUI.map,
   * ToolState.mapOnly). The picks are cleared: the steps change.
   */
  | { readonly kind: 'toolMapOnly'; readonly on: boolean };

function selection(state: EditorState, ids: readonly number[], mode: 'replace' | 'add' | 'toggle') {
  const missing = ids.find((id) => !state.doc.objects.some((o) => o.id === id));
  if (missing !== undefined) return refuse(state, `there is no object #${String(missing)}`);
  const unique = [...new Set(ids)];
  switch (mode) {
    case 'replace':
      return ok({ ...state, selection: unique });
    case 'add':
      return ok({
        ...state,
        selection: [...state.selection, ...unique.filter((id) => !state.selection.includes(id))],
      });
    case 'toggle': {
      const kept = state.selection.filter((id) => !unique.includes(id));
      const added = unique.filter((id) => !state.selection.includes(id));
      return ok({ ...state, selection: [...kept, ...added] });
    }
    default:
      return assertNever(mode, 'selection mode');
  }
}

export function uiEdit(state: EditorState, e: UiEdit): EditResult {
  switch (e.kind) {
    case 'select':
      return selection(state, e.ids, e.mode);
    case 'hover':
      if (e.id !== null && !state.doc.objects.some((o) => o.id === e.id))
        return refuse(state, `there is no object #${String(e.id)}`);
      return ok({ ...state, hover: e.id });
    case 'viewport': {
      const p = viewportProblem(e.viewport);
      return p === undefined ? ok({ ...state, viewport: e.viewport }) : refuse(state, p);
    }
    case 'activeLayer':
      return state.doc.layers.some((l) => l.id === e.id)
        ? ok({ ...state, activeLayer: e.id })
        : refuse(state, `there is no layer "${e.id}"`);
    case 'tool': {
      if (!TOOLS.some((t) => t.id === e.tool)) return refuse(state, `there is no tool "${e.tool}"`);
      const kind = e.claimKind ?? state.toolState.claimKind;
      const typed = state.toolState.typed;
      const tool = toolUI(e.tool);
      const next = idleTool(kind, '', typed);
      const asks = tool === undefined ? undefined : toolValue(tool, next);
      const key = tool === undefined ? e.tool : typedKey(tool, next);
      const value = typed[key] ?? asks?.initial ?? '';
      // Building maps alone stays chosen while the user switches between map tools.
      const mapOnly = state.toolState.mapOnly === true && toolUI(e.tool)?.map === true;
      return ok({ ...state, tool: e.tool, toolState: idleTool(kind, value, typed, mapOnly) });
    }
    case 'toolValue': {
      const tool = toolUI(state.tool);
      if (tool === undefined || toolValue(tool, state.toolState) === undefined)
        return refuse(state, 'the active tool takes no number');
      const typed = { ...state.toolState.typed, [typedKey(tool, state.toolState)]: e.value };
      return ok({ ...state, toolState: { ...state.toolState, value: e.value, typed } });
    }
    case 'toolMapOnly': {
      if (toolUI(state.tool)?.map !== true)
        return refuse(state, 'the active tool does not build a transformation');
      const t = state.toolState;
      return ok({ ...state, toolState: idleTool(t.claimKind, t.value, t.typed, e.on) });
    }
    default:
      return assertNever(e, 'UI edit');
  }
}
