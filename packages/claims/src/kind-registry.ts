/**
 * The claim kinds as a registry VALUE (ADR-0035), like the tool registry (SPEC §2): the v1
 * kinds of kinds.ts plus extra kinds that tests define, passed as a parameter, never held
 * globally. The tester (prepare, evalClaim, runJob), the screen and packages/discovery take
 * one, so a kind added later, or a test-only kind, runs through exactly the same code.
 */
import type { ClaimKindSpec } from './kind';
import { CLAIM_KINDS } from './kinds';

export interface ClaimKinds {
  /** Every kind, in order: v1's, then the extras. */
  readonly kinds: readonly ClaimKindSpec[];
  get(name: string): ClaimKindSpec | undefined;
}

/**
 * The v1 kinds plus `extra`. Degenerate: two kinds with the same name → TypeError (a
 * programming error, at construction), as createRegistry does for tools.
 */
export function claimKindRegistry(extra: readonly ClaimKindSpec[] = []): ClaimKinds {
  const kinds = Object.freeze([...CLAIM_KINDS, ...extra]);
  const byName = new Map<string, ClaimKindSpec>();
  for (const k of kinds) {
    if (byName.has(k.name)) throw new TypeError(`two claim kinds are named ${k.name}`);
    byName.set(k.name, k);
  }
  return Object.freeze({ kinds, get: (name: string) => byName.get(name) });
}
