/**
 * Derived layers (SPEC §8.2, ADR-0007): which objects a rule images, and `syncDerived`,
 * which makes a document's managed objects match its rules exactly. A rule
 * { transform: T, source, suffix, exclude } maintains X<suffix> = apply(T, X) for every
 * object X of the source layer, except objects in `exclude`, objects styled [noimage],
 * and objects whose kinds are all non-geometric (numbers, measures, transforms: they have
 * no image, ADR-0007). There is no closure-based exclusion: T's own defining points are
 * imaged, and an image may be Undefined. Rules chain (the source may be a derived layer);
 * cycles of rules are rejected by the rule edits (derived-edit.ts) and by I4.
 *
 * Kinds are static (the registry's signatures and outputKinds, as ADR-0006 item 14), so
 * imaging never depends on evaluation: a definition with an unknown tool, or with
 * arguments no overload takes, is imaged (its image is Undefined, like the object).
 */
import { assertNever } from '@geomira/num/assert';
import { findLayer, type DocObject, type Document, type Layer, type LayerRule } from './document';
import { applyRemoval, dependents, fail, type EditResult, type Removal } from './edit';
import { call, ref, exprEquals, type Expr } from './expr';
import { stableTopologicalOrder } from './graph';
import type { Registry } from './registry';
import type { Signature } from './tool';
import { capabilityKinds, type ValueKind } from './value';

/**
 * The kinds a map takes to the same kind: figures and, since ADR-0011, the display values
 * that have a position (marks and text). Everything else has no image.
 */
const IMAGED_KINDS: readonly ValueKind[] = [
  'point',
  'line',
  'circle',
  'polygon',
  'angle_mark',
  'segment_mark',
  'text',
];

export type KindTable = ReadonlyMap<number, readonly ValueKind[] | undefined>;

/** Whether a signature takes `n` arguments whose static kinds may fit its capabilities. */
function fits(s: Signature, args: readonly (readonly ValueKind[] | undefined)[]): boolean {
  if (args.length < s.params.length || (args.length > s.params.length && s.rest === undefined))
    return false;
  return args.every((k, i) => {
    const cap = s.params[i] ?? s.rest;
    return (
      cap !== undefined && (k === undefined || k.some((x) => capabilityKinds(cap).includes(x)))
    );
  });
}

/**
 * The kinds an expression can have (undefined: unknown), narrowed to the overloads its
 * arguments can match (Signature.output): reflect(l) is a transform, reflect(A, l) a point.
 * An unknown tool, or arguments no overload can take, → unknown.
 */
export function exprKinds(
  e: Expr,
  kinds: KindTable,
  registry: Registry,
): readonly ValueKind[] | undefined {
  switch (e.kind) {
    case 'lit':
      return ['number'];
    case 'str':
      return ['string'];
    case 'ref':
      return kinds.get(e.id);
    case 'call': {
      const tool = registry.get(e.tool);
      const args = e.args.map((a) => exprKinds(a, kinds, registry));
      const sigs = tool?.signatures.filter((s) => fits(s, args)) ?? [];
      if (tool === undefined || sigs.length === 0) return undefined;
      return [...new Set(sigs.flatMap((s) => s.output ?? tool.outputKinds))];
    }
    default:
      return assertNever(e, 'expression');
  }
}

/** The static kinds of every object, in construction order (undefined: unknown). */
export function objectKinds(doc: Document, registry: Registry): KindTable {
  const out = new Map<number, readonly ValueKind[] | undefined>();
  for (const o of doc.objects) out.set(o.id, exprKinds(o.def, out, registry));
  return out;
}

/** Whether objects of these kinds get images: unknown kinds do, non-geometric ones do not. */
export function hasImage(kinds: readonly ValueKind[] | undefined): boolean {
  return kinds === undefined || kinds.some((k) => IMAGED_KINDS.includes(k));
}

/** The definition of the image of X under the rule: apply(T, X). */
export function imageDef(rule: LayerRule, source: number): Expr {
  return call('apply', [ref(rule.transform.id), ref(source)]);
}

