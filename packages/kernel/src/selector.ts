/**
 * Branch selectors as values (SPEC §7; ADR-0006). The document stores selectors as syntax
 * (`Selector` in expr.ts); the evaluator evaluates their expressions and hands the tool an
 * EvaluatedSelector per selector, in order. This module also states which selectors are
 * ORIENTATION-DEPENDENT (SPEC §7, law L16): `orient(±)`, and `along(±)` on a line whose
 * `chiral` flag is set. Every other selector is reflection-equivariant.
 */
import { assertNever } from '@geomira/num/assert';
import { formatRational } from '@geomira/num/rational';
import type { Expr, Selector } from './expr';
import type { Value } from './value';

export type SelectorKind = Selector['kind'];

/** A selector whose expressions (selectorExprs order) are evaluated. */
export interface EvaluatedSelector<T> {
  readonly selector: Selector;
  /** The values of selectorExprs(selector), in order. */
  readonly args: readonly Value<T>[];
  /** The selector as text, for messages: "same_side(Q, l)", "along(+)". */
  readonly text: string;
}

/** The three classes of SPEC §7: filters keep, rankers pick, low-level selectors label. */
export type SelectorClass = 'filter' | 'ranker' | 'low-level';

export function selectorClass(kind: SelectorKind): SelectorClass {
  switch (kind) {
    case 'same_side':
    case 'opposite_side':
    case 'on_arc':
    case 'between':
    case 'inside':
    case 'outside':
      return 'filter';
    case 'other':
    case 'near':
    case 'far_from':
      return 'ranker';
    case 'along':
    case 'orient':
      return 'low-level';
    default:
      return assertNever(kind, 'selector kind');
  }
}

/**
 * SPEC §7's exact definition: a selector is orientation-dependent iff it is `orient(±)`,
 * or `along(±)` on a line with `chiral = true` (`line` is the line `along` measures on:
 * the line argument of a line ∩ circle call; null when there is none).
 */
export function isOrientationDependent(
  selector: { readonly kind: SelectorKind },
  line: { readonly chiral: boolean } | null,
): boolean {
  switch (selector.kind) {
    case 'orient':
      return true;
    case 'along':
      return line?.chiral === true;
    case 'same_side':
    case 'opposite_side':
    case 'on_arc':
    case 'between':
    case 'inside':
    case 'outside':
    case 'other':
    case 'near':
    case 'far_from':
      return false;
    default:
      return assertNever(selector.kind, 'selector kind');
  }
}

/** An expression as text: names for references (#id when unnamed), exact literals. */
export function formatExpr(e: Expr, name: (id: number) => string | undefined): string {
  switch (e.kind) {
    case 'ref':
      return name(e.id) ?? `#${String(e.id)}`;
    case 'lit':
      return formatRational(e.value);
    case 'str':
      return `"${e.value.replace(/["\\]/gu, (c) => `\\${c}`)}"`;
    case 'call': {
      const parts = [
        ...e.args.map((a) => formatExpr(a, name)),
        ...e.selectors.map((s) => formatSelector(s, (x) => formatExpr(x, name))),
      ];
      return `${e.tool}(${parts.join(', ')})`;
    }
    default:
      return assertNever(e, 'expression');
  }
}

/** A selector as text in the language's syntax: "on_arc(B, C, not A)", "orient(-)". */
export function formatSelector(s: Selector, show: (e: Expr) => string): string {
  switch (s.kind) {
    case 'same_side':
    case 'opposite_side':
      return `${s.kind}(${show(s.q)}, ${show(s.l)})`;
    case 'on_arc':
      return `on_arc(${show(s.b)}, ${show(s.c)}, ${s.not ? 'not ' : ''}${show(s.a)})`;
    case 'between':
      return `between(${show(s.a)}, ${show(s.b)})`;
    case 'inside':
    case 'outside':
      return `${s.kind}(${show(s.c)})`;
    case 'other':
      return s.rest === undefined
        ? `other(${show(s.p)})`
        : `other(${[s.p, ...s.rest].map(show).join(', ')})`;
    case 'near':
    case 'far_from':
      return `${s.kind}(${show(s.p)})`;
    case 'along':
    case 'orient':
      return `${s.kind}(${s.sign === 1 ? '+' : '-'})`;
    default:
      return assertNever(s, 'selector');
  }
}
