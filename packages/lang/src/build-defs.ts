/**
 * Definitions and style statements (`triangle`: build-triangle.ts). Styles from `style X` / `label X` lines are
 * collected first and applied when X is created (so they may sit anywhere, and a [noimage]
 * style is known before X's images would be made). A statement with an error is not
 * applied: its name is remembered as failed, so later uses say which line to fix.
 */
import type { Style } from '@geomira/kernel/document';
import { MAIN_LAYER_ID } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import { formatExpr } from '@geomira/kernel/selector';
import type { Attr, ExprNode, Line, NameRef, Statement } from './ast';
import { STYLE_KEYS, byKey, namesAttr, styleOf } from './attr-values';
import { checkCalls, convert } from './build-expr';
import { exprEnv } from './build-env';
import { addDefinition } from './build-objects';
import { nameOf, type State } from './build-state';
import { error, hasErrors } from './diagnostic';
import { freePlaces } from './free-points';
import { polygonName } from './triangle';

type Def = Extract<Statement, { kind: 'def' }>;

/** The text of an expression with the document's names. */
export function show(st: State): (e: Expr) => string {
  return (e) => formatExpr(e, (id) => nameOf(st, id));
}

/** Converts and checks an expression; undefined when it has an error (reported). */
export function expression(st: State, node: ExprNode): Expr | undefined {
  const n = st.diags.length;
  const conv = convert(node, exprEnv(st));
  if (conv === undefined || hasErrors(st.diags.slice(n))) return undefined;
  const found = checkCalls(conv, st.registry, (id) => st.staticKinds.get(id), st.kinds, show(st));
  st.diags.push(...found);
  return found.length > 0 ? undefined : conv.expr;
}

/** First pass: every defined name with its line, and the triangles' polygon names. */
export function collectNames(st: State, lines: readonly Line[]): Map<number, string> {
  const polys = new Map<number, string>();
  const note = (name: string, line: number): void => {
    if (!st.defLines.has(name)) st.defLines.set(name, line);
  };
  for (const l of lines) {
    const s = l.statement;
    if (s?.kind === 'def') note(s.target.name, l.line);
    if (s?.kind === 'triangle' || s?.kind === 'points')
      for (const p of s.points) note(p.name, l.line);
    if (s?.kind === 'branches') for (const t of s.targets) note(t.name, l.line);
  }
  for (const l of lines) {
    const s = l.statement;
    if (s?.kind !== 'triangle') continue;
    const name = polygonName(
      s.points.map((p) => p.name),
      (x) => st.defLines.has(x),
    );
    note(name, l.line);
    polys.set(l.line, name);
  }
  return polys;
}

/** First pass: `style X …` and `label X "…"` lines, merged per name in text order. */
export function collectStyles(st: State, lines: readonly Line[]): Set<number> {
  const bad = new Set<number>();
  for (const l of lines) {
    const s = l.statement;
    if (s?.kind !== 'style' && s?.kind !== 'label') continue;
    const n = st.diags.length;
    const style: Style =
      s.kind === 'label'
        ? { label: s.text }
        : styleOf(byKey(s.attrs, STYLE_KEYS, 'style', { diags: st.diags }), { diags: st.diags });
    if (st.diags.length > n) {
      bad.add(l.line);
      continue;
    }
    const p = st.styles.get(s.target.name) ?? { style: {}, spans: [], used: false };
    p.style = { ...p.style, ...style };
    p.spans.push(s.target.span);
    st.styles.set(s.target.name, p);
  }
  return bad;
}

/** The style and layers of a definition's attributes (with the waiting style statements). */
function attrsOf(
  st: State,
  name: string,
  attrs: readonly Attr[],
): { style: Style; layers: string[] } | undefined {
  const n = st.diags.length;
  const m = byKey(attrs, [...STYLE_KEYS, 'layers'], 'a definition', { diags: st.diags });
  let style = styleOf(m, { diags: st.diags });
  const ls = m.get('layers');
  const layers: string[] = [];
  for (const v of ls === undefined ? [] : namesAttr(ls, false, { diags: st.diags })) {
    const id = st.layerIds.get(v.text);
    if (id === undefined)
      st.diags.push(error(v.span, `there is no layer "${v.text}"`, 'declare it with @layer'));
    else layers.push(id);
  }
  if (st.diags.length > n) return undefined;
  const pending = st.styles.get(name);
  if (pending !== undefined) {
    pending.used = true;
    style = { ...style, ...pending.style };
  }
  return { style, layers: layers.length === 0 ? [MAIN_LAYER_ID] : layers };
}

export function define(
  st: State,
  target: NameRef,
  node: ExprNode,
  attrs: readonly Attr[],
  line: number,
): number | undefined {
  st.line = line;
  const def = expression(st, node);
  const a = def === undefined ? undefined : attrsOf(st, target.name, attrs);
  const id =
    def === undefined || a === undefined
      ? undefined
      : addDefinition(st, { name: target.name, span: target.span, def, ...a });
  if (id === undefined) st.failed.set(target.name, line);
  return id;
}

/** A free point at the place drawn for its names (`A = point()`, `points A B`; ADR-0025). */
export function freePoint(p: NameRef, place: readonly [string, string]): ExprNode {
  const num = (text: string): ExprNode => ({ kind: 'num', text, span: p.span });
  return { kind: 'pair', x: num(place[0]), y: num(place[1]), span: p.span };
}

export function definition(st: State, s: Def, line: number): number | undefined {
  const e = s.expr;
  const bare = e.kind === 'call' && e.tool === 'point' && e.args.length === 0;
  const place =
    bare && e.selectors.length === 0 ? freePlaces('point', [s.target.name])[0] : undefined;
  const expr = place === undefined ? e : freePoint(s.target, place);
  return define(st, s.target, expr, s.attrs, line);
}
