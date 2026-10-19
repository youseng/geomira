/**
 * Ends every exhaustive switch over a union (CLAUDE.md). The type system proves the call
 * unreachable; at run time it throws, so a value outside the union is never ignored.
 */
export function assertNever(value: never, what = 'value'): never {
  throw new TypeError(`unexpected ${what}: ${JSON.stringify(value)}`);
}
