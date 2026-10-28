/**
 * Claim and assumption notation (SPEC §10–§11, ADR-0008's kinds, ADR-0009). A claim is a
 * kind call (`collinear(A, B, C)`, any ADR-0008 kind by name) or a relation:
 *   AB = CD, AB = k·CD (length) · AB/CD = EF/GH (ratio) · AB/CD = k (ratio_value) ·
 *   n∡ABC = ∡DEF (dangle) · ∡(l, m) = θ (dangle_lines) · ∠ABC = ∠DEF (angle_eq) ·
 *   ∠ABC + ∠DEF = θ, ∠ABC − ∠DEF = θ (angle_sum, angle_diff) · P = Q (equal) ·
 *   harmonic(A, B; C, D) · cross_ratio(A, B, C, D) = k (parse-cross-ratio.ts, ADR-0040).
 * A segment is two glued point names or dist(X, Y) (also written length(X, Y) or
 * distance(X, Y)); an angle ∠ABC, ∠(X, Y, Z) or angle(X, Y, Z); a directed angle ∡ABC or
 * ∡(X, Y, Z).
 * Assumptions (parse-condition.ts) compare the sides of this notation.
 */
import type { Condition, ExprNode } from './ast';
import { join, type Span } from './diagnostic';
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
import { parseExpr, parseUnary } from './parse-expr';
import { geomdrawClaim } from './parse-geomdraw';
import { crossRatioClaim } from './parse-cross-ratio';
import { TOOL_ALIASES } from './geomdraw';

export type Side =
  | { readonly t: 'seg'; readonly pts: readonly ExprNode[]; readonly span: Span }
  | {
      readonly t: 'scaled';
      readonly k: ExprNode;
      readonly pts: readonly ExprNode[];
      readonly span: Span;
    }
  | { readonly t: 'ratio'; readonly pts: readonly ExprNode[]; readonly span: Span }
  | {
      readonly t: 'dangle';
      readonly n?: ExprNode;
      readonly pts: readonly ExprNode[];
      readonly span: Span;
    }
  | { readonly t: 'dlines'; readonly pts: readonly ExprNode[]; readonly span: Span }
  | { readonly t: 'angle'; readonly pts: readonly ExprNode[]; readonly span: Span }
  | {
      readonly t: 'form';
      readonly minus: boolean;
      readonly pts: readonly ExprNode[];
      readonly span: Span;
    }
  | { readonly t: 'num'; readonly e: ExprNode; readonly span: Span }
  | { readonly t: 'expr'; readonly e: ExprNode; readonly span: Span };

const FORMS =
  'AB = k·CD, AB/CD = EF/GH, AB/CD = k, n∡ABC = ∡DEF, ∡(l, m) = θ, ∠ABC = ∠DEF, ∠ABC ± ∠DEF = θ, P = Q, or a call such as collinear(A, B, C)';

/** `name(…)` that spans the rest of the tokens (a kind call), or undefined. */
export function kindCall(c: Cursor, stopAtBracket: boolean): Condition | undefined {
  const t = peek(c);
  if (t?.kind !== 'name' || !isPunct(c, '(', 1)) return undefined;
  let depth = 0;
  let k = c.i + 1;
  for (; k < c.tokens.length; k++) {
    const u = c.tokens[k];
    if (u?.kind === 'punct' && u.value === '(') depth += 1;
    if (u?.kind === 'punct' && u.value === ')') depth -= 1;
    if (depth === 0) break;
  }
  const after = c.tokens[k + 1];
  const ends =
    after === undefined || (stopAtBracket && after.kind === 'punct' && after.value === '[');
  if (!ends) return undefined;
  const call = parseExpr(c);
  if (call?.kind !== 'call') return undefined;
  if (call.selectors.length > 0) {
    fail(
      c,
      `${call.tool}(…): a claim or an assumption takes no selectors`,
      'put the selector on the call that needs it',
      call.span,
    );
    return undefined;
  }
  return { kind: call.tool, args: call.args, span: call.span };
}

/** Point names glued together (`ABC`): their nodes. */
function gluedPoints(c: Cursor): ExprNode[] {
  const out: ExprNode[] = [];
  for (let t = peek(c); t?.kind === 'point' && (out.length === 0 || !t.spaceBefore); t = peek(c)) {
    next(c);
    out.push({ kind: 'name', name: t.value, span: t });
  }
  return out;
}

function parenArgs(c: Cursor, what: string): ExprNode[] | undefined {
  if (expect(c, '(', `write ${what}`) === undefined) return undefined;
  const out: ExprNode[] = [];
  for (;;) {
    const e = parseExpr(c);
    if (e === undefined) return undefined;
    out.push(e);
    if (!isPunct(c, ',')) break;
    next(c);
  }
  return expect(c, ')', `write ${what}`) === undefined ? undefined : out;
}