/** The source object id of a managed object (the X of apply(T, X)), if its def has one. */
export function sourceOf(o: DocObject): number | undefined {
  const x = o.def.kind === 'call' ? o.def.args[1] : undefined;
  return x?.kind === 'ref' ? x.id : undefined;
}

/** Whether `rule` images object `o` (given the static kinds of the document). */
export function imagedBy(rule: LayerRule, o: DocObject, kinds: KindTable): boolean {
  return (
    o.layers.includes(rule.source) &&
    !rule.exclude.includes(o.id) &&
    o.style.noimage !== true &&
    hasImage(kinds.get(o.id))
  );
}

/** The layers that have a rule whose transform object exists. */
function ruleLayers(doc: Document): (Layer & { readonly rule: LayerRule })[] {
  const ids = new Set(doc.objects.map((o) => o.id));
  return doc.layers.flatMap((l) =>
    l.rule !== undefined && ids.has(l.rule.transform.id) ? [{ ...l, rule: l.rule }] : [],
  );
}

/**
 * Why the managed object `o` should not exist, or undefined when its rule wants it (its
 * name and definition may still need repair).
 */
function staleReason(doc: Document, o: DocObject, kinds: KindTable): string | undefined {
  const layer = o.managedBy === undefined ? undefined : findLayer(doc, o.managedBy);
  if (layer?.rule === undefined) return 'its layer has no rule';
  const id = sourceOf(o);
  const source = doc.objects.find((x) => x.id === id);
  if (source === undefined) return 'its source is gone';
  return imagedBy(layer.rule, source, kinds) ? undefined : 'its source is not imaged';
}

/**
 * Every mismatch between the managed objects and the rules (law L13: empty after every
 * edit made through derived-edit.ts): a missing image, an image that should not exist,
 * an image with the wrong name or definition, or two images of one object in one layer.
 */
export function syncProblems(doc: Document, registry: Registry): string[] {
  const kinds = objectKinds(doc, registry);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of doc.objects) {
    if (o.managedBy === undefined) continue;
    const why = staleReason(doc, o, kinds);
    if (why !== undefined) out.push(`${o.name} should not exist: ${why}`);
    seen.add(`${o.managedBy}/${String(sourceOf(o))}`);
  }
  for (const l of ruleLayers(doc)) {
    for (const x of doc.objects) {
      if (!imagedBy(l.rule, x, kinds) || seen.has(`${l.id}/${String(x.id)}`)) continue;
      out.push(`${x.name} has no image in layer ${l.name}`);
    }
  }
  for (const o of doc.objects) {
    const layer = o.managedBy === undefined ? undefined : findLayer(doc, o.managedBy);
    const src = doc.objects.find((x) => x.id === sourceOf(o));
    if (layer?.rule === undefined || src === undefined) continue;
    if (o.name !== src.name + layer.rule.suffix) out.push(`${o.name} has the wrong name`);
    if (!exprEquals(o.def, imageDef(layer.rule, src.id)))
      out.push(`${o.name} has the wrong definition`);
  }
  return out;
}

export interface Synced {
  /** Ids of the images created, in construction order of creation. */
  readonly added: readonly number[];
  /** Images that had to go (with their dependents). */
  readonly removed: Removal;
}

/** Removes stale and duplicate images (with dependents); repairs names and definitions. */
function prune(doc: Document, registry: Registry): { doc: Document; removed: Removal } {
  const kinds = objectKinds(doc, registry);
  const seen = new Set<string>();
  const stale: number[] = [];
  for (const o of doc.objects) {
    if (o.managedBy === undefined) continue;
    const key = `${o.managedBy}/${String(sourceOf(o))}`;
    if (staleReason(doc, o, kinds) !== undefined || seen.has(key)) stale.push(o.id);
    seen.add(key);
  }
  const removed = dependents(doc, stale);
  const pruned = applyRemoval(doc, removed);
  // In construction order, so an image of an image sees its source's repaired name.
  const names = new Map(pruned.objects.map((o) => [o.id, o.name]));
  const objects = pruned.objects.map((o) => {
    const layer = o.managedBy === undefined ? undefined : findLayer(pruned, o.managedBy);
    const src = sourceOf(o);
    const srcName = src === undefined ? undefined : names.get(src);
    if (layer?.rule === undefined || src === undefined || srcName === undefined) return o;
    const name = srcName + layer.rule.suffix;
    names.set(o.id, name);
    return { ...o, name, def: imageDef(layer.rule, src) };
  });
  return { doc: { ...pruned, objects }, removed };
}

