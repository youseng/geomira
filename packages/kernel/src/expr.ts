/**
 * Definitions (SPEC §5): Expr = Ref | Lit (exact) | Call(tool, Expr[], selectors).
 * Nested calls are trees; inline subexpressions have no identity. References are by
 * object id (ADR-0003), so renaming never rewrites a definition.
 */
import { assertNever } from '@geomira/num/assert';
import { eq as rationalEq, type Rational } from '@geomira/num/rational';

export interface RefExpr {
  readonly kind: 'ref';
  readonly id: number;
}

/** An exact number literal (`2`, `0.1`, `2/3`, `-3/4`). */
export interface LitExpr {
  readonly kind: 'lit';
  readonly value: Rational;
}

export interface CallExpr {
  readonly kind: 'call';
  readonly tool: string;
  readonly args: readonly Expr[];
  readonly selectors: readonly Selector[];
}

export type Expr = RefExpr | LitExpr | CallExpr;

/**
 * Branch selectors (SPEC §7), stored as syntax. Filters: same_side, opposite_side,
 * on_arc, between, inside, outside. Rankers: other, near, far_from. Low-level: along,
 * orient. Run 2 has no branchable tool, so evaluation rejects calls that carry selectors
 * (ADR-0003); the shapes are part of the document model already.
 */
export type Selector =
  | { readonly kind: 'same_side'; readonly q: Expr; readonly l: Expr }
  | { readonly kind: 'opposite_side'; readonly q: Expr; readonly l: Expr }
  | {
      readonly kind: 'on_arc';
      readonly b: Expr;
      readonly c: Expr;
      readonly a: Expr;
      readonly not: boolean;
    }
  | { readonly kind: 'between'; readonly a: Expr; readonly b: Expr }
  | { readonly kind: 'inside'; readonly c: Expr }
  | { readonly kind: 'outside'; readonly c: Expr }
  | { readonly kind: 'other'; readonly p: Expr }
  | { readonly kind: 'near'; readonly p: Expr }
  | { readonly kind: 'far_from'; readonly p: Expr }
  | { readonly kind: 'along'; readonly sign: 1 | -1 }
  | { readonly kind: 'orient'; readonly sign: 1 | -1 };

export function ref(id: number): RefExpr {
  return { kind: 'ref', id };
}

export function lit(value: Rational): LitExpr {
  return { kind: 'lit', value };
}

export function call(
  tool: string,
  args: readonly Expr[],
  selectors: readonly Selector[] = [],
): CallExpr {
  return { kind: 'call', tool, args, selectors };
}

/** The expressions inside a selector, in order. */
export function selectorExprs(s: Selector): readonly Expr[] {
  switch (s.kind) {
    case 'same_side':
    case 'opposite_side':
      return [s.q, s.l];
    case 'on_arc':
      return [s.b, s.c, s.a];
    case 'between':
      return [s.a, s.b];
    case 'inside':
    case 'outside':
      return [s.c];
    case 'other':
    case 'near':
    case 'far_from':
      return [s.p];
    case 'along':
    case 'orient':
      return [];
    default:
      return assertNever(s, 'selector');
  }
}

/** Every referenced object id, in order of appearance (with repetitions). */
export function refsOf(e: Expr): number[] {
  const out: number[] = [];
  collectRefs(e, out);
  return out;
}

function collectRefs(e: Expr, out: number[]): void {
  switch (e.kind) {
    case 'ref':
      out.push(e.id);
      return;
    case 'lit':
      return;
    case 'call':
      for (const a of e.args) collectRefs(a, out);
      for (const s of e.selectors) for (const a of selectorExprs(s)) collectRefs(a, out);
      return;
    default:
      assertNever(e, 'expression');
  }
}

/** Structural equality of two expressions (literals by exact value). */
export function exprEquals(a: Expr, b: Expr): boolean {
  switch (a.kind) {
    case 'ref':
      return b.kind === 'ref' && a.id === b.id;
    case 'lit':
      return b.kind === 'lit' && rationalEq(a.value, b.value);
    case 'call':
      return (
        b.kind === 'call' &&
        a.tool === b.tool &&
        listEquals(a.args, b.args) &&
        a.selectors.length === b.selectors.length &&
        a.selectors.every((s, i) => {
          const t = b.selectors[i];
          return t !== undefined && selectorEquals(s, t);
        })
      );
    default:
      return assertNever(a, 'expression');
  }
}

function listEquals(a: readonly Expr[], b: readonly Expr[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      return y !== undefined && exprEquals(x, y);
    })
  );
}

function selectorEquals(s: Selector, t: Selector): boolean {
  if (s.kind !== t.kind) return false;
  if (s.kind === 'along' || s.kind === 'orient') {
    return t.kind === s.kind && s.sign === t.sign;
  }
  if (s.kind === 'on_arc' && t.kind === 'on_arc' && s.not !== t.not) return false;
  return listEquals(selectorExprs(s), selectorExprs(t));
}
