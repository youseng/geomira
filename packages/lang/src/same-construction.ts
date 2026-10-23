/**
 * The words for a definition that is the same construction as an earlier object (ADR-0029):
 * the language's diagnostic (ParseOptions.sameConstruction) and the editor's command bar say
 * the same thing.
 */

/**
 * The message and hint for `name`, defined as the same construction as the earlier object
 * `same`, whose definition reads `text`: "m is the same construction as l (line(A, B)): use l".
 */
export function sameConstructionMessage(
  name: string,
  same: string,
  text: string,
): { readonly message: string; readonly hint: string } {
  return {
    message: `${name} is the same construction as ${same} (${text}): use ${same}`,
    hint: `write ${same} where ${name} is used, and delete this line`,
  };
}