/**
 * The arguments of `word(…)` with a lone run of `n` glued names spread into its points, as in
 * definitions (ADR-0025 decision 4): `dist(AB)` is dist(A, B), `angle(ABC)` angle(A, B, C).
 */
function spreadArgs(c: Cursor, what: string, n: number): ExprNode[] | undefined {
  const args = parenArgs(c, what);
  const [only] = args ?? [];
  if (args?.length === 1 && only?.kind === 'call' && only.glued === true && only.args.length === n)
    return [...only.args];
  return args;
}

/** Three points: `ABC` glued or `(X, Y, Z)`; for ∡ also `(l, m)`. */
function anglePoints(c: Cursor, sym: string, lines: boolean): ExprNode[] | undefined {
  if (isPunct(c, '(')) {
    const start = here(c);
    const args = spreadArgs(c, `${sym}(X, Y, Z)`, 3);
    if (args === undefined) return undefined;
    if (args.length === 3 || (lines && args.length === 2)) return args;
    fail(
      c,
      `${sym}(…) takes three points${lines ? ' or two lines' : ''}`,
      `write ${sym}ABC or ${sym}(X, Y, Z)`,
      since(c, start),
    );
    return undefined;
  }
  const pts = gluedPoints(c);
  if (pts.length === 3) return pts;
  fail(
    c,
    `${sym} needs three point names, found ${String(pts.length)}`,
    `write ${sym}ABC (the angle at B)`,
  );
  return undefined;
}

function segOrRatio(c: Cursor, pts: readonly ExprNode[], start: Span): Side | undefined {
  if (!isPunct(c, '/')) return { t: 'seg', pts, span: since(c, start) };
  next(c);
  const den = parseSegment(c);
  return den === undefined
    ? undefined
    : { t: 'ratio', pts: [...pts, ...den], span: since(c, start) };
}

/** `dist(` or one of its other names (`length(`, `distance(`; ADR-0025 decision 6). */
function isDistAhead(c: Cursor): boolean {
  const t = peek(c);
  if (t?.kind !== 'name' || !isPunct(c, '(', 1)) return false;
  return (
    t.value === 'dist' || (Object.hasOwn(TOOL_ALIASES, t.value) && TOOL_ALIASES[t.value] === 'dist')
  );
}

/** A segment: `AB` or dist(X, Y) (also written length(X, Y), distance(X, Y)). */
function parseSegment(c: Cursor): ExprNode[] | undefined {
  if (isDistAhead(c)) {
    const start = here(c);
    const word = next(c)?.value ?? 'dist';
    const args = spreadArgs(c, `${word}(X, Y)`, 2);
    if (args === undefined) return undefined;
    if (args.length === 2) return args;
    fail(c, `${word} takes two points`, `write ${word}(X, Y)`, since(c, start));
    return undefined;
  }
  const pts = gluedPoints(c);
  if (pts.length === 2) return pts;
  fail(
    c,
    `expected a segment (two point names such as AB), found ${pts.length === 0 ? describe(peek(c)) : `${String(pts.length)} point names`}`,
    'write AB or dist(X, Y)',
  );
  return undefined;
}

function isSegmentAhead(c: Cursor): boolean {
  const [a, b, d] = [peek(c), peek(c, 1), peek(c, 2)];
  const pair = a?.kind === 'point' && b?.kind === 'point' && !b.spaceBefore;
  return pair && !(d?.kind === 'point' && !d.spaceBefore);
}

function parseAngleTerm(c: Cursor): ExprNode[] | undefined {
  if (isWord(c, 'angle')) {
    const start = here(c);
    next(c);
    const args = spreadArgs(c, 'angle(X, Y, Z)', 3);
    if (args === undefined) return undefined;
    if (args.length === 3) return args;
    fail(c, 'angle takes three points', 'write angle(X, Y, Z)', since(c, start));
    return undefined;
  }
  next(c);
  return anglePoints(c, '∠', false);
}

function angleSide(c: Cursor, start: Span): Side | undefined {
  const x = parseAngleTerm(c);
  if (x === undefined) return undefined;
  const t = peek(c);
  if (t?.kind === 'punct' && (t.value === '+' || t.value === '-')) {
    next(c);
    if (!(isPunct(c, '∠') || (isWord(c, 'angle') && isPunct(c, '(', 1)))) {
      fail(c, 'expected a second angle', 'write ∠ABC + ∠DEF = θ');
      return undefined;
    }
    const y = parseAngleTerm(c);
    return y === undefined
      ? undefined
      : { t: 'form', minus: t.value === '-', pts: [...x, ...y], span: since(c, start) };
  }
  return { t: 'angle', pts: x, span: since(c, start) };
}

