/**
 * Dependency graph of a document's objects (internal): transitive dependents and the
 * stable topological order used by redefine.
 */
import type { DocObject } from './document';
import { refsOf } from './expr';

/**
 * The ids of `seeds` and of every object that depends on one of them, directly or
 * transitively, in construction order. Assumes I2 (references point to earlier objects),
 * so one forward pass suffices.
 */
export function dependentClosure(objects: readonly DocObject[], seeds: Iterable<number>): number[] {
  const hit = new Set(seeds);
  const out: number[] = [];
  for (const o of objects) {
    if (hit.has(o.id) || refsOf(o.def).some((id) => hit.has(id))) {
      hit.add(o.id);
      out.push(o.id);
    }
  }
  return out;
}

/**
 * The objects in a dependency-respecting order that keeps the given order wherever it
 * can (stable Kahn: always the earliest object whose references are all placed).
 * Degenerate: a cycle or a reference to a missing object → undefined.
 */
export function stableTopologicalOrder(objects: readonly DocObject[]): DocObject[] | undefined {
  const placed = new Set<number>();
  const pending = [...objects];
  const out: DocObject[] = [];
  while (pending.length > 0) {
    const k = pending.findIndex((o) => refsOf(o.def).every((id) => placed.has(id)));
    const next = pending[k];
    if (next === undefined) return undefined;
    pending.splice(k, 1);
    placed.add(next.id);
    out.push(next);
  }
  return out;
}
