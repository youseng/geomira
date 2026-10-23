/**
 * The words for a definition that is the same construction as an existing object (ADR-0029):
 * the language's diagnostic (ParseOptions.sameConstruction), the editor's command bar and its
 * GUI tools' notice say the same thing, with the existing definition printed as the text
 * format prints it.
 */
import type { Expr } from '@geomira/kernel/expr';
import { printExpr, type Names } from './print-expr';

/** The existing object: its name and definition. */
export interface Existing {
  readonly name: string;
  readonly def: Expr;
}

/**
 * The message and hint for `name`, defined as the same construction as `same`:
 * "m is the same construction as l (line(A, B)): use l".
 */
export function sameConstructionMessage(
  name: string,
  same: Existing,
  names: Names,
): { readonly message: string; readonly hint: string } {
  const text = printExpr(same.def, names);
  return {
    message: `${name} is the same construction as ${same.name} (${text}): use ${same.name}`,
    hint: `write ${same.name} where ${name} is used, and delete this line`,
  };
}

/** What a GUI tool says when it reuses `same` instead of adding it again: "l is line(A, B) already". */
export function alreadyMessage(same: Existing, names: Names): string {
  return `${same.name} is ${printExpr(same.def, names)} already`;
}