function dangleSide(c: Cursor, start: Span, n?: ExprNode): Side | undefined {
  next(c);
  const pts = anglePoints(c, '∡', n === undefined);
  if (pts === undefined) return undefined;
  const span = since(c, start);
  if (pts.length === 2) return { t: 'dlines', pts, span };
  return n === undefined ? { t: 'dangle', pts, span } : { t: 'dangle', n, pts, span };
}

/** A number, k·AB, n∡ABC. */
function numberSide(c: Cursor, start: Span): Side | undefined {
  const k = parseUnary(c);
  if (k?.kind !== 'num') return k === undefined ? undefined : { t: 'expr', e: k, span: k.span };
  const mul = isPunct(c, '·') || isPunct(c, '*');
  if (mul) next(c);
  if (isPunct(c, '∡')) return dangleSide(c, start, k);
  if (!mul) return { t: 'num', e: k, span: k.span };
  const pts = parseSegment(c);
  return pts === undefined ? undefined : { t: 'scaled', k, pts, span: since(c, start) };
}

export function parseSide(c: Cursor): Side | undefined {
  const start = here(c);
  const t = peek(c);
  if (t?.kind === 'number' || (isPunct(c, '-') && peek(c, 1)?.kind === 'number'))
    return numberSide(c, start);
  if (isPunct(c, '∡')) return dangleSide(c, start);
  if (isPunct(c, '∠') || (isWord(c, 'angle') && isPunct(c, '(', 1))) return angleSide(c, start);
  if (isDistAhead(c) || isSegmentAhead(c)) {
    const pts = parseSegment(c);
    return pts === undefined ? undefined : segOrRatio(c, pts, start);
  }
  const e = parseExpr(c);
  return e === undefined ? undefined : { t: 'expr', e, span: e.span };
}

function one(text: string, span: Span): ExprNode {
  return { kind: 'num', text, span };
}

/** The claim kind and arguments of `l = r`. */
function relation(c: Cursor, l: Side, r: Side, eq: Span): Condition | undefined {
  const span = join(l.span, r.span);
  if (l.t === 'seg' && r.t === 'seg')
    return { kind: 'length', args: [...l.pts, ...r.pts, one('1', eq)], span };
  if (l.t === 'seg' && r.t === 'scaled')
    return { kind: 'length', args: [...l.pts, ...r.pts, r.k], span };
  if (l.t === 'ratio' && r.t === 'ratio')
    return { kind: 'ratio', args: [...l.pts, ...r.pts], span };
  if (l.t === 'ratio' && r.t === 'num') return { kind: 'ratio_value', args: [...l.pts, r.e], span };
  if (l.t === 'dangle' && r.t === 'dangle' && r.n === undefined) {
    return { kind: 'dangle', args: [l.n ?? one('1', eq), ...l.pts, ...r.pts], span };
  }
  if (l.t === 'dlines' && r.t === 'num')
    return { kind: 'dangle_lines', args: [...l.pts, r.e], span };
  if (l.t === 'angle' && r.t === 'angle')
    return { kind: 'angle_eq', args: [...l.pts, ...r.pts], span };
  if (l.t === 'form' && r.t === 'num') {
    return { kind: l.minus ? 'angle_diff' : 'angle_sum', args: [...l.pts, r.e], span };
  }
  if (l.t === 'expr' && r.t === 'expr')
    return { kind: 'equal', args: [l.e, r.e], span, relation: true };
  fail(c, 'this relation is not a claim the language knows', `write ${FORMS}`, span);
  return undefined;
}

/** The body of `claim …` (attributes, if any, follow). */
export function parseClaim(c: Cursor): Condition | undefined {
  const cross = crossRatioClaim(c);
  if (cross !== 'none') return cross;
  const call = kindCall(c, true);
  if (call !== undefined || c.diags.length > 0) return call;
  const infix = geomdrawClaim(c);
  if (infix !== undefined) return infix;
  const l = parseSide(c);
  if (l === undefined) return undefined;
  const eq = peek(c);
  if (!isPunct(c, '=')) {
    fail(c, `expected "=", found ${describe(eq)}`, `a claim is a relation or a call: ${FORMS}`);
    return undefined;
  }
  next(c);
  const r = parseSide(c);
  return r === undefined || eq === undefined ? undefined : relation(c, l, r, eq);
}
