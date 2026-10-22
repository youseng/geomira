/**
 * A token cursor over one line, shared by the statement, expression and notation parsers.
 * Parsers never throw: a syntax error records a diagnostic and the parser returns
 * undefined, so the line is skipped (per-line recovery, SPEC §11.3).
 */
import { error, type Diagnostic, type Span } from './diagnostic';
import type { Token } from './token';

export interface Cursor {
  readonly tokens: readonly Token[];
  readonly line: number;
  /** The column after the last character of the line (for "expected … at the end"). */
  readonly end: number;
  i: number;
  /** Nesting of the expression parser (parse-expr.ts bounds it by MAX_EXPR_DEPTH). */
  depth: number;
  readonly diags: Diagnostic[];
}

export function cursor(tokens: readonly Token[], line: number, end: number): Cursor {
  return { tokens, line, end, i: 0, depth: 0, diags: [] };
}

export function peek(c: Cursor, k = 0): Token | undefined {
  return c.tokens[c.i + k];
}

export function next(c: Cursor): Token | undefined {
  const t = c.tokens[c.i];
  if (t !== undefined) c.i += 1;
  return t;
}

export function atEnd(c: Cursor): boolean {
  return c.i >= c.tokens.length;
}

/** The span of the current token, or the end of the line. */
export function here(c: Cursor): Span {
  const t = peek(c);
  return t ?? { line: c.line, column: c.end, endColumn: c.end + 1 };
}

/** Whether the current token is punctuation `p`. */
export function isPunct(c: Cursor, p: string, k = 0): boolean {
  const t = peek(c, k);
  return t?.kind === 'punct' && t.value === p;
}

/** Whether the current token is the word `w` (a lowercase name). */
export function isWord(c: Cursor, w: string, k = 0): boolean {
  const t = peek(c, k);
  return t?.kind === 'name' && t.value === w;
}

export function describe(t: Token | undefined): string {
  return t === undefined ? 'the end of the line' : `"${t.text}"`;
}

/** Records a syntax error at the current token; returns undefined for chaining. */
export function fail(c: Cursor, message: string, hint: string, span: Span = here(c)): undefined {
  c.diags.push(error(span, message, hint));
  return undefined;
}

/** Consumes punctuation `p` or records "expected p". */
export function expect(c: Cursor, p: string, hint: string): Token | undefined {
  if (isPunct(c, p)) return next(c);
  fail(c, `expected "${p}", found ${describe(peek(c))}`, hint);
  return undefined;
}

/** A span from `start` to the token before the cursor. */
export function since(c: Cursor, start: Span): Span {
  const last = c.tokens[c.i - 1];
  return last === undefined || last.line !== start.line
    ? start
    : {
        line: start.line,
        column: start.column,
        endColumn: Math.max(last.endColumn, start.endColumn),
      };
}
