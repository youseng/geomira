/**
 * Printing expressions (ADR-0009): names for references, numbers as written (a literal's
 * `text` when it reads back as its value, else the canonical form), `(x, y)` for points,
 * infix arithmetic with the fewest parentheses that parse back to the same tree (operators
 * are left-associative, so a right operand of equal precedence keeps its parentheses),
 * spaces around every binary operator (so `l* * 2` never reads as a name), selectors last.
 */
import type { Expr, LitExpr } from '@geomira/kernel/expr';
import { eq, formatRational } from '@geomira/num/rational';
import { formatSelector } from '@geomira/kernel/selector';
import { exactLiteral } from './lex-literals';

export type Names = (id: number) => string | undefined;

const INFIX: Readonly<Record<string, { readonly op: string; readonly prec: number }>> = {
  add: { op: '+', prec: 1 },
  sub: { op: '-', prec: 1 },
  mul: { op: '*', prec: 2 },
  div: { op: '/', prec: 2 },
};
const UNARY = 3;
const ATOM = 4;

/** The literal as written, when that text reads back as exactly its value. */
export function litText(l: LitExpr): string {
  if (l.text !== undefined && /^-?[0-9]/u.test(l.text)) {
    const r = exactLiteral(l.text);
    if (r.ok && eq(r.value, l.value)) return l.text;
  }
  return formatRational(l.value);
}

function isInfix(e: Expr): e is Extract<Expr, { kind: 'call' }> {
  return (
    e.kind === 'call' &&
    INFIX[e.tool] !== undefined &&
    e.args.length === 2 &&
    e.selectors.length === 0
  );
}

function isNeg(e: Expr): boolean {
  return e.kind === 'call' && e.tool === 'neg' && e.args.length === 1 && e.selectors.length === 0;
}

function prec(e: Expr): number {
  if (e.kind !== 'call') return ATOM;
  if (isInfix(e)) return INFIX[e.tool]?.prec ?? ATOM;
  return isNeg(e) ? UNARY : ATOM;
}

function wrap(s: string, e: Expr, min: number): string {
  return prec(e) < min ? `(${s})` : s;
}

/** An expression at a position that needs at least precedence `min`. */
function printAt(e: Expr, names: Names, min: number): string {
  switch (e.kind) {
    case 'ref':
      return names(e.id) ?? `#${String(e.id)}`;
    case 'lit':
      return litText(e);
    case 'call': {
      const [a, b] = e.args;
      const infix = INFIX[e.tool];
      if (isInfix(e) && infix !== undefined && a !== undefined && b !== undefined) {
        const s = `${printAt(a, names, infix.prec)} ${infix.op} ${printAt(b, names, infix.prec + 1)}`;
        return wrap(s, e, min);
      }
      if (isNeg(e) && a !== undefined) {
        const inner =
          a.kind === 'lit' || isNeg(a) ? `(${printExpr(a, names)})` : printAt(a, names, UNARY);
        return wrap(`-${inner}`, e, min);
      }
      if (
        e.tool === 'point' &&
        e.args.length === 2 &&
        e.selectors.length === 0 &&
        a !== undefined &&
        b !== undefined
      ) {
        return `(${printExpr(a, names)}, ${printExpr(b, names)})`;
      }
      const parts = [
        ...e.args.map((x) => printExpr(x, names)),
        ...e.selectors.map((s) => formatSelector(s, (x) => printExpr(x, names))),
      ];
      return `${e.tool}(${parts.join(', ')})`;
    }
    default:
      return '';
  }
}

export function printExpr(e: Expr, names: Names): string {
  return printAt(e, names, 0);
}
