/**
 * Assumption notation (SPEC §10–§11, ADR-0009 decision 18): a kind call (`acute(A, B, C)`),
 * a comparison of measures with <, > or ≠ (`AB < AC`, `∠BAC > 90`), `P inside poly`, or
 * `A, B, C in order on l`. The measures are the sides of the claim notation (parse-notation).
 */
import { assertNever } from '@geomira/num/assert';
import type { Condition, ExprNode } from './ast';
import { join } from './diagnostic';
import { atEnd, describe, fail, isPunct, isWord, next, peek, type Cursor } from './cursor';
import { parseExpr } from './parse-expr';
import { kindCall, parseSide, type Side } from './parse-notation';

function measure(s: Side): ExprNode | undefined {
  switch (s.t) {
    case 'seg':
      return { kind: 'call', tool: 'dist', args: s.pts, selectors: [], span: s.span };
    case 'angle':
      return { kind: 'call', tool: 'angle', args: s.pts, selectors: [], span: s.span };
    case 'num':
    case 'expr':
      return s.e;
    case 'scaled':
    case 'ratio':
    case 'prod':
    case 'sum':
    case 'dangle':
    case 'dlines':
    case 'form':
      return undefined;
    default:
      return assertNever(s, 'side');
  }
}

const COMPARE: Readonly<Record<string, string>> = { '<': 'less', '>': 'greater', '≠': 'not_equal' };

function comparison(c: Cursor, l: Side): Condition | undefined {
  const op = next(c);
  const r = parseSide(c);
  const kind = op === undefined ? undefined : COMPARE[op.value];
  if (r === undefined || kind === undefined) return undefined;
  const [x, y] = [measure(l), measure(r)];
  if (x === undefined || y === undefined) {
    fail(
      c,
      'compare lengths (AB, dist(X, Y)), angles (∠ABC, angle(X, Y, Z)) or numbers',
      'write AB < AC or ∠BAC > 90',
      join(l.span, r.span),
    );
    return undefined;
  }
  return { kind, args: [x, y], span: join(l.span, r.span) };
}

/** `A, B, C in order on l` after the first point. */
function inOrder(c: Cursor, first: ExprNode): Condition | undefined {
  const pts = [first];
  while (isPunct(c, ',')) {
    next(c);
    const e = parseExpr(c);
    if (e === undefined) return undefined;
    pts.push(e);
  }
  if (!(isWord(c, 'in') && isWord(c, 'order', 1) && isWord(c, 'on', 2))) {
    fail(c, `expected "in order on", found ${describe(peek(c))}`, 'write A, B, C in order on l');
    return undefined;
  }
  c.i += 3;
  const curve = parseExpr(c);
  return curve === undefined
    ? undefined
    : { kind: 'in_order', args: [...pts, curve], span: join(first.span, curve.span) };
}

/** The body of `assume …`. */
export function parseCondition(c: Cursor): Condition | undefined {
  const call = kindCall(c, false);
  if (call !== undefined || c.diags.length > 0) return call;
  const l = parseSide(c);
  if (l === undefined) return undefined;
  const t = peek(c);
  if (t?.kind === 'punct' && COMPARE[t.value] !== undefined) return comparison(c, l);
  if (t?.kind === 'punct' && (t.value === '=' || t.value === '≤' || t.value === '≥')) {
    const msg =
      t.value === '='
        ? 'equality assumptions are not allowed: construct it instead'
        : 'hypotheses are open conditions';
    fail(
      c,
      msg,
      t.value === '='
        ? 'construct the equal objects (e.g. a midpoint, a reflection)'
        : 'use < or >',
      t,
    );
    return undefined;
  }
  if (l.t !== 'expr') {
    fail(c, `expected <, > or ≠ after the measure, found ${describe(t)}`, 'write AB < AC');
    return undefined;
  }
  if (isWord(c, 'inside')) {
    next(c);
    const poly = parseExpr(c);
    return poly === undefined
      ? undefined
      : { kind: 'inside', args: [l.e, poly], span: join(l.span, poly.span) };
  }
  if (isPunct(c, ',') || isWord(c, 'in')) return inOrder(c, l.e);
  if (atEnd(c)) {
    fail(
      c,
      'this is not a condition',
      'write acute(A, B, C), AB < AC, P inside poly or A, B, C in order on l',
      l.span,
    );
    return undefined;
  }
  fail(
    c,
    `unexpected ${describe(t)}`,
    'write acute(A, B, C), AB < AC, P inside poly or A, B, C in order on l',
  );
  return undefined;
}
