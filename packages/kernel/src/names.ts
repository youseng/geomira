/**
 * Name grammar (SPEC §11.2), used by invariant I1. Points: an uppercase Latin letter,
 * then digits or `_` + (digits | one letter | `{alnum+}`), then primes: `A`, `A1`, `A_1`,
 * `M_a`, `M_{ab}`, `H'`, `A_1''`. Everything else starts with a lowercase Latin or a Greek
 * letter (`l`, `k2`, `ω`, `circ_1`). A trailing run of `*` is reserved for the managed
 * images of derived layers (ADR-0003), so user names never end in `*`.
 */

const POINT_NAME = /^[A-Z](?:\d+|_(?:\d+|[A-Za-z]|\{[A-Za-z0-9]+\}))?'*$/u;
const OTHER_NAME = /^[a-zα-ωΑ-Ω][A-Za-z0-9_α-ωΑ-Ω]*'*$/u;
const SUFFIX = /^\*+$/u;

/** Statement keywords of the language; no object may be named like one. */
export const KEYWORDS: readonly string[] = Object.freeze([
  'claim',
  'assume',
  'triangle',
  'style',
  'label',
]);

export function isPointName(name: string): boolean {
  return POINT_NAME.test(name);
}

/** A name a user may give an object, claim or layer. */
export function isUserName(name: string): boolean {
  return (POINT_NAME.test(name) || OTHER_NAME.test(name)) && !KEYWORDS.includes(name);
}

/** A derived layer's image suffix: one or more `*`. */
export function isImageSuffix(suffix: string): boolean {
  return SUFFIX.test(suffix);
}

/**
 * Why a user name is not acceptable, or undefined when it is. Degenerate cases: the empty
 * string, keywords, a trailing `*` (reserved for managed images), and names like `Ma`
 * (with the hint "did you mean M_a?").
 */
export function nameProblem(name: string): string | undefined {
  if (isUserName(name)) return undefined;
  if (name === '') return 'a name cannot be empty';
  if (KEYWORDS.includes(name)) return `"${name}" is a keyword`;
  if (name.endsWith('*')) return `"${name}": names ending in * are reserved for images`;
  const m = /^([A-Z])([a-z])$/u.exec(name);
  if (m !== null) {
    const [, head = '', tail = ''] = m;
    return `"${name}" is not a valid name: did you mean ${head}_${tail}?`;
  }
  return `"${name}" is not a valid name`;
}
