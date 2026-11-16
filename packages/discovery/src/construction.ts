/**
 * Synchronous dependency facts for construction reuse, not claim evaluation or discovery jobs.
 * Only facts derived from registry guarantees participate: saved claims/assumptions are not
 * supplied as extra facts. Unknown facts conservatively leave a new construction distinct.
 */
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { buildClosure } from './closure';

/** Construct once for a tool action; arguments are named object identities, never positions. */
export function constructionFacts(doc: Document, registry: Registry) {
  let closure: ReturnType<typeof buildClosure> | undefined;
  return (kind: string, ...ids: number[]): boolean => {
    closure ??= buildClosure(doc, registry, claimKindRegistry());
    return closure.isConstruction({ kind, args: ids.map((id) => ({ id })) });
  };
}
