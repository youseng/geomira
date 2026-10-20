/**
 * Paths into definitions (internal). A path is the list of child indices from a
 * definition's root to a sub-expression; the children of a call are its arguments, then
 * the expressions of its selectors in order (selectorExprs). Used to address free inputs
 * (samplers rewrite their literals) and selectors (the orientation flip test).
 */
import { assertNever } from '@geomira/num/assert';
import { selectorExprs, type CallExpr, type Expr, type Selector } from '@geomira/kernel/expr';

export type Path = readonly number[];

export function children(e: Expr): readonly Expr[] {
  return e.kind === 'call' ? [...e.args, ...e.selectors.flatMap((s) => selectorExprs(s))] : [];
}

/** The sub-expression at `path`, or undefined when the path leaves the tree. */
export function exprAt(e: Expr, path: Path): Expr | undefined {
  let cur: Expr | undefined = e;
  for (const i of path) cur = cur === undefined ? undefined : children(cur)[i];
  return cur;
}

/** A selector of the same kind with its expressions replaced, in selectorExprs order. */
function withExprs(s: Selector, xs: readonly Expr[]): Selector {
  const at = (i: number): Expr => xs[i] ?? selectorExprs(s)[i] ?? { kind: 'ref', id: -1 };
  switch (s.kind) {
    case 'same_side':
    case 'opposite_side':
      return { kind: s.kind, q: at(0), l: at(1) };
    case 'on_arc':
      return { kind: 'on_arc', b: at(0), c: at(1), a: at(2), not: s.not };
    case 'between':
      return { kind: 'between', a: at(0), b: at(1) };
    case 'inside':
    case 'outside':
      return { kind: s.kind, c: at(0) };
    case 'other':
    case 'near':
    case 'far_from':
      return { kind: s.kind, p: at(0) };
    case 'along':
    case 'orient':
      return s;
    default:
      return assertNever(s, 'selector');
  }
}

/** The call with child i replaced (arguments first, then selector expressions). */
function replaceChild(e: CallExpr, i: number, x: Expr): CallExpr {
  if (i < e.args.length) return { ...e, args: e.args.map((a, k) => (k === i ? x : a)) };
  let offset = e.args.length;
  const selectors = e.selectors.map((s) => {
    const xs = selectorExprs(s);
    const local = i - offset;
    offset += xs.length;
    return local >= 0 && local < xs.length
      ? withExprs(
          s,
          xs.map((y, k) => (k === local ? x : y)),
        )
      : s;
  });
  return { ...e, selectors };
}

/** e with the sub-expression at `path` replaced by f(it); unchanged when the path is invalid. */
export function replaceAt(e: Expr, path: Path, f: (x: Expr) => Expr): Expr {
  const [head, ...rest] = path;
  if (head === undefined) return f(e);
  if (e.kind !== 'call') return e;
  const child = children(e)[head];
  return child === undefined ? e : replaceChild(e, head, replaceAt(child, rest, f));
}

/** Every call in e with its path, in pre-order. */
export function callsOf(
  e: Expr,
  path: Path = [],
): { readonly call: CallExpr; readonly path: Path }[] {
  if (e.kind !== 'call') return [];
  return [{ call: e, path }, ...children(e).flatMap((c, i) => callsOf(c, [...path, i]))];
}

/** The call at `path` with selector `index` turned to the opposite sign (along / orient only). */
export function flipSelector(e: Expr, path: Path, index: number): Expr {
  return replaceAt(e, path, (x) => {
    if (x.kind !== 'call') return x;
    const selectors = x.selectors.map((s, k) =>
      k === index && (s.kind === 'along' || s.kind === 'orient')
        ? ({ kind: s.kind, sign: s.sign === 1 ? -1 : 1 } as const)
        : s,
    );
    return { ...x, selectors };
  });
}
