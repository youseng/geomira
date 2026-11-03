/**
 * Geomdraw's claim forms (ADR-0025), read as the claim kinds they name:
 *   `A, B, C collinear` · `ABCD cyclic` (or concyclic) · `AP, BQ, CR concurrent` ·
 *   `AB ⟂ CD` (or perp, perpendicular, ⊥, \perp) · `AB ∥ CD` (or parallel, \parallel) ·
 *   `P on ω` · `ω tangent γ`.
 * Items are expressions, so glued names are lines and circles (`AB`, `ABC`) and the builder
 * spreads a run into its points where the kind takes points (`ABCD cyclic`). A line that is
 * not one of these forms is left to the relations of parse-notation.ts (`AB = CD`, …).
 */
import { assertNever } from '@geomira/num/assert';
import type { Condition, ExprNode } from './ast';
import { join } from './diagnostic';
import { describe, fail, isPunct, next, peek, type Cursor } from './cursor';
import { parseExpr } from './parse-expr';

/** Words after a list of items: the claim kind they make. */
const LIST_WORDS: Readonly<Record<string, string>> = Object.freeze({
  collinear: 'collinear',
  concyclic: 'concyclic',
  cyclic: 'concyclic',
  concurrent: 'concurrent',
});

/** Words and symbols between two items. */
const PAIR_WORDS: Readonly<Record<string, string>> = Object.freeze({
  on: 'on',
  tangent: 'tangent',
  parallel: 'parallel',
  perp: 'perpendicular',
  perpendicular: 'perpendicular',
  '⟂': 'perpendicular',
  '∥': 'parallel',
});

function word(c: Cursor, table: Readonly<Record<string, string>>): string | undefined {
  const t = peek(c);
  if (t === undefined || (t.kind !== 'name' && t.kind !== 'punct')) return undefined;
  return Object.hasOwn(table, t.value) ? table[t.value] : undefined;
}

/** Items separated by commas; undefined when one is not an expression. */
function items(c: Cursor): ExprNode[] | undefined {
  const out: ExprNode[] = [];
  for (;;) {
    const e = parseExpr(c);
    if (e === undefined) return undefined;
    out.push(e);
    if (!isPunct(c, ',')) return out;
    next(c);
  }
}

function infix(c: Cursor): Condition | undefined {
  const xs = items(c);
  const [first] = xs ?? [];
  if (xs === undefined || first === undefined) return undefined;
  const last = xs[xs.length - 1] ?? first;
  const listKind = word(c, LIST_WORDS);
  if (listKind !== undefined) {
    next(c);
    return { kind: listKind, args: xs, span: join(first.span, last.span) };
  }
  const pairKind = xs.length === 1 ? word(c, PAIR_WORDS) : undefined;
  if (pairKind === undefined) return undefined;
  next(c);
  const other = parseExpr(c);
  return other === undefined
    ? undefined
    : { kind: pairKind, args: [first, other], span: join(first.span, other.span) };
}

/**
 * A Geomdraw claim form at the cursor, or undefined with the cursor and the diagnostics as
 * they were (the caller reads a relation instead).
 */
export function geomdrawClaim(c: Cursor): Condition | undefined {
  const [i, depth, n] = [c.i, c.depth, c.diags.length];
  const r = infix(c);
  if (r !== undefined && c.diags.length === n) return r;
  c.i = i;
  c.depth = depth;
  c.diags.splice(n);
  return undefined;
}

/** Whether a word of the rest of the line (not a call name) is in `table`. */
function wordAhead(c: Cursor, table: Readonly<Record<string, string>>): boolean {
  for (let k = 0; c.i + k < c.tokens.length; k++) {
    const t = peek(c, k);
    const word = t !== undefined && (t.kind === 'name' || t.kind === 'punct');
    if (word && Object.hasOwn(table, t.value) && !isPunct(c, '(', k + 1)) return true;
  }
  return false;
}

/** The source text of tokens from..to − 1 (a space where one was written). */
function textOf(c: Cursor, from: number, to: number): string {
  return c.tokens
    .slice(from, to)
    .map((t, k) => (k > 0 && t.spaceBefore ? ` ${t.text}` : t.text))
    .join('');
}

type Problem = 'list word' | 'commas' | 'pair word' | undefined;

/** Which problem of geomdrawProblem the line has after its first items `xs`. */
function problemAfter(c: Cursor, xs: readonly ExprNode[]): Problem {
  const t = peek(c);
  if (t === undefined) return undefined;
  if (xs.length >= 2) return t.kind === 'name' ? 'list word' : undefined;
  if (xs.length !== 1) return undefined;
  if (t.kind === 'point' && wordAhead(c, LIST_WORDS)) return 'commas';
  const word = t.kind === 'name' && !isPunct(c, '(', 1);
  return word && !Object.hasOwn(PAIR_WORDS, t.value) && wordAhead(c, PAIR_WORDS)
    ? 'pair word'
    : undefined;
}

/**
 * What a line that starts like a Geomdraw claim form could not read (ADR-0051), recorded as a
 * diagnostic at what it could not read: a word after a list that is not a list word (`AP, BQ,
 * CR are concurrent`), objects without commas before a list word (`AP BQ CR concurrent`), or a
 * word after one object that is not a relation word (`AP is perpendicular to BC`). Returns
 * whether it recorded one; otherwise the cursor and the diagnostics are as they were.
 */
export function geomdrawProblem(c: Cursor): boolean {
  const [i, depth, n] = [c.i, c.depth, c.diags.length];
  const xs = items(c);
  const problem = xs === undefined || c.diags.length > n ? undefined : problemAfter(c, xs);
  c.diags.splice(n);
  const t = peek(c);
  if (problem === undefined || t === undefined) {
    c.i = i;
    c.depth = depth;
    return false;
  }
  switch (problem) {
    case 'list word':
      fail(
        c,
        `could not read ${describe(t)}: after a list of objects write collinear, concyclic, cyclic or concurrent`,
        'for example: AP, BQ, CR concurrent, or concurrent(AP, BQ, CR)',
        t,
      );
      return true;
    case 'commas': {
      const from = c.i;
      const second = parseExpr(c);
      c.diags.splice(n);
      fail(
        c,
        `could not read "${textOf(c, from, c.i)}": separate the objects of a list with commas`,
        'for example: AP, BQ, CR concurrent',
        second?.span ?? t,
      );
      return true;
    }
    case 'pair word':
      fail(
        c,
        `could not read ${describe(t)}: between two objects write ⟂, ∥, perpendicular, parallel, on or tangent`,
        'for example: AP ⟂ BC, AB ∥ CD, P on ω, ω tangent γ',
        t,
      );
      return true;
    default:
      return assertNever(problem, 'claim problem');
  }
}
