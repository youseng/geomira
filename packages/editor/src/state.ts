/**
 * The editor's state (SPEC §12): { doc, values, selection, hover, tool, toolState, history,
 * viewport }, plus the active layer (where new objects go: "building in" a layer), the drag
 * in progress, and the log of recent edits (the debug report's "last 50 edits"). Immutable
 * plain data; every change goes through applyEdit (edit.ts). The registry is a parameter
 * (SPEC §2: never a singleton), carried in EditorEnv.
 *
 * `values` is the float evaluation of `doc` (the figure as drawn). It is recomputed after
 * every document change, incrementally when the changed objects are known (evaluateFrom,
 * which equals a full evaluate, law L2).
 */
import { evalContextFor } from '@geomira/kernel/context';
import { MAIN_LAYER_ID, type Document, type Viewport } from '@geomira/kernel/document';
import { evaluate, evaluateFrom, type Evaluation } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import { FloatField } from '@geomira/num/float-field';
import { DEFAULT_VIEWPORT } from '@geomira/scene/viewport';
import { EMPTY_HISTORY, type History } from './history';
import { idleTool, type ToolId, type ToolState } from './tool-state';

export interface EditorEnv {
  readonly registry: Registry;
}

/** A drag in progress (edit.ts / drag.ts). */
export interface DragState {
  /** The object under the cursor (a point, glider, image or text). */
  readonly id: number;
  /** The object whose definition the drag rewrites (the source of an image; a text's anchor). */
  readonly base: number;
  /** The document before the drag (dragCancel restores it). */
  readonly before: Document;
  /** Whether a move has happened (then the history's last entry is this drag's). */
  readonly moved: boolean;
}

export interface EditorState {
  readonly doc: Document;
  readonly values: Evaluation<number>;
  /** Selected object ids, in selection order. */
  readonly selection: readonly number[];
  readonly hover: number | null;
  readonly tool: ToolId;
  readonly toolState: ToolState;
  readonly history: History;
  /** The view (outside history; the document's @viewport is changed by the docViewport edit). */
  readonly viewport: Viewport;
  /** The layer new objects are built in. */
  readonly activeLayer: string;
  readonly drag: DragState | null;
  /**
   * Recent edits, oldest first, for the debug report: at most LOG_LENGTH, and when full a UI
   * edit leaves before any document edit (log.ts).
   */
  readonly log: readonly unknown[];
}

/** How many edits the log keeps (SPEC §12: the debug report lists the last 50 edits). */
export const LOG_LENGTH = 50;

/** The float evaluation of a document (every object Undefined, with the reason, without a context). */
export function evaluationOf(doc: Document, env: EditorEnv): Evaluation<number> {
  const c = evalContextFor(doc);
  return evaluate(doc, env.registry, FloatField, c.ok ? c.ctx : { scale: 0 });
}

/**
 * The objects of `next` whose definition is not the very same expression as in `prev`
 * (documents are immutable, so an unchanged definition keeps its identity; a rebuilt but
 * equal one only costs a re-evaluation), or whose name changed: an Undefined reason names
 * the objects it is about ("line(A, B) needs A ≠ B"), so what is built from a renamed
 * object is evaluated again.
 */
function changedDefs(prev: Document, next: Document): number[] {
  const before = new Map(prev.objects.map((o) => [o.id, o]));
  return next.objects
    .filter((o) => before.get(o.id)?.def !== o.def || before.get(o.id)?.name !== o.name)
    .map((o) => o.id);
}

/**
 * The evaluation of `doc` after an edit of `prev`'s document: incremental on the objects
 * whose definitions changed (evaluateFrom falls back to a full run when the figure scale
 * changed, and equals a full evaluate, law L2).
 */
export function reevaluate(
  prev: Evaluation<number>,
  prevDoc: Document,
  doc: Document,
  env: EditorEnv,
): Evaluation<number> {
  const c = evalContextFor(doc);
  return c.ok
    ? evaluateFrom(prev, doc, env.registry, FloatField, c.ctx, changedDefs(prevDoc, doc))
    : evaluationOf(doc, env);
}

/** A new editor on `doc`: its own viewport when it has one, nothing selected, empty history. */
export function createEditor(doc: Document, env: EditorEnv): EditorState {
  return {
    doc,
    values: evaluationOf(doc, env),
    selection: [],
    hover: null,
    tool: 'move',
    toolState: idleTool(),
    history: EMPTY_HISTORY,
    viewport: doc.viewport ?? DEFAULT_VIEWPORT,
    activeLayer: MAIN_LAYER_ID,
    drag: null,
    log: [],
  };
}

/**
 * The tool's picks when every object they name still exists; else the
 * idle tool (Run 10 audit: picks survived the undo of the point they named, so the next click
 * was refused, or bound to another object that later took the freed id).
 */
function prunedTool(t: ToolState, ids: ReadonlySet<number>): ToolState {
  return t.picks.every((id) => ids.has(id)) ? t : idleTool(t.claimKind, t.value);
}

/**
 * The state with a new document: values re-evaluated, the selection, hover, active layer and
 * the tool's picks pruned to what still exists (an object or layer an edit removed is not
 * selected, hovered, active or picked any more).
 */
export function withDocument(s: EditorState, doc: Document, env: EditorEnv): EditorState {
  if (doc === s.doc) return s;
  const ids = new Set(doc.objects.map((o) => o.id));
  return {
    ...s,
    toolState: prunedTool(s.toolState, ids),
    doc,
    values: reevaluate(s.values, s.doc, doc, env),
    selection: s.selection.filter((id) => ids.has(id)),
    hover: s.hover !== null && ids.has(s.hover) ? s.hover : null,
    activeLayer: doc.layers.some((l) => l.id === s.activeLayer) ? s.activeLayer : MAIN_LAYER_ID,
  };
}