/** Inserts `img` after the later of its source and transform (and earlier new images). */
function place(
  objects: DocObject[],
  img: DocObject,
  x: number,
  t: number,
  fresh: Set<number>,
): void {
  const after = Math.max(...[x, t].map((id) => objects.findIndex((o) => o.id === id)));
  let at = after + 1;
  while (at < objects.length && fresh.has(objects[at]?.id ?? -1)) at += 1;
  objects.splice(at, 0, img);
  fresh.add(img.id);
}

/**
 * Sources a rule leaves unimaged in one sync: `held(layerId, x)` true → layer layerId does not
 * image x in this call. The language passes its exclusion lists BY NAME, so an excluded image
 * that the same call creates (an image of an object defined later in the text) is not imaged
 * before its name resolves to an id.
 */
export type Held = (layerId: string, source: DocObject) => boolean;

/** One pass over the rules: the images that are missing now (chains need another pass). */
function addMissing(
  doc: Document,
  registry: Registry,
  fresh: Set<number>,
  held: Held | undefined,
): EditResult<{ readonly n: number }> {
  const kinds = objectKinds(doc, registry);
  const objects = [...doc.objects];
  const names = new Set(objects.map((o) => o.name));
  let nextId = doc.nextId;
  for (const l of ruleLayers(doc)) {
    const have = new Set(doc.objects.filter((o) => o.managedBy === l.id).map(sourceOf));
    for (const x of doc.objects) {
      if (!imagedBy(l.rule, x, kinds) || have.has(x.id) || held?.(l.id, x) === true) continue;
      const name = x.name + l.rule.suffix;
      if (names.has(name)) {
        return fail(`the image name ${name} of ${x.name} in layer ${l.name} is already used`);
      }
      names.add(name);
      const img: DocObject = {
        id: nextId,
        name,
        def: imageDef(l.rule, x.id),
        style: {},
        layers: [l.id],
        managedBy: l.id,
      };
      nextId += 1;
      place(objects, img, x.id, l.rule.transform.id, fresh);
    }
  }
  return { ok: true, doc: { ...doc, objects, nextId }, n: nextId - doc.nextId };
}

/** A name used twice (a repaired image name that collides), if any. */
function duplicateName(objects: readonly DocObject[]): string | undefined {
  const seen = new Set<string>();
  for (const o of objects) {
    if (seen.has(o.name)) return o.name;
    seen.add(o.name);
  }
  return undefined;
}

/**
 * Makes the managed objects match the rules exactly: stale images go (with their
 * dependents, listed in `removed`), names and definitions are repaired, and every missing
 * image is created right after the later of its source and its transform (so "adding an
 * object to the source appends its image"), chains included. Degenerate cases: an image
 * name already used by another object → error; a dependency cycle (a rule's transform
 * built from its own images) → error. A synced document is returned unchanged. With `held`,
 * the held sources are not imaged (their existing images stay; see Held).
 */
export function syncDerived(doc: Document, registry: Registry, held?: Held): EditResult<Synced> {
  const { doc: pruned, removed } = prune(doc, registry);
  const fresh = new Set<number>();
  let cur = pruned;
  for (let pass = 0; pass <= cur.layers.length; pass += 1) {
    const r = addMissing(cur, registry, fresh, held);
    if (!r.ok) return r;
    cur = r.doc;
    if (r.n === 0) {
      const ordered = stableTopologicalOrder(cur.objects);
      if (ordered === undefined) return fail('cycle: a transformation depends on its own images');
      const clash = duplicateName(ordered);
      if (clash !== undefined) return fail(`the image name ${clash} is already used`);
      return { ok: true, doc: { ...cur, objects: ordered }, added: [...fresh], removed };
    }
  }
  return fail('cycle: the derived layers image each other without end');
}
