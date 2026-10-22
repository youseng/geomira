/**
 * Expressions (SPEC §11.1, ADR-0009):
 *   expr    = product { ("+" | "-") product }
 *   product = unary { ("*" | "·" | "/") unary }
 *   unary   = "-" number (glued: a negative literal) | "-" unary | primary
 *   primary = number | name | call | "(" expr ")" | "(" expr "," expr ")"
 *   call    = tool "(" [ arg { "," arg } ] ")"   (selectors are the trailing arguments)
 *   arg     = string | expr                      (a string only as a whole argument: ADR-0011)
 * Operators are left-associative; `-` binds tighter than `*`, which binds tighter than `+`.
 * Nesting (parentheses, calls, negations) deeper than MAX_EXPR_DEPTH is a diagnostic, so the
 * recursive descent never overflows the call stack (parse is total, SPEC §11.3); long
 * operator chains are bounded when converted (build-expr.ts).
 */
import type { ExprNode, SelectorNode } from './ast';
import { join } from './diagnostic';
import {
  describe,
  expect,
  fail,
  here,
  isPunct,
  isWord,
  next,
  peek,
  since,
  type Cursor,
} from './cursor';
import { selectorSyntax } from './selectors';
import { MAX_EXPR_DEPTH } from '@geomira/kernel/limits';

const ADDITIVE: Readonly<Record<string, 'add' | 'sub'>> = { '+': 'add', '-': 'sub' };
const MULTIPLICATIVE: Readonly<Record<string, 'mul' | 'div'>> = {
  '*': 'mul',
  '·': 'mul',
  '/': 'div',
};

/** The diagnostic of an expression nested deeper than MAX_EXPR_DEPTH. */
export function nestedTooDeep(): { message: string; hint: string } {
  return {
    message: `the expression is nested more than ${String(MAX_EXPR_DEPTH)} levels deep`,
    hint: 'write intermediate objects (k = …, then use k)',
  };
}

/** Runs `f` one nesting level deeper, or fails when the limit is reached. */
function nested(c: Cursor, f: () => ExprNode | undefined): ExprNode | undefined {
  if (c.depth >= MAX_EXPR_DEPTH) {
    const d = nestedTooDeep();
    fail(c, d.message, d.hint);
    return undefined;
  }
  c.depth += 1;
  const e = f();
  c.depth -= 1;
  return e;
}

export function parseExpr(c: Cursor): ExprNode | undefined {
  return nested(c, () => parseSum(c));
}

function parseSum(c: Cursor): ExprNode | undefined {
  let left = parseProduct(c);
  for (;;) {
    const t = peek(c);
    const op = t?.kind === 'punct' ? ADDITIVE[t.value] : undefined;
    if (left === undefined || op === undefined) return left;
    next(c);
    const right = parseProduct(c);
    if (right === undefined) return undefined;
    left = { kind: 'binary', op, left, right, span: join(left.span, right.span) };
  }
}

function parseProduct(c: Cursor): ExprNode | undefined {
  let left = parseUnary(c);
  for (;;) {
    const t = peek(c);
    const op = t?.kind === 'punct' ? MULTIPLICATIVE[t.value] : undefined;
    if (left === undefined || op === undefined) return left;
    next(c);
    const right = parseUnary(c);
    if (right === undefined) return undefined;
    left = { kind: 'binary', op, left, right, span: join(left.span, right.span) };
  }
}

export function parseUnary(c: Cursor): ExprNode | undefined {
  const t = peek(c);
  if (t?.kind === 'punct' && t.value === '-') {
    next(c);
    const n = peek(c);
    if (n?.kind === 'number' && !n.spaceBefore) {
      next(c);
      return { kind: 'num', text: `-${n.text}`, span: join(t, n) };
    }
    const operand = nested(c, () => parseUnary(c));
    return operand === undefined
      ? undefined
      : { kind: 'neg', operand, span: join(t, operand.span) };
  }
  return parsePrimary(c);
}

function parsePrimary(c: Cursor): ExprNode | undefined {
  const t = peek(c);
  if (t === undefined) {
    fail(c, 'expected an expression, found the end of the line', 'complete the expression');
    return undefined;
  }
  switch (t.kind) {
    case 'number':
      next(c);
      return { kind: 'num', text: t.text, span: t };
    case 'point':
      return parsePointName(c);
    case 'name':
      return isPunct(c, '(', 1)
        ? parseCall(c)
        : (next(c), { kind: 'name', name: t.value, span: t });
    case 'punct':
      if (t.value === '(') return parseParen(c);
      unexpectedPunct(c, t.value);
      return undefined;
    case 'string':
      fail(
        c,
        `expected an expression, found ${describe(t)}`,
        'a string is only an argument of a call, as in text(P, "…")',
      );
      return undefined;
    case 'directive': {
      fail(c, `expected an expression, found ${describe(t)}`, 'write a name, a number or a call');
      return undefined;
    }
    default: {
      fail(c, `expected an expression, found ${describe(t)}`, 'write a name, a number or a call');
      return undefined;
    }
  }
}

function unexpectedPunct(c: Cursor, p: string): undefined {
  if (p === '∡' || p === '∠') {
    fail(
      c,
      `${p} belongs in claims and assumptions`,
      'in definitions write dangle(A, B, C) or angle(A, B, C)',
    );
    return undefined;
  }
  fail(c, `expected an expression, found "${p}"`, 'write a name, a number or a call');
  return undefined;
}

