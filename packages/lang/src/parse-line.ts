/**
 * Statements (SPEC §11.1, ADR-0009), one per line:
 *   name = expr [attrs] · claim <claim> [name=…] · assume <condition> ·
 *   triangle A B C [type] · style X [attrs] · label X "…" · @version N · @title "…" ·
 *   @author "…" · @layer name [attrs] · @layer name = image(T, source) [attrs] ·
 *   @view name attrs · @viewport cx cy zoom · # comment
 * and Geomdraw's conveniences (ADR-0025): `point A`, `points A B C` (free points) and
 * `X, Y = intersect(a, b)` (both branches of a two-candidate call).
 */
import type { Attr, ExprNode, Line, NameRef, Statement } from './ast';
import { hasErrors, type Diagnostic } from './diagnostic';
import {
  atEnd,
  cursor,
  describe,
  expect,
  fail,
  isPunct,
  isWord,
  next,
  peek,
  since,
  type Cursor,
} from './cursor';
import { lexLine } from './lexer';
import { floatLiteral } from './lex-literals';
import { parseAttrs } from './parse-attrs';
import { parseExpr } from './parse-expr';
import { parseClaim, parseCondition } from './parse-notation';

export interface ParsedLine {
  readonly line: Line;
  readonly diagnostics: readonly Diagnostic[];
}

/** Parses one line (1-based number `line`). Total: syntax errors become diagnostics. */
export function parseLine(src: string, line: number): ParsedLine {
  const lexed = lexLine(src, line);
  const base = lexed.comment === undefined ? { line } : { line, comment: lexed.comment };
  const lexFailed = hasErrors(lexed.diagnostics);
  if (lexed.tokens.length === 0)
    return { line: { ...base, failed: lexFailed }, diagnostics: lexed.diagnostics };
  if (lexFailed) return { line: { ...base, failed: true }, diagnostics: lexed.diagnostics };
  const c = cursor(lexed.tokens, line, src.length + 1);
  const s = statement(c);
  if (s !== undefined && !atEnd(c))
    fail(c, `unexpected ${describe(peek(c))}`, 'remove it, or start a new line');
  const ok = s !== undefined && c.diags.length === 0;
  return {
    line: ok ? { ...base, statement: s, failed: false } : { ...base, failed: true },
    diagnostics: [...lexed.diagnostics, ...c.diags],
  };
}

function nameRef(c: Cursor, what: string): NameRef | undefined {
  const t = next(c);
  if (t?.kind === 'name' || t?.kind === 'point') return { name: t.value, span: t };
  fail(c, `expected ${what}, found ${describe(t)}`, `write the ${what}`, t);
  return undefined;
}

function statement(c: Cursor): Statement | undefined {
  const t = peek(c);
  if (t?.kind === 'directive') return directive(c);
  if (t?.kind === 'name' && !isPunct(c, '=', 1)) {
    switch (t.value) {
      case 'claim':
        return claim(c);
      case 'assume': {
        next(c);
        const condition = parseCondition(c);
        return condition === undefined ? undefined : { kind: 'assume', condition };
      }
      case 'triangle':
        return triangle(c);
      case 'point':
      case 'points':
        return points(c);
      case 'style': {
        next(c);
        const target = nameRef(c, 'object name');
        const attrs = target === undefined ? undefined : parseAttrs(c, false);
        return target === undefined || attrs === undefined
          ? undefined
          : { kind: 'style', target, attrs };
      }
      case 'label':
        return label(c);
      default:
        break;
    }
  }
  if ((t?.kind === 'name' || t?.kind === 'point') && isPunct(c, '=', 1)) return definition(c);
  if ((t?.kind === 'name' || t?.kind === 'point') && isPunct(c, ',', 1)) return branches(c);
  fail(
    c,
    `expected a statement, found ${describe(t)}`,
    'write name = expression, points A B C, claim …, assume …, or a directive such as @version 1',
  );
  return undefined;
}

function definition(c: Cursor): Statement | undefined {
  const target = nameRef(c, 'name');
  next(c);
  const expr: ExprNode | undefined = target === undefined ? undefined : parseExpr(c);
  const attrs = expr === undefined ? undefined : parseAttrs(c, false);
  return target === undefined || expr === undefined || attrs === undefined
    ? undefined
    : { kind: 'def', target, expr, attrs };
}

/** `X, Y = call(…)`: two names, then the call whose two branches they name. */
function branches(c: Cursor): Statement | undefined {
  const start = peek(c);
  const targets: NameRef[] = [];
  for (;;) {
    const n = nameRef(c, 'name');
    if (n === undefined) return undefined;
    targets.push(n);
    if (!isPunct(c, ',')) break;
    next(c);
  }
  if (expect(c, '=', 'write X, Y = intersect(a, b)') === undefined || start === undefined)
    return undefined;
  const expr = parseExpr(c);
  const attrs = expr === undefined ? undefined : parseAttrs(c, false);
  return expr === undefined || attrs === undefined
    ? undefined
    : { kind: 'branches', targets, expr, attrs, span: since(c, start) };
}

/** `point A` / `points A B C [attrs]`: free points (names glued or apart). */
function points(c: Cursor): Statement | undefined {
  const start = next(c);
  const names: NameRef[] = [];
  for (let t = peek(c); t?.kind === 'point'; t = peek(c)) {
    next(c);
    names.push({ name: t.value, span: t });
  }
  if (names.length === 0 || start === undefined) {
    fail(c, `${start?.value ?? 'points'} takes point names`, 'write points A B C');
    return undefined;
  }
  const attrs = parseAttrs(c, false);
  return attrs === undefined
    ? undefined
    : { kind: 'points', points: names, attrs, span: since(c, start) };
}

