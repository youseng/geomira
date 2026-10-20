/**
 * Lookups the scene needs on a document, computed once per build: objects by id, their
 * positions, layers by id, and each object's ORIGIN: the user object at the root of its
 * chain of sources (an image X** → X* → X has origin X) and the positions of the rules
 * along that chain (note A of Run 7, ADR-0010). Origins make the draw order independent of
 * where images sit in the object list, which text round trips do not preserve (ADR-0009).
 *
 * Total on any document, including unsynced or hand-built ones: an image whose source is
 * missing is its own origin; a source chain that loops (impossible under I4, guarded
 * anyway) stops at the first repeated object.
 */
import type { DocObject, Document, Layer } from '@geomira/kernel/document';
import { sourceOf } from '@geomira/kernel/derived';

export interface Origin {
  /** Position in doc.objects of the user object at the root of the chain. */
  readonly position: number;
  /** Positions in doc.layers of the rules from the root outwards ([] for a user object). */
  readonly rules: readonly number[];
}

export interface DocIndex {
  readonly doc: Document;
  readonly byId: ReadonlyMap<number, DocObject>;
  readonly position: ReadonlyMap<number, number>;
  readonly layer: ReadonlyMap<string, Layer>;
  readonly layerPosition: ReadonlyMap<string, number>;
  /** The source of a managed object, when it exists. */
  readonly source: (o: DocObject) => DocObject | undefined;
  readonly origin: (o: DocObject) => Origin;
}

export function indexDocument(doc: Document): DocIndex {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const position = new Map(doc.objects.map((o, i) => [o.id, i]));
  const layer = new Map(doc.layers.map((l) => [l.id, l]));
  const layerPosition = new Map(doc.layers.map((l, i) => [l.id, i]));
  const source = (o: DocObject): DocObject | undefined => {
    if (o.managedBy === undefined) return undefined;
    const id = sourceOf(o);
    return id === undefined ? undefined : byId.get(id);
  };
  const origins = new Map<number, Origin>();
  const origin = (o: DocObject): Origin => {
    const known = origins.get(o.id);
    if (known !== undefined) return known;
    const chain: DocObject[] = [o];
    const seen = new Set([o.id]);
    for (let s = source(o); s !== undefined && !seen.has(s.id); s = source(s)) {
      chain.push(s);
      seen.add(s.id);
    }
    const root = chain[chain.length - 1] ?? o;
    const rules = chain
      .slice(0, -1)
      .reverse()
      .map((x) => layerPosition.get(x.managedBy ?? '') ?? -1);
    const result = { position: position.get(root.id) ?? -1, rules };
    origins.set(o.id, result);
    return result;
  };
  return { doc, byId, position, layer, layerPosition, source, origin };
}
