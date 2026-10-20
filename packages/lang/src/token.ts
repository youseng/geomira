/** Tokens of the language (lexer.ts). */
import type { Span } from './diagnostic';

/**
 * point: a point name (`A`, `M_a`, `H'`, `A*`); name: any other name, with Greek escapes
 * resolved in `value` (`\omega` → ω); number: an unsigned number as written (`2`, `0.1`,
 * `2/3`, `60°`, `2.5e21`); string: `value` unescaped; punct: an operator or bracket, `value`
 * normalised (`−` → `-`, `!=` → `≠`, `\angle` → `∠`); directive: `@word`, `value` the word.
 */
export type TokenKind = 'point' | 'name' | 'number' | 'string' | 'punct' | 'directive';

export interface Token extends Span {
  readonly kind: TokenKind;
  /** The source text. */
  readonly text: string;
  readonly value: string;
  /** Whitespace (or the start of the line) precedes the token. */
  readonly spaceBefore: boolean;
}