/**
 * A point name, or a run of glued point names (ADR-0025, Geomdraw's notation): `AB` is
 * line(A, B), `ABC` circle(A, B, C), `ABCD…` polygon(A, B, C, D, …); the builder spreads the
 * names into a call that takes the points instead (`midpoint(AB)`, build-expr.ts).
 */
function parsePointName(c: Cursor): ExprNode | undefined {
  const t = next(c);
  if (t === undefined) return undefined;
  const names: ExprNode[] = [{ kind: 'name', name: t.value, span: t }];
  for (let g = peek(c); g?.kind === 'point' && !g.spaceBefore; g = peek(c)) {
    next(c);
    names.push({ kind: 'name', name: g.value, span: g });
  }
  const [only] = names;
  if (names.length === 1 && only !== undefined) return only;
  const tool = names.length === 2 ? 'line' : names.length === 3 ? 'circle' : 'polygon';
  return { kind: 'call', tool, args: names, selectors: [], span: since(c, t), glued: true };
}

function parseParen(c: Cursor): ExprNode | undefined {
  const open = next(c);
  if (open === undefined) return undefined;
  const x = parseExpr(c);
  if (x === undefined) return undefined;
  if (isPunct(c, ',')) {
    next(c);
    const y = parseExpr(c);
    if (y === undefined || expect(c, ')', 'a point literal is (x, y)') === undefined)
      return undefined;
    return { kind: 'pair', x, y, span: since(c, open) };
  }
  return expect(c, ')', 'close the parenthesis') === undefined ? undefined : x;
}

/** `tool(args…, selectors…)`. */
function parseCall(c: Cursor): ExprNode | undefined {
  const head = next(c);
  next(c);
  if (head === undefined) return undefined;
  const args: ExprNode[] = [];
  const selectors: SelectorNode[] = [];
  if (!isPunct(c, ')')) {
    for (;;) {
      const sel = selectorAhead(c);
      if (sel) {
        const s = parseSelector(c);
        if (s === undefined) return undefined;
        selectors.push(s);
      } else {
        if (selectors.length > 0) {
          fail(
            c,
            `${head.value}(…): selectors come after the arguments`,
            'move the selectors to the end of the call',
          );
          return undefined;
        }
        const a = parseArg(c);
        if (a === undefined) return undefined;
        args.push(a);
      }
      if (!isPunct(c, ',')) break;
      next(c);
    }
  }
  if (expect(c, ')', `close the call to ${head.value}`) === undefined) return undefined;
  return { kind: 'call', tool: head.value, args, selectors, span: since(c, head) };
}

/** A call argument: a string literal standing alone (ADR-0011), else an expression. */
function parseArg(c: Cursor): ExprNode | undefined {
  const t = peek(c);
  if (t?.kind === 'string' && (isPunct(c, ',', 1) || isPunct(c, ')', 1))) {
    next(c);
    return { kind: 'str', value: t.value, span: t };
  }
  return parseExpr(c);
}

/**
 * Whether a selector starts here: a selector name followed by "(". `other(P)` (one
 * argument) is the ranker; `other(a, b, P)` is the tool, so `other` counts as a selector
 * only when its parentheses hold exactly one argument.
 */
function selectorAhead(c: Cursor): boolean {
  const t = peek(c);
  if (t?.kind !== 'name' || !isPunct(c, '(', 1) || selectorSyntax(t.value) === undefined)
    return false;
  if (t.value !== 'other') return true;
  let depth = 0;
  for (let k = c.i + 1; k < c.tokens.length; k++) {
    const u = c.tokens[k];
    if (u?.kind !== 'punct') continue;
    if (u.value === '(' || u.value === '[') depth += 1;
    else if (u.value === ')' || u.value === ']') {
      depth -= 1;
      if (depth === 0) return true;
    } else if (u.value === ',' && depth === 1) return false;
  }
  return true;
}

function parseSelector(c: Cursor): SelectorNode | undefined {
  const head = next(c);
  next(c);
  const syntax = head === undefined ? undefined : selectorSyntax(head.value);
  if (head === undefined || syntax === undefined) return undefined;
  if (syntax.form === 'sign') {
    const s = next(c);
    const sign = s?.kind === 'punct' && (s.value === '+' || s.value === '-') ? s.value : undefined;
    if (sign === undefined) {
      fail(
        c,
        `${head.value} takes + or -`,
        `write ${head.value}(+) or ${head.value}(-)`,
        s ?? here(c),
      );
      return undefined;
    }
    if (expect(c, ')', `write ${head.value}(${sign})`) === undefined) return undefined;
    const kind = syntax.kind === 'along' ? 'along' : 'orient';
    return { kind, sign: sign === '+' ? 1 : -1, span: since(c, head) };
  }
  const args: ExprNode[] = [];
  let not = false;
  for (let k = 0; k < syntax.arity; k++) {
    if (k > 0 && expect(c, ',', syntax.usage) === undefined) return undefined;
    if (
      syntax.kind === 'on_arc' &&
      k === 2 &&
      isWord(c, 'not') &&
      !isPunct(c, ',', 1) &&
      !isPunct(c, ')', 1)
    ) {
      next(c);
      not = true;
    }
    const a = parseExpr(c);
    if (a === undefined) return undefined;
    args.push(a);
  }
  if (
    expect(c, ')', `${head.value} takes ${String(syntax.arity)} argument(s): ${syntax.usage}`) ===
    undefined
  )
    return undefined;
  const span = since(c, head);
  if (syntax.kind === 'on_arc') return { kind: 'on_arc', args, not, span };
  if (syntax.kind === 'along' || syntax.kind === 'orient') return undefined;
  return { kind: syntax.kind, args, span };
}
