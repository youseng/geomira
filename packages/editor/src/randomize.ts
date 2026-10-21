/**
 * Randomize as ONE edit (Run 9b, ADR-0016): packages/claims' randomFigure draws the new
 * figure (the GLOBAL sampler with the triangle type as a hypothesis); this module turns it
 * into a batch of `redefine` edits of the free inputs it changed, so applyEdit records one
 * history entry and undo returns the previous figure exactly (law L6). Degenerate: a drag in
 * progress, or a figure randomFigure refuses (no free input, no triangle for a typed choice,
 * no accepted sample) → the refusal with its reason; the state is never changed here.
 */
import { randomFigure, type TriangleType } from '@geomira/claims/randomize';
import type { Seed } from '@geomira/num/rng';
import type { Edit } from './edit';
import type { EditorEnv, EditorState } from './state';

export type RandomizeEdit =
  | {
      readonly kind: 'edit';
      readonly edit: Edit;
      /** The names of the triangle's vertices (empty for `any`). */
      readonly triangle: readonly string[];
    }
  | { readonly kind: 'refused'; readonly reason: string };

/** The edit that draws a new figure of `state`'s document (see the module comment). */
export function randomizeEdit(
  state: EditorState,
  env: EditorEnv,
  type: TriangleType,
  seed: Seed,
): RandomizeEdit {
  if (state.drag !== null)
    return { kind: 'refused', reason: 'a drag is in progress: finish or cancel it first' };
  const r = randomFigure(state.doc, env.registry, type, seed);
  if (r.kind === 'refused') return r;
  const byId = new Map(r.doc.objects.map((o) => [o.id, o]));
  const edits = r.changed.flatMap((id) => {
    const o = byId.get(id);
    return o === undefined ? [] : [{ kind: 'redefine' as const, id, def: o.def }];
  });
  return { kind: 'edit', edit: { kind: 'batch', label: 'randomize', edits }, triangle: r.triangle };
}
