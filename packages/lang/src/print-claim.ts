/**
 * The text of one claim of a document, as its `claim` line prints it without the keyword (the
 * Claims panel shows facts found by discovery this way, ADR-0035). Never throws: an id that is
 * not an object of the document prints as print does for a dangling reference.
 */
import type { Document } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import type { Names } from './print-expr';
import { printClaimBody } from './print-notation';

/** The names of `doc`'s objects, by id. */
function namesOf(doc: Document): Names {
  const byId = new Map(doc.objects.map((o) => [o.id, o.name]));
  return (id) => byId.get(id);
}

/** The text of the claim `kind(args)` in `doc`: the body of its `claim` line. */
export function printClaim(doc: Document, kind: string, args: readonly Expr[]): string {
  return printClaimBody(kind, args, namesOf(doc));
}
