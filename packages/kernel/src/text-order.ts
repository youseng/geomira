/**
 * The text order of a document's images (internal; ADR-0007 decision 10, ADR-0028). The text
 * format does not record where an image sits: parsing places each image right after the
 * later of its source and its transformation. Edits can leave an image later than that (a
 * `move` of the transformation before its sources, a redefinition that reorders), and such a
 * document would not come back from its own text (law P1). syncDerived therefore keeps every
 * document in text order: user objects keep their order, and each image moves to right after
 * the later of its source and its transformation, after the other images placed there, in
 * their present order (so an edit's placement within a run of images is kept). Images
 * only move EARLIER on a document that satisfies I2, so every reference still points to an
 * earlier object and nothing is evaluated differently. The editor's textOrder (order.ts)
 * gives the same order.
 */
import type { DocObject, Document } from './document';

/** The source id of an image apply(T, X) (derived.ts sourceOf, without its import cycle). */
function sourceId(o: DocObject): number | undefined {
  const x = o.def.kind === 'call' ? o.def.args[1] : undefined;
  return x?.kind === 'ref' ? x.id : undefined;
}

/**
 * The objects in text order (the same array when already so). Degenerate: an image whose
 * layer has no rule, or whose source or transformation is not in the list (not a synced
 * document), keeps its relative order at the end, after every other object.
 */
export function textOrder(doc: Document): readonly DocObject[] {
  const transformOf = new Map<string, number>();
  for (const l of doc.layers) if (l.rule !== undefined) transformOf.set(l.id, l.rule.transform.id);
  const index = new Map(doc.objects.map((o, i) => [o.id, i]));
  const placed = new Set<number>();
  const out: DocObject[] = [];
  const waiting = new Map<number, DocObject[]>();
  let ready: DocObject[] = [];
  // An image waits on the first of its source and transformation not yet placed.
  const offer = (img: DocObject): void => {
    const src = sourceId(img);
    const t = transformOf.get(img.managedBy ?? '');
    if (src === undefined || t === undefined) return;
    const blocker = [src, t].find((d) => !placed.has(d));
    if (blocker === undefined) ready.push(img);
    else waiting.set(blocker, [...(waiting.get(blocker) ?? []), img]);
  };
  const put = (o: DocObject): void => {
    out.push(o);
    placed.add(o.id);
    const next = waiting.get(o.id) ?? [];
    waiting.delete(o.id);
    for (const img of next) offer(img);
  };
  for (const o of doc.objects) if (o.managedBy !== undefined) offer(o);
  for (const o of doc.objects) {
    if (o.managedBy !== undefined) continue;
    put(o);
    // The ready images follow, in their present order (chains included).
    while (ready.length > 0) {
      const [first, ...rest] = [...ready].sort(
        (a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0),
      );
      ready = rest;
      if (first !== undefined) put(first);
    }
  }
  // Images that never became ready (not a synced document) keep their order at the end.
  out.push(...doc.objects.filter((o) => !placed.has(o.id)));
  return out.every((o, i) => o === doc.objects[i]) ? doc.objects : out;
}
