/**
 * The result of applyEdit (edit.ts) and its helpers, shared by the edit modules: a success
 * carries the new state and what the edit removed and added; a refusal carries the INPUT
 * state itself and the reason (applyEdit never throws and never half-applies an edit).
 */
import type { Viewport } from '@geomira/kernel/document';
import { NO_REMOVAL } from '@geomira/kernel/derived-edit';
import type { Removal } from '@geomira/kernel/edit';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { MAX_ZOOM, MIN_ZOOM } from '@geomira/scene/viewport';
import type { EditorState } from './state';

export type EditResult =
  | {
      readonly ok: true;
      readonly state: EditorState;
      /** What the edit deleted (a removal's cascade list: dependents, claims, images, rules). */
      readonly removed: Removal;
      /** Images the edit created. */
      readonly added: readonly number[];
      /** The id of a new object, claim, assumption (or of the last one a batch made). */
      readonly id?: number;
      readonly layerId?: string;
    }
  | {
      readonly ok: false;
      /** The input state itself. */
      readonly state: EditorState;
      readonly reason: string;
      /** A replaceText's errors (line, column, hint). */
      readonly diagnostics?: readonly Diagnostic[];
    };

export function refuse(
  state: EditorState,
  reason: string,
  diagnostics?: readonly Diagnostic[],
): EditResult {
  return diagnostics === undefined
    ? { ok: false, state, reason }
    : { ok: false, state, reason, diagnostics };
}

/** A success that removed and added nothing. */
export function done(state: EditorState): EditResult {
  return { ok: true, state, removed: NO_REMOVAL, added: [] };
}

/** A valid viewport: finite centre, zoom within the scene's clamp. */
export function viewportProblem(v: Viewport): string | undefined {
  if (!Number.isFinite(v.cx) || !Number.isFinite(v.cy)) return 'the viewport centre is not finite';
  return Number.isFinite(v.zoom) && v.zoom >= MIN_ZOOM && v.zoom <= MAX_ZOOM
    ? undefined
    : 'the zoom is outside the supported range';
}
