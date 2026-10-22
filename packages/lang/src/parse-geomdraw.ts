/**
 * Geomdraw's claim forms (ADR-0025), read as the claim kinds they name:
 *   `A, B, C collinear` · `ABCD cyclic` (or concyclic) · `AP, BQ, CR concurrent` ·
 *   `AB ⟂ CD` (or perp, perpendicular, ⊥, \perp) · `AB ∥ CD` (or parallel, \parallel) ·
 *   `P on ω` · `ω tangent γ`.
 * Items are expressions, so glued names are lines and circles (`AB`, `ABC`) and the builder
 * spreads a run into its points where the kind takes points (`ABCD cyclic`). A line that is
 * not one of these forms is left to the relations of parse-notation.ts (`AB = CD`, …).
 */
import type { Condition, ExprNode } from './ast';
import { join } from './diagnostic';
import { isPunct, next, peek, type Cursor } from './cursor';
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
