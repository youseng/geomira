/**
 * The text order of a document (law L5): the text does not record where an image sits, so
 * parsing places every image right after the later of its source and its transformation
 * (ADR-0007 decision 10, ADR-0009 decision 20). Edits can leave an image later than that
 * (a `move`, or a redefinition that reorders, puts a user object between an image and the
 * point where it would be made), and such a document would not come back from its own text.
 * The editor keeps every document in text order: user objects keep their order, and each
 * image moves to right after the later of its source and its transformation. Images only
 * move EARLIER (I4 has them after both already), so every reference still points to an
 * earlier object (I2) and nothing is evaluated differently.
 */
import type { DocObject, Document } from '@geomira/kernel/document';
import { sourceOf } from '@geomira/kernel/derived';

/** The document with its objects in text order (the same document when already so). */
export function textOrder(doc: Document): Document {
  const transformOf = new Map(
    doc.layers.flatMap((l) => (l.rule === undefined ? [] : [[l.id, l.rule.transform.id] as const])),
  );
  const waiting = doc.objects.filter((o) => o.managedBy !== undefined);
  const placed = new Set<number>();
  const out: DocObject[] = [];
  const ready = (img: DocObject) => {
    const src = sourceOf(img);
    const t = transformOf.get(img.managedBy ?? '');
    return src !== undefined && t !== undefined && placed.has(src) && placed.has(t);
  };
  const put = (o: DocObject) => {
    out.push(o);
    placed.add(o.id);
  };
  const flush = () => {
    for (let k = 0; k < waiting.length;) {
      const img = waiting[k];
      if (img !== undefined && ready(img)) {
        waiting.splice(k, 1);
        put(img);
        k = 0;
      } else k++;
    }
  };
  for (const o of doc.objects) {
    if (o.managedBy !== undefined) continue;
    put(o);
    flush();
  }
  // Images whose source or map is missing (not in a synced document) keep their order last.
  for (const img of waiting) put(img);
  const same = out.every((o, i) => o === doc.objects[i]);
  return same ? doc : { ...doc, objects: out };
}
