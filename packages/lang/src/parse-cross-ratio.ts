/**
 * The cross-ratio notation (Run 16a, ADR-0040 decision 16): `harmonic(A, B; C, D)` and
 * `cross_ratio(A, B, C, D) = k`, for four points or four concurrent lines (the build resolves
 * the line kinds from the arguments' static kinds). A `;` may separate the two pairs once,
 * after the second argument; the plain calls `harmonic(A, B, C, D)` and
 * `cross_ratio(A, B, C, D, k)` are kind calls (parse-notation.ts).
 */
import type { Condition, ExprNode } from './ast';
import { join } from './diagnostic';
import { describe, fail, isPunct, next, peek, type Cursor } from './cursor';
import { parseExpr, parseUnary } from './parse-expr';

const KINDS = ['harmonic', 'cross_ratio'];

/** Whether the call at the cursor uses the notation: a `;` inside it, or `=` after it. */
function notationAhead(c: Cursor): boolean {
  let depth = 0;
  for (let k = c.i + 1; k < c.tokens.length; k++) {
    const u = c.tokens[k];
    if (u?.kind !== 'punct') continue;
    if (u.value === '(') depth += 1;
    if (u.value === ')') depth -= 1;
    if (u.value === ';' && depth === 1) return true;
    if (depth === 0) {
      const after = c.tokens[k + 1];
      return after?.kind === 'punct' && after.value === '=';
    }
  }
  return false;
}

/** The four arguments, separated by `,` and at most one `;` after the second. */
function fourArgs(c: Cursor, kind: string): ExprNode[] | undefined {
  const args: ExprNode[] = [];
  for (;;) {
    const e = parseExpr(c);
    if (e === undefined) return undefined;
    args.push(e);
    const sep = peek(c);
    if (isPunct(c, ')')) break;
    const semi = isPunct(c, ';');
    if (!isPunct(c, ',') && !semi) {
      fail(c, `expected "," or ")", found ${describe(sep)}`, `write ${kind}(A, B; C, D)`);
      return undefined;
    }
    if (semi && args.length !== 2) {
      fail(c, `"${kind}(…)": the ";" separates the two pairs`, `write ${kind}(A, B; C, D)`);
      return undefined;
    }
    next(c);
  }
  next(c);
  if (args.length !== 4) {
    fail(c, `${kind}(…) takes four points or four lines`, `write ${kind}(A, B; C, D)`);
    return undefined;
  }
  return args;
}

/**
 * The claim at the cursor in the cross-ratio notation, or 'none' when it is not one (the other
 * claim forms then apply); undefined after a syntax error.
 */
export function crossRatioClaim(c: Cursor): Condition | undefined | 'none' {
  const t = peek(c);
  if (t?.kind !== 'name' || !KINDS.includes(t.value) || !isPunct(c, '(', 1)) return 'none';
  if (!notationAhead(c)) return 'none';
  next(c);
  next(c);
  const args = fourArgs(c, t.value);
  if (args === undefined) return undefined;
  const last = args[3] ?? args[0];
  if (t.value === 'harmonic') {
    if (isPunct(c, '=')) {
      fail(
        c,
        'harmonic(A, B; C, D) takes no value',
        'for another value write cross_ratio(A, B, C, D) = k',
      );
      return undefined;
    }
    return { kind: 'harmonic', args, span: join(t, last?.span ?? t) };
  }
  if (!isPunct(c, '=')) {
    fail(c, `expected "=", found ${describe(peek(c))}`, 'write cross_ratio(A, B, C, D) = k');
    return undefined;
  }
  next(c);
  const k = parseUnary(c);
  if (k === undefined) return undefined;
  return { kind: 'cross_ratio', args: [...args, k], span: join(t, k.span) };
}
