/**
 * Probes and closures (internal). The kernel evaluates objects, not free-standing
 * expressions, so every expression the tester needs a value of (a claim argument, an
 * assumption argument, the line of an along(±) call, the object of a glider) is appended
 * to the document as a PROBE object. Probe names start with `#`, which no user name can
 * (SPEC §11.2), and probes never leave packages/claims: counterexample documents are built
 * from the user's objects only.
 */
import { refsOf, type Expr } from '@geomira/kernel/expr';
import { MAIN_LAYER_ID, type DocObject, type Document } from '@geomira/kernel/document';

export const PROBE_PREFIX = '#probe';

export interface Probed {
  readonly doc: Document;
  /** The object id of each probe, in the order of `exprs`. */
  readonly ids: readonly number[];
}

/** `doc` with one probe object per expression, appended after every user object. */
export function addProbes(doc: Document, exprs: readonly Expr[]): Probed {
  const ids = exprs.map((_, i) => doc.nextId + i);
  const probes: DocObject[] = exprs.map((def, i) => ({
    id: doc.nextId + i,
    name: `${PROBE_PREFIX}${String(i)}`,
    def,
    style: { hidden: true },
    layers: [MAIN_LAYER_ID],
  }));
  return {
    doc: { ...doc, nextId: doc.nextId + exprs.length, objects: [...doc.objects, ...probes] },
    ids,
  };
}

export function isProbe(o: DocObject): boolean {
  return o.name.startsWith(PROBE_PREFIX);
}

/** The objects `roots` depend on, themselves included (construction order is irrelevant). */
export function closureOf(doc: Document, roots: Iterable<number>): ReadonlySet<number> {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const seen = new Set<number>();
  const stack = [...roots];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    if (seen.has(id)) continue;
    const o = byId.get(id);
    if (o === undefined) continue;
    seen.add(id);
    stack.push(...refsOf(o.def));
  }
  return seen;
}

/** The document restricted to `keep` (in construction order; references stay valid). */
export function truncate(doc: Document, keep: ReadonlySet<number>): Document {
  return { ...doc, objects: doc.objects.filter((o) => keep.has(o.id)) };
}

/** The document without its probes (for counterexample documents). */
export function withoutProbes(doc: Document): Document {
  return { ...doc, objects: doc.objects.filter((o) => !isProbe(o)) };
}
