/**
 * Documents up to ids (laws P1–P3, SPEC §11.3): `canonicalDocument` renumbers objects,
 * then layers, claims and assumptions in document order (1, 2, …; layers `L<n>`, main
 * stays `main`), sets nextId to the next free id, and sorts the comments by anchor; runs of
 * consecutive images are put in a fixed order first (sortImageRuns). Two documents are
 * equal up to ids iff their canonical forms are deeply equal.
 */
import { MAIN_LAYER_ID, type DocObject, type Document } from '@geomira/kernel/document';
import { anchorKey } from './comments';
import { remapIds } from './remap';

export function canonicalDocument(doc: Document): Document {
  return renumber(sortImageRuns(doc));
}

/**
 * The text format does not record where images sit among other images: parse places each
 * image right after the later of its source and transformation (ADR-0007), while edits
 * (a second rule on the same transformation, an object moved into a source layer) may
 * have put it earlier in that run. Each maximal run of consecutive images is therefore put
 * in one order: by the chain of sources back to a user object (its position first), then
 * by the layers along the chain, so an image always follows its source.
 */
export function sortImageRuns(doc: Document): Document {
  const layerAt = new Map(doc.layers.map((l, i) => [l.id, i]));
  const byId = new Map(doc.objects.map((o, i) => [o.id, { o, i }]));
  const key = (o: DocObject, depth: number): number[] => {
    const src = o.def.kind === 'call' ? o.def.args[1] : undefined;
    const s = src?.kind === 'ref' ? byId.get(src.id) : undefined;
    if (o.managedBy === undefined || s === undefined || depth > doc.layers.length)
      return [byId.get(o.id)?.i ?? 0];
    return [...key(s.o, depth + 1), layerAt.get(o.managedBy) ?? 0];
  };
  const cmp = (a: DocObject, b: DocObject): number => {
    const [p, q] = [key(a, 0), key(b, 0)];
    for (let k = 0; k < Math.min(p.length, q.length); k++)
      if (p[k] !== q[k]) return (p[k] ?? 0) - (q[k] ?? 0);
    return p.length - q.length;
  };
  const out: DocObject[] = [];
  let run: DocObject[] = [];
  const flush = (): void => {
    out.push(...run.sort(cmp));
    run = [];
  };
  for (const o of doc.objects) {
    if (o.managedBy === undefined) {
      flush();
      out.push(o);
    } else run.push(o);
  }
  flush();
  return { ...doc, objects: out };
}

function renumber(doc: Document): Document {
  let next = 1;
  const obj = new Map(doc.objects.map((o) => [o.id, next++]));
  const lay = new Map(
    doc.layers.map((l) => [l.id, l.id === MAIN_LAYER_ID ? MAIN_LAYER_ID : `L${String(next++)}`]),
  );
  const cl = new Map(doc.claims.map((c) => [c.id, next++]));
  const as = new Map(doc.assumptions.map((a) => [a.id, next++]));
  const out = remapIds(doc, {
    object: (id) => obj.get(id) ?? -id,
    layer: (id) => lay.get(id) ?? `?${id}`,
    claim: (id) => cl.get(id) ?? -id,
    assumption: (id) => as.get(id) ?? -id,
  });
  const comments =
    out.meta.comments === undefined
      ? undefined
      : [...out.meta.comments].sort((a, b) => (anchorKey(a.anchor) < anchorKey(b.anchor) ? -1 : 1));
  const meta =
    comments === undefined || comments.length === 0
      ? withoutComments(out.meta)
      : { ...out.meta, comments };
  return { ...out, nextId: next, meta };
}

function withoutComments(m: Document['meta']): Document['meta'] {
  return {
    ...(m.title === undefined ? {} : { title: m.title }),
    ...(m.author === undefined ? {} : { author: m.author }),
  };
}

/** Whether two documents are equal up to ids (structural, as JSON with BigInts as text). */
export function sameUpToIds(a: Document, b: Document): boolean {
  return stable(canonicalDocument(a)) === stable(canonicalDocument(b));
}

/** A deterministic JSON text (sorted keys, BigInt as text, -0 kept). */
export function stable(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => {
    if (typeof v === 'bigint') return `${v.toString()}n`;
    if (typeof v === 'number' && Object.is(v, -0)) return '-0';
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0)));
    }
    return v;
  });
}
