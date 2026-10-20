/**
 * Document edits as data (DocEdit) and `applyDocEdit`, which applies one and keeps the
 * derived layers in sync (SPEC §8.2, ADR-0007): every edit goes through the immutable
 * helpers (edit.ts, layers.ts, derived-edit.ts, views.ts) and then syncDerived, so on a
 * valid synced document every successful edit gives a valid synced document (laws L7 and
 * L13; the editor's applyEdit adds history and selection on top). Added here:
 *   - reserved names: a user object named like a managed image is refused with "C* is the
 *     image of C in layer ref";
 *   - managed objects are maintained by their rule: they cannot be removed, renamed,
 *     redefined, moved or put in other layers directly (exclude the source instead);
 *   - a rule's transformation cannot be redefined as something that is not one;
 *   - `move`: an object moves to another place in the construction order (its
 *     dependencies and dependents keep I2: the stable topological order re-validates it).
 */
import { assertNever } from '@geomira/num/assert';
import { findLayer, findObject, type Document, type Style, type View } from './document';
import {
  addObject,
  fail,
  redefineObject,
  removeCascade,
  renameObject,
  setObjectLayers,
  setStyle,
  type EditResult,
  type NewObject,
  type Removal,
} from './edit';
import type { Expr } from './expr';
import { stableTopologicalOrder } from './graph';
import { exprKinds, objectKinds, sourceOf, syncDerived } from './derived';
import {
  NO_REMOVAL,
  addDerivedLayer,
  mergeRemovals,
  removeRule,
  updateRule,
  type DerivedLayerSpec,
  type RulePatch,
} from './derived-edit';
import { addLayer, removeLayer, updateLayer, type LayerOptions } from './layers';
import type { Registry } from './registry';
import { addView, applyView, removeView } from './views';

export type DocEdit =
  | { readonly kind: 'add'; readonly object: NewObject }
  | { readonly kind: 'remove'; readonly id: number }
  | { readonly kind: 'rename'; readonly id: number; readonly name: string }
  | { readonly kind: 'redefine'; readonly id: number; readonly def: Expr }
  | { readonly kind: 'style'; readonly id: number; readonly style: Style }
  | { readonly kind: 'setLayers'; readonly id: number; readonly layers: readonly string[] }
  | { readonly kind: 'move'; readonly id: number; readonly index: number }
  | { readonly kind: 'addLayer'; readonly name: string; readonly options?: LayerOptions }
  | {
      readonly kind: 'updateLayer';
      readonly id: string;
      readonly patch: LayerOptions & { readonly name?: string };
    }
  | { readonly kind: 'removeLayer'; readonly id: string }
  | { readonly kind: 'addDerivedLayer'; readonly spec: DerivedLayerSpec }
  | { readonly kind: 'updateRule'; readonly layerId: string; readonly patch: RulePatch }
  | { readonly kind: 'removeRule'; readonly layerId: string }
  | { readonly kind: 'addView'; readonly view: View }
  | { readonly kind: 'applyView'; readonly name: string }
  | { readonly kind: 'removeView'; readonly name: string };

export interface Applied {
  /** What the edit deleted: dependents, and images that no longer belong to their rule. */
  readonly removed: Removal;
  /** Images created by the edit (new sources, new rules, objects moved into a source). */
  readonly added: readonly number[];
  /** The id of a new object or layer, when the edit made one. */
  readonly id?: number;
  readonly layerId?: string;
}

/** "A* is the image of A in layer inv" when `name` is a managed object's name. */
export function reservedName(doc: Document, name: string): string | undefined {
  const img = doc.objects.find((o) => o.name === name && o.managedBy !== undefined);
  if (img?.managedBy === undefined) return undefined;
  const src = findObject(doc, sourceOf(img) ?? -1)?.name ?? '?';
  const layer = findLayer(doc, img.managedBy)?.name ?? img.managedBy;
  return `${name} is the image of ${src} in layer ${layer}`;
}

/** Refuses edits of a managed object (it is maintained by its rule). */
function managed(doc: Document, id: number): string | undefined {
  const o = findObject(doc, id);
  if (o?.managedBy === undefined) return undefined;
  const src = findObject(doc, sourceOf(o) ?? -1)?.name ?? '?';
  return `${reservedName(doc, o.name) ?? o.name}: it follows ${src}; exclude ${src} from the layer or style it [noimage] instead`;
}

