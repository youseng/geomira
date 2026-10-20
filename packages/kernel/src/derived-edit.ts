/**
 * Rule edits of derived layers (SPEC §8.2, ADR-0007): create a derived layer, change its
 * rule (transform, source, suffix, exclusions), delete the rule (its managed objects go
 * with it). Each validates the rule, then re-synchronises the managed objects with
 * syncDerived, so on a synced valid document the result is synced and valid (laws L7,
 * L13). Rules may chain; a cycle of rules is rejected.
 */
import { findLayer, findObject, type Document, type Layer, type LayerRule } from './document';
import { applyRemoval, dependents, fail, type EditResult, type Removal } from './edit';
import { ref } from './expr';
import { objectKinds, syncDerived, type Synced } from './derived';
import { addLayer, type LayerOptions } from './layers';
import { isImageSuffix } from './names';
import type { Registry } from './registry';

export interface DerivedLayerSpec {
  readonly name: string;
  /** The id of the object holding the transformation T. */
  readonly transform: number;
  /** The id of the source layer. */
  readonly source: string;
  /** Default "*". */
  readonly suffix?: string;
  readonly exclude?: readonly number[];
  readonly options?: LayerOptions;
}

export interface RulePatch {
  readonly transform?: number;
  readonly source?: string;
  readonly suffix?: string;
  readonly exclude?: readonly number[];
}

/** The suffix of a derived layer when none is given (SPEC §8.2). */
export const DEFAULT_SUFFIX = '*';

/** Merges two removals (object ids in first-seen order, no repeats). */
export function mergeRemovals(a: Removal, b: Removal): Removal {
  const u = <X>(x: readonly X[], y: readonly X[]): X[] => [...new Set([...x, ...y])];
  return {
    objects: u(a.objects, b.objects),
    claims: u(a.claims, b.claims),
    assumptions: u(a.assumptions, b.assumptions),
    clearedRules: u(a.clearedRules, b.clearedRules),
  };
}

export const NO_REMOVAL: Removal = Object.freeze({
  objects: [],
  claims: [],
  assumptions: [],
  clearedRules: [],
});

/**
 * Why `rule` cannot be the rule of layer `layerId`. Degenerate cases: a missing transform
 * object, or one whose kinds include no transformation; a missing source layer, or the
 * layer itself; a suffix that is not one or more `*`; an excluded id that is not an
 * object; a chain of rules that leads back to the layer (a cycle).
 */
export function ruleProblem(
  doc: Document,
  registry: Registry,
  layerId: string,
  rule: LayerRule,
): string | undefined {
  const t = findObject(doc, rule.transform.id);
  if (t === undefined) return `there is no object #${String(rule.transform.id)}`;
  const kinds = objectKinds(doc, registry).get(t.id);
  if (kinds !== undefined && !kinds.includes('transform'))
    return `${t.name} is not a transformation`;
  const source = findLayer(doc, rule.source);
  if (source === undefined) return `there is no layer "${rule.source}"`;
  if (rule.source === layerId) return 'a derived layer cannot image itself';
  if (!isImageSuffix(rule.suffix)) return `the suffix must be one or more *, not "${rule.suffix}"`;
  const missing = rule.exclude.find((id) => findObject(doc, id) === undefined);
  if (missing !== undefined) return `there is no object #${String(missing)} to exclude`;
  const seen = new Set<string>([layerId]);
  for (
    let s: Layer | undefined = source;
    s?.rule !== undefined;
    s = findLayer(doc, s.rule.source)
  ) {
    if (seen.has(s.rule.source)) return `cycle: layer ${s.name} leads back to the derived layer`;
    seen.add(s.id);
  }
  return undefined;
}

/** Sets the rule of `layerId` (or clears it) and re-synchronises. */
function withRule(
  doc: Document,
  registry: Registry,
  layerId: string,
  rule: LayerRule | undefined,
): EditResult<Synced> {
  const layers = doc.layers.map((l): Layer => {
    if (l.id !== layerId) return l;
    const plain: Layer = {
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      order: l.order,
    };
    return rule === undefined ? plain : { ...plain, rule };
  });
  return syncDerived({ ...doc, layers }, registry);
}

/**
 * Creates a layer with the rule image(T, source) and the images of every object of the
 * source layer (placed after the later of the object and T). Degenerate cases: as
 * addLayer (name, opacity) and ruleProblem; an image name already in use → error.
 */
export function addDerivedLayer(
  doc: Document,
  registry: Registry,
  spec: DerivedLayerSpec,
): EditResult<Synced & { readonly layerId: string }> {
  const added = addLayer(doc, spec.name, spec.options);
  if (!added.ok) return added;
  const rule: LayerRule = {
    transform: ref(spec.transform),
    source: spec.source,
    suffix: spec.suffix ?? DEFAULT_SUFFIX,
    exclude: [...new Set(spec.exclude ?? [])],
  };
  const problem = ruleProblem(added.doc, registry, added.layerId, rule);
  if (problem !== undefined) return fail(problem);
  const r = withRule(added.doc, registry, added.layerId, rule);
  return r.ok ? { ...r, layerId: added.layerId } : r;
}

/**
 * Changes a derived layer's rule. Images follow: a new transform redefines every image
 * (the objects keep their ids, so whatever was built from them stays); a new source,
 * exclusion list or suffix removes, adds or renames images (images of images too). Degenerate cases: a layer
 * without a rule, or as ruleProblem; a transform built from the layer's own images (a
 * cycle) → error; an image name already in use → error.
 */
export function updateRule(
  doc: Document,
  registry: Registry,
  layerId: string,
  patch: RulePatch,
): EditResult<Synced> {
  const layer = findLayer(doc, layerId);
  if (layer?.rule === undefined) return fail(`layer "${layerId}" has no rule`);
  const rule: LayerRule = {
    transform: patch.transform === undefined ? layer.rule.transform : ref(patch.transform),
    source: patch.source ?? layer.rule.source,
    suffix: patch.suffix ?? layer.rule.suffix,
    exclude: patch.exclude === undefined ? layer.rule.exclude : [...new Set(patch.exclude)],
  };
  const problem = ruleProblem(doc, registry, layerId, rule);
  if (problem !== undefined) return fail(problem);
  return withRule(doc, registry, layerId, rule);
}

/**
 * Deletes a derived layer's rule (SPEC §8.2: deleting the rule deletes its managed
 * objects, with their dependents, listed in `removed`); the layer stays as a plain layer
 * with the user objects built in it. Degenerate: a layer without a rule → error.
 */
export function removeRule(doc: Document, registry: Registry, layerId: string): EditResult<Synced> {
  const layer = findLayer(doc, layerId);
  if (layer?.rule === undefined) return fail(`layer "${layerId}" has no rule`);
  const removed = dependents(
    doc,
    doc.objects.filter((o) => o.managedBy === layerId).map((o) => o.id),
  );
  const r = withRule(applyRemoval(doc, removed), registry, layerId, undefined);
  return r.ok ? { ...r, removed: mergeRemovals(removed, r.removed) } : r;
}
