/**
 * applyEdit (SPEC §12): EVERY change of the editor's state is an Edit applied here. It is
 * TOTAL: it never throws, and an edit that cannot apply returns a refusal with the reason
 * and the state unchanged (the very same object). Document edits are the kernel's DocEdits
 * (applyDocEdit: invariants and derived-layer sync kept, law L7, L13), claims and
 * assumptions (packages/claims' checks), the whole text (lang's parseInto: ids kept, styles
 * exactly the text's, ADR-0009 decision 22), the document's @viewport, drags (drag.ts) and
 * batches; each is ONE history entry, a drag gesture included (coalesced). Undo and redo
 * restore documents exactly (law L6). UI edits (selection, hover, viewport, active layer,
 * tool) change no document and are outside history.
 */
import type { Document, Viewport } from '@geomira/kernel/document';
import { findObject } from '@geomira/kernel/document';
import { applyDocEdit, type DocEdit } from '@geomira/kernel/doc-edit';
import type { Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { NO_REMOVAL, mergeRemovals } from '@geomira/kernel/derived-edit';
import type { Removal } from '@geomira/kernel/edit';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { stable } from '@geomira/lang/canonical';
import { parseInto } from '@geomira/lang/parse-into';
import { assertNever } from '@geomira/num/assert';
import {
  addAssumption,
  addClaim,
  removeAssumption,
  removeClaim,
  renameClaim,
  type NewAssumption,
  type NewClaim,
} from './claim-edit';
import { definitionProblem, dependentsProblem, styleProblem } from './checks';
import { dragEdit, type DragEdit } from './drag-edit';
import { record, redo, undo } from './history';
import { textComments } from './comments';
import { lockedChange } from './locked';
import { textOrder } from './order';
import { appendLog } from './log';
import { withDocument, type EditorEnv, type EditorState } from './state';
import { refuse, viewportProblem, type EditResult } from './result';
import { uiEdit, type UiEdit } from './ui-edit';

export type { EditResult } from './result';

/** Edits of the document (each one history entry). */
export type DocumentEdit =
  | DocEdit
  | { readonly kind: 'addClaim'; readonly claim: NewClaim }
  | { readonly kind: 'removeClaim'; readonly id: number }
  | { readonly kind: 'renameClaim'; readonly id: number; readonly name?: string }
  | { readonly kind: 'addAssumption'; readonly assumption: NewAssumption }
  | { readonly kind: 'removeAssumption'; readonly id: number }
  | { readonly kind: 'replaceText'; readonly text: string }
  | { readonly kind: 'docViewport'; readonly viewport: Viewport | null };

export type Edit =
  | DocumentEdit
  | { readonly kind: 'batch'; readonly label: string; readonly edits: readonly DocumentEdit[] }
  | DragEdit
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | UiEdit;

/** One document step: the new document and what it removed and added. */
type Step =
  | {
      readonly ok: true;
      readonly doc: Document;
      readonly removed: Removal;
      readonly added: readonly number[];
      readonly id?: number;
      readonly layerId?: string;
    }
  | { readonly ok: false; readonly error: string; readonly diagnostics?: readonly Diagnostic[] };

function plain(r: { ok: true; doc: Document; id?: number }): Step {
  return r.id === undefined
    ? { ok: true, doc: r.doc, removed: NO_REMOVAL, added: [] }
    : { ok: true, doc: r.doc, removed: NO_REMOVAL, added: [], id: r.id };
}

/**
 * The document of a whole text (lang's parseInto). Degenerate: a text with an error is
 * refused, with its diagnostics (applying the lines that parsed would silently drop the
 * others); a text that gives the same document changes nothing (no history entry).
 */
function replaceText(doc: Document, text: string, env: EditorEnv): Step {
  const r = parseInto(doc, text, env.registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    return { ok: false, error: 'the text has errors; nothing was changed', diagnostics: errors };
  const same = stable(r.doc) === stable(doc);
  return { ok: true, doc: same ? doc : r.doc, removed: NO_REMOVAL, added: [] };
}

/** A kernel DocEdit through applyDocEdit (invariants and derived layers kept). */
function kernelStep(doc: Document, e: DocEdit, env: EditorEnv): Step {
  const r = applyDocEdit(doc, env.registry, e);
  if (!r.ok) return r;
  const extra = {
    ...(r.id === undefined ? {} : { id: r.id }),
    ...(r.layerId === undefined ? {} : { layerId: r.layerId }),
  };
  return { ok: true, doc: r.doc, removed: r.removed, added: r.added, ...extra };
}

/** Why the text format could not hold what `e` writes (checks.ts), or undefined. */
function textProblem(doc: Document, e: DocumentEdit, registry: Registry): string | undefined {
  const defs = (xs: readonly Expr[]) =>
    xs.map((x) => definitionProblem(doc, x, registry)).find((p) => p !== undefined);
  switch (e.kind) {
    case 'add':
      return defs([e.object.def]) ?? styleProblem(e.object.style ?? {});
    case 'redefine':
      return defs([e.def]);
    case 'style':
      return styleProblem(e.style);
    case 'addClaim':
      return defs(e.claim.args);
    case 'addAssumption':
      return defs(e.assumption.args);
    case 'remove':
    case 'rename':
    case 'setLayers':
    case 'move':
    case 'addLayer':
    case 'updateLayer':
    case 'removeLayer':
    case 'addDerivedLayer':
    case 'updateRule':
    case 'removeRule':
    case 'addView':
    case 'applyView':
    case 'removeView':
    case 'renameView':
    case 'removeClaim':
    case 'renameClaim':
    case 'removeAssumption':
    case 'replaceText':
    case 'docViewport':
      // Nothing written that the text could refuse (a whole text goes through the parser).
      return undefined;
    default:
      return assertNever(e, 'document edit');
  }
}

/** The step of one document edit (no state, no history). */
function docStep(doc: Document, e: DocumentEdit, env: EditorEnv): Step {
  const problem = textProblem(doc, e, env.registry);
  if (problem !== undefined) return { ok: false, error: problem };
  switch (e.kind) {
    case 'redefine': {
      const r = kernelStep(doc, e, env);
      const p = r.ok ? dependentsProblem(r.doc, [e.id], env.registry) : undefined;
      return p === undefined ? r : { ok: false, error: p };
    }
    case 'add':
    case 'remove':
    case 'rename':
    case 'style':
    case 'setLayers':
    case 'move':
    case 'addLayer':
    case 'updateLayer':
    case 'removeLayer':
    case 'addDerivedLayer':
    case 'updateRule':
    case 'removeRule':
    case 'addView':
    case 'applyView':
    case 'removeView':
    case 'renameView':
      return kernelStep(doc, e, env);
    case 'addClaim': {
      const r = addClaim(doc, e.claim);
      return r.ok ? plain(r) : r;
    }
    case 'removeClaim': {
      const r = removeClaim(doc, e.id);
      return r.ok ? plain(r) : r;
    }
    case 'renameClaim': {
      const r = renameClaim(doc, e.id, e.name);
      return r.ok ? plain(r) : r;
    }
    case 'addAssumption': {
      const r = addAssumption(doc, e.assumption);
      return r.ok ? plain(r) : r;
    }
    case 'removeAssumption': {
      const r = removeAssumption(doc, e.id);
      return r.ok ? plain(r) : r;
    }
    case 'replaceText':
      return replaceText(doc, e.text, env);
    case 'docViewport': {
      const p = e.viewport === null ? undefined : viewportProblem(e.viewport);
      if (p !== undefined) return { ok: false, error: p };
      return { ok: true, doc: { ...doc, viewport: e.viewport }, removed: NO_REMOVAL, added: [] };
    }
    default:
      return assertNever(e, 'document edit');
  }
}

/** A batch: every edit applies, in order, or none (the first refusal is the batch's). */
function batchStep(doc: Document, edits: readonly DocumentEdit[], env: EditorEnv): Step {
  let cur: Extract<Step, { ok: true }> = { ok: true, doc, removed: NO_REMOVAL, added: [] };
  for (const e of edits) {
    const r = docStep(cur.doc, e, env);
    if (!r.ok) return r;
    const id: number | undefined = r.id ?? cur.id;
    const layerId: string | undefined = r.layerId ?? cur.layerId;
    cur = {
      ok: true,
      doc: r.doc,
      removed: mergeRemovals(cur.removed, r.removed),
      added: [...cur.added.filter((x) => r.doc.objects.some((o) => o.id === x)), ...r.added],
      ...(id === undefined ? {} : { id }),
      ...(layerId === undefined ? {} : { layerId }),
    };
  }
  return cur;
}

/** A short label of an edit for history and the log. */
function labelOf(state: EditorState, e: DocumentEdit | { kind: 'batch'; label: string }): string {
  if (e.kind === 'batch') return e.label;
  const name =
    'id' in e && typeof e.id === 'number' ? findObject(state.doc, e.id)?.name : undefined;
  return name === undefined ? e.kind : `${e.kind} ${name}`;
}

/**
 * A GUI edit's step, refused when it touches a locked layer (ADR-0020). The text
 * (replaceText) is exempt: it is how a locked figure is still edited.
 */
function guarded(doc: Document, step: Step, text: boolean): Step {
  if (!step.ok || text) return step;
  const locked = lockedChange(doc, step.doc);
  return locked === undefined ? step : { ok: false, error: locked };
}

/** Commits a document step, in text form (order.ts, comments.ts), as one history entry. */
function commit(state: EditorState, step: Step, label: string, env: EditorEnv): EditResult {
  if (!step.ok) return refuse(state, step.error, step.diagnostics);
  const doc = textComments(textOrder(step.doc));
  const next = withDocument(state, doc, env);
  const history = record(state.history, label, state.doc, doc);
  const extra = {
    ...(step.id === undefined ? {} : { id: step.id }),
    ...(step.layerId === undefined ? {} : { layerId: step.layerId }),
  };
  return {
    ok: true,
    state: { ...next, history },
    removed: step.removed,
    added: step.added,
    ...extra,
  };
}

function historyStep(state: EditorState, which: 'undo' | 'redo', env: EditorEnv): EditResult {
  const r = which === 'undo' ? undo(state.history) : redo(state.history);
  if (r === undefined) return refuse(state, `nothing to ${which}`);
  const next = withDocument(state, r.doc, env);
  return { ok: true, state: { ...next, history: r.history }, removed: NO_REMOVAL, added: [] };
}

/** Logs an applied edit (the debug report's last edits; log.ts: UI edits leave first). */
function logged(r: EditResult, e: Edit): EditResult {
  if (!r.ok) return r;
  return { ...r, state: { ...r.state, log: appendLog(r.state.log, e) } };
}

/** Applies one edit (see the module comment). Never throws; a refusal leaves the state as it was. */
export function applyEdit(state: EditorState, e: Edit, env: EditorEnv): EditResult {
  return logged(apply(state, e, env), e);
}

const DRAGGING = 'a drag is in progress: finish or cancel it first';

function batch(
  state: EditorState,
  e: Extract<Edit, { kind: 'batch' }>,
  env: EditorEnv,
): EditResult {
  if (state.drag !== null) return refuse(state, DRAGGING);
  const step = guarded(state.doc, batchStep(state.doc, e.edits, env), false);
  return commit(state, step, labelOf(state, e), env);
}

function apply(state: EditorState, e: Edit, env: EditorEnv): EditResult {
  switch (e.kind) {
    case 'select':
    case 'hover':
    case 'viewport':
    case 'activeLayer':
    case 'tool':
    case 'toolValue':
    case 'toolMapOnly':
      return uiEdit(state, e);
    case 'dragStart':
    case 'dragMove':
    case 'dragEnd':
    case 'dragCancel':
      return dragEdit(state, e, env);
    case 'undo':
    case 'redo':
      return state.drag === null ? historyStep(state, e.kind, env) : refuse(state, DRAGGING);
    case 'batch':
      return batch(state, e, env);
    case 'add':
    case 'remove':
    case 'rename':
    case 'redefine':
    case 'style':
    case 'setLayers':
    case 'move':
    case 'addLayer':
    case 'updateLayer':
    case 'removeLayer':
    case 'addDerivedLayer':
    case 'updateRule':
    case 'removeRule':
    case 'addView':
    case 'applyView':
    case 'removeView':
    case 'renameView':
    case 'addClaim':
    case 'removeClaim':
    case 'renameClaim':
    case 'addAssumption':
    case 'removeAssumption':
    case 'replaceText':
    case 'docViewport':
      return state.drag === null
        ? commit(
            state,
            guarded(state.doc, docStep(state.doc, e, env), e.kind === 'replaceText'),
            labelOf(state, e),
            env,
          )
        : refuse(state, DRAGGING);
    default:
      return assertNever(e, 'edit');
  }
}
