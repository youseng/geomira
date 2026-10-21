/**
 * Olympiad names for what the centre tools build (ADR-0016 decision 23): the circumcenter is
 * O, the centroid G, the incenter I, the orthocenter H, the nine-point center N, the
 * excenter opposite vertex A is I_a (I_b, I_c by the vertex picked first), the circumcircle
 * and the incircle ω. A conventional name is used only when it is free (no object, claim or
 * layer has it) and grammatical; otherwise the usual rule of names.ts applies.
 */
import type { Document } from '@geomira/kernel/document';
import { nameProblem } from '@geomira/kernel/names';
import { assertNever } from '@geomira/num/assert';
import { freshName, type NameKind } from './names';

/** A tool's conventional name: a fixed one, or `base_x` for the first pick named X. */
export type NamePreference =
  | { readonly kind: 'fixed'; readonly name: string }
  | { readonly kind: 'vertex'; readonly base: string };

/**
 * The conventional name a preference asks for, given the name of the first pick: `base_x`
 * needs a first pick named by one Latin letter (A → I_a); any other name asks for nothing.
 */
export function conventionalName(
  pref: NamePreference | undefined,
  first: string | undefined,
): string | undefined {
  if (pref === undefined) return undefined;
  switch (pref.kind) {
    case 'fixed':
      return pref.name;
    case 'vertex':
      return first !== undefined && /^[A-Za-z]$/u.test(first)
        ? `${pref.base}_${first.toLowerCase()}`
        : undefined;
    default:
      return assertNever(pref, 'name preference');
  }
}

function isFree(doc: Document, name: string): boolean {
  return (
    nameProblem(name) === undefined &&
    !doc.objects.some((o) => o.name === name) &&
    !doc.claims.some((c) => c.name === name) &&
    !doc.layers.some((l) => l.name === name)
  );
}

/** `wanted` when it is free and grammatical, else the first free name of `kind`. */
export function preferredName(doc: Document, kind: NameKind, wanted: string | undefined): string {
  return wanted !== undefined && isFree(doc, wanted) ? wanted : freshName(doc, kind);
}
