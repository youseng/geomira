/** Limits shared by the evaluator, the evaluation context and the language. */
import { selectorExprs, type Expr } from './expr';

/**
 * The largest magnitude of a FloatField argument a tool computes with (2^200 ≈ 1.6e60).
 * Every v1 formula is a polynomial of degree ≤ 4 in its arguments whose divisors are at
 * least (EPS·scale)², so with arguments below this bound no intermediate overflows and
 * no NaN or ±Infinity reaches a zero test, a square root or atan2 (law L1). Beyond it the
 * numbers are not representable for geometry in this field: Inexact (ADR-0003). The
 * circle tools of Run 3a keep every intermediate below about 2^852 (ADR-0004).
 */
export const FLOAT_ARG_LIMIT = 2 ** 200;

/**
 * The deepest an expression may be nested (calls, operators, point literals): deeper
 * definitions are refused by the language with a diagnostic and evaluated to Undefined, so no
 * recursive walk of an expression can overflow the call stack (Run 10 audit: parse and
 * evaluate threw "Maximum call stack size exceeded" at a few thousand levels). Figures never
 * come near it; a deeper computation is written with intermediate objects.
 */
export const MAX_EXPR_DEPTH = 100;

/**
 * The nesting depth of `e` (a literal, reference or string is 1; a call is 1 + its deepest
 * argument or selector argument), computed without recursion, so it is total on any tree.
 */
export function exprDepth(e: Expr): number {
  let deepest = 0;
  const stack: [Expr, number][] = [[e, 1]];
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const [x, d] = top;
    deepest = Math.max(deepest, d);
    if (x.kind !== 'call') continue;
    for (const a of x.args) stack.push([a, d + 1]);
    for (const s of x.selectors) for (const a of selectorExprs(s)) stack.push([a, d + 1]);
  }
  return deepest;
}