function claim(c: Cursor): Statement | undefined {
  next(c);
  const body = parseClaim(c);
  const attrs = body === undefined ? undefined : parseAttrs(c, false);
  return body === undefined || attrs === undefined
    ? undefined
    : { kind: 'claim', claim: body, attrs };
}

function triangle(c: Cursor): Statement | undefined {
  const start = next(c);
  const points: NameRef[] = [];
  for (let t = peek(c); t?.kind === 'point' && points.length < 3; t = peek(c)) {
    next(c);
    points.push({ name: t.value, span: t });
  }
  if (points.length !== 3 || start === undefined) {
    fail(
      c,
      `triangle takes three point names, found ${String(points.length)}`,
      'write triangle A B C [acute]',
    );
    return undefined;
  }
  const words = triangleWords(c, points);
  const attrs = words === undefined ? undefined : parseAttrs(c, false);
  return attrs === undefined || words === undefined
    ? undefined
    : { kind: 'triangle', points, attrs: [...words, ...attrs], span: since(c, start) };
}

/**
 * Geomdraw's bare triangle types (ADR-0025): `triangle ABC acute`, `scalene`, `obtuse` (at the
 * first vertex) or `obtuse_at_B`, each the attribute of that name. A right angle is
 * constructed, never assumed (SPEC §6.2).
 */
function triangleWords(c: Cursor, points: readonly NameRef[]): Attr[] | undefined {
  const out: Attr[] = [];
  for (let t = peek(c); t?.kind === 'name'; t = peek(c)) {
    next(c);
    if (t.value === 'right') {
      fail(
        c,
        'a right angle is constructed, never assumed',
        'build C on the perpendicular: C = on(perp(A, AB), 3)',
        t,
      );
      return undefined;
    }
    const key = t.value === 'obtuse' ? `obtuse_at_${points[0]?.name ?? 'A'}` : t.value;
    out.push({ key, values: null, span: t });
  }
  return out;
}

function label(c: Cursor): Statement | undefined {
  next(c);
  const target = nameRef(c, 'object name');
  const s = next(c);
  if (target === undefined) return undefined;
  if (s?.kind !== 'string') {
    fail(
      c,
      `expected the label text in quotes, found ${describe(s)}`,
      `write label ${target.name} "text"`,
      s,
    );
    return undefined;
  }
  return { kind: 'label', target, text: s.value };
}

function directive(c: Cursor): Statement | undefined {
  const d = next(c);
  if (d === undefined) return undefined;
  switch (d.value) {
    case 'version': {
      const n = next(c);
      const v = n?.kind === 'number' && /^[0-9]+$/u.test(n.text) ? Number(n.text) : NaN;
      if (Number.isSafeInteger(v)) return { kind: 'version', version: v, span: since(c, d) };
      fail(c, '@version takes a whole number', 'write @version 1', n);
      return undefined;
    }
    case 'title':
    case 'author': {
      const s = next(c);
      if (s?.kind !== 'string') {
        fail(c, `@${d.value} takes a quoted text`, `write @${d.value} "…"`, s);
        return undefined;
      }
      return { kind: d.value, text: s.value, span: since(c, d) };
    }
    case 'layer':
      return layer(c);
    case 'view': {
      const target = nameRef(c, 'view name');
      const attrs = target === undefined ? undefined : parseAttrs(c, true);
      return target === undefined || attrs === undefined
        ? undefined
        : { kind: 'view', target, attrs };
    }
    case 'viewport':
      return viewport(c, d);
    default: {
      fail(
        c,
        `unknown directive @${d.value}`,
        'directives: @version, @title, @author, @layer, @view, @viewport',
        d,
      );
      return undefined;
    }
  }
}

function layer(c: Cursor): Statement | undefined {
  const target = nameRef(c, 'layer name');
  if (target === undefined) return undefined;
  if (!isPunct(c, '=')) {
    const attrs = parseAttrs(c, true);
    return attrs === undefined ? undefined : { kind: 'layer', target, attrs };
  }
  next(c);
  if (!isWord(c, 'image')) {
    fail(
      c,
      `expected image(T, source), found ${describe(peek(c))}`,
      `write @layer ${target.name} = image(T, main)`,
    );
    return undefined;
  }
  next(c);
  if (expect(c, '(', 'write image(T, source)') === undefined) return undefined;
  const transform = nameRef(c, 'transformation name');
  if (transform === undefined || expect(c, ',', 'write image(T, source)') === undefined)
    return undefined;
  const source = nameRef(c, 'source layer name');
  if (source === undefined || expect(c, ')', 'write image(T, source)') === undefined)
    return undefined;
  const attrs = parseAttrs(c, true);
  return attrs === undefined
    ? undefined
    : { kind: 'layer', target, image: { transform, source }, attrs };
}

function signedFloat(c: Cursor): number | undefined {
  const minus = isPunct(c, '-');
  if (minus) next(c);
  const n = next(c);
  const x =
    n?.kind === 'number' && (!minus || !n.spaceBefore)
      ? floatLiteral((minus ? '-' : '') + n.text)
      : undefined;
  return x;
}

function viewport(
  c: Cursor,
  d: { readonly line: number; readonly column: number; readonly endColumn: number },
): Statement | undefined {
  const values: number[] = [];
  for (let k = 0; k < 3; k++) {
    const x = signedFloat(c);
    if (x === undefined) {
      fail(
        c,
        '@viewport takes three numbers: center x, center y and zoom',
        'write @viewport 0 0 50',
      );
      return undefined;
    }
    values.push(x);
  }
  return { kind: 'viewport', values, span: since(c, d) };
}