/** A rule's transformation must stay one. */
function transformProblem(
  doc: Document,
  registry: Registry,
  id: number,
  def: Expr,
): string | undefined {
  const layer = doc.layers.find((l) => l.rule?.transform.id === id);
  if (layer === undefined) return undefined;
  const kinds = objectKinds(doc, registry);
  const k = exprKinds(def, kinds, registry);
  return k === undefined || k.includes('transform')
    ? undefined
    : `${findObject(doc, id)?.name ?? '?'} is the transformation of layer ${layer.name}`;
}

/**
 * Moves an object to position `index` of the construction order; the stable topological
 * order then keeps I2 (an object cannot move before what it is built from, and what is
 * built from it moves after it). Degenerate: an index outside the list → error.
 */
export function moveObject(doc: Document, id: number, index: number): EditResult {
  const from = doc.objects.findIndex((o) => o.id === id);
  const o = doc.objects[from];
  if (o === undefined) return fail(`there is no object #${String(id)}`);
  if (!Number.isSafeInteger(index) || index < 0 || index >= doc.objects.length)
    return fail(`index ${String(index)} is outside the construction order`);
  const rest = doc.objects.filter((x) => x.id !== id);
  rest.splice(index, 0, o);
  const ordered = stableTopologicalOrder(rest);
  return ordered === undefined
    ? fail(`cycle: ${o.name} cannot be moved`)
    : { ok: true, doc: { ...doc, objects: ordered } };
}

type Step = EditResult<{
  readonly removed?: Removal;
  readonly id?: number;
  readonly layerId?: string;
  readonly added?: readonly number[];
}>;

/** The helper call of an edit, before synchronisation (guards included). */
function step(doc: Document, registry: Registry, e: DocEdit): Step {
  switch (e.kind) {
    case 'add': {
      const r = reservedName(doc, e.object.name);
      return r === undefined ? addObject(doc, e.object) : fail(r);
    }
    case 'remove':
      return guard(managed(doc, e.id)) ?? removeCascade(doc, e.id);
    case 'rename':
      return (
        guard(managed(doc, e.id) ?? reservedName(doc, e.name)) ?? renameObject(doc, e.id, e.name)
      );
    case 'redefine':
      return (
        guard(managed(doc, e.id) ?? transformProblem(doc, registry, e.id, e.def)) ??
        redefineObject(doc, e.id, e.def)
      );
    case 'style':
      return setStyle(doc, e.id, e.style);
    case 'setLayers':
      return guard(managed(doc, e.id)) ?? setObjectLayers(doc, e.id, e.layers);
    case 'move':
      return guard(managed(doc, e.id)) ?? moveObject(doc, e.id, e.index);
    case 'addLayer':
      return addLayer(doc, e.name, e.options);
    case 'updateLayer':
      return updateLayer(doc, e.id, e.patch);
    case 'removeLayer':
      return removeLayer(doc, e.id);
    case 'addDerivedLayer':
      return addDerivedLayer(doc, registry, e.spec);
    case 'updateRule':
      return updateRule(doc, registry, e.layerId, e.patch);
    case 'removeRule':
      return removeRule(doc, registry, e.layerId);
    case 'addView':
      return addView(doc, e.view);
    case 'applyView':
      return applyView(doc, e.name);
    case 'removeView':
      return removeView(doc, e.name);
    default:
      return assertNever(e, 'document edit');
  }
}

function guard(
  problem: string | undefined,
): { readonly ok: false; readonly error: string } | undefined {
  return problem === undefined ? undefined : fail(problem);
}

/**
 * Applies one edit and re-synchronises the derived layers. Degenerate cases: every
 * refusal of the helpers (bad names, cycles, missing objects or layers, …), the guards
 * above, and syncDerived's (an image name already used) → an error, never a partial
 * document. The input is never mutated.
 */
export function applyDocEdit(
  doc: Document,
  registry: Registry,
  edit: DocEdit,
): EditResult<Applied> {
  const r = step(doc, registry, edit);
  if (!r.ok) return r;
  const s = syncDerived(r.doc, registry);
  if (!s.ok) return s;
  const added = [...(r.added ?? []), ...s.added];
  const removed = mergeRemovals(r.removed ?? NO_REMOVAL, s.removed);
  return {
    ok: true,
    doc: s.doc,
    removed,
    added,
    ...(r.id === undefined ? {} : { id: r.id }),
    ...(r.layerId === undefined ? {} : { layerId: r.layerId }),
  };
}
