/**
 * The selector syntax of SPEC §7 (ADR-0006): each kernel selector kind with its form,
 * arity and usage, and the conversion from parsed arguments to the kernel's Selector.
 * Selectors are the trailing arguments of a branchable call.
 */
import { assertNever } from '@geomira/num/assert';
import type { Expr, Selector } from '@geomira/kernel/expr';
import type { SelectorKind } from './ast';

export interface SelectorSyntax {
  readonly kind: SelectorKind;
  /** exprs: fixed expression arguments; sign: `(+)` / `(-)`; on_arc also takes `not`. */
  readonly form: 'exprs' | 'sign';
  readonly arity: number;
  readonly usage: string;
  readonly doc: string;
}

/** The syntax of each selector (a Record over the kinds: the compiler checks it is complete). */
const SYNTAX: Readonly<Record<SelectorKind, Omit<SelectorSyntax, 'kind'>>> = {
  same_side: {
    form: 'exprs',
    arity: 2,
    usage: 'same_side(Q, l)',
    doc: 'filter: on the side of line l where Q is',
  },
  opposite_side: {
    form: 'exprs',
    arity: 2,
    usage: 'opposite_side(Q, l)',
    doc: 'filter: on the other side of line l from Q',
  },
  on_arc: {
    form: 'exprs',
    arity: 3,
    usage: 'on_arc(B, C, A) or on_arc(B, C, not A)',
    doc: 'filter: on the arc BC that contains A (not: the other arc)',
  },
  between: {
    form: 'exprs',
    arity: 2,
    usage: 'between(A, B)',
    doc: 'filter: strictly between the perpendiculars to AB at A and at B',
  },
  inside: { form: 'exprs', arity: 1, usage: 'inside(c)', doc: 'filter: inside circle c' },
  outside: { form: 'exprs', arity: 1, usage: 'outside(c)', doc: 'filter: outside circle c' },
  other: {
    form: 'exprs',
    arity: 1,
    usage: 'other(P), or other(P, Q, R) on conic ∩ conic',
    doc: 'ranker: the intersection other than P (exact: no square root); on conic ∩ conic other(P, Q, R), the fourth common point',
  },
  near: { form: 'exprs', arity: 1, usage: 'near(P)', doc: 'ranker: the candidate nearer to P' },
  far_from: {
    form: 'exprs',
    arity: 1,
    usage: 'far_from(P)',
    doc: 'ranker: the candidate farther from P',
  },
  along: {
    form: 'sign',
    arity: 0,
    usage: 'along(+) or along(-)',
    doc: "low-level, line ∩ circle: further (+) or less far (-) along the line's direction",
  },
  orient: {
    form: 'sign',
    arity: 0,
    usage: 'orient(+) or orient(-)',
    doc: 'low-level, circle ∩ circle and tangent choices: the side by orientation',
  },
};

function entry(kind: SelectorKind): SelectorSyntax {
  return { kind, ...SYNTAX[kind] };
}

const KINDS: readonly SelectorKind[] = [
  'same_side',
  'opposite_side',
  'on_arc',
  'between',
  'inside',
  'outside',
  'other',
  'near',
  'far_from',
  'along',
  'orient',
];

/** Every selector, in SPEC §7's order (filters, rankers, low-level). */
export const SELECTOR_SYNTAX: readonly SelectorSyntax[] = Object.freeze(KINDS.map(entry));

export function selectorSyntax(name: string): SelectorSyntax | undefined {
  return SELECTOR_SYNTAX.find((s) => s.kind === name);
}

/** The kernel selector of a parsed one (arguments already converted, in order). */
export function makeSelector(
  kind: SelectorKind,
  args: readonly Expr[],
  not: boolean,
  sign: 1 | -1,
): Selector | undefined {
  const [a, b, c] = args;
  switch (kind) {
    case 'same_side':
    case 'opposite_side':
      return a === undefined || b === undefined ? undefined : { kind, q: a, l: b };
    case 'on_arc':
      return a === undefined || b === undefined || c === undefined
        ? undefined
        : { kind, b: a, c: b, a: c, not };
    case 'between':
      return a === undefined || b === undefined ? undefined : { kind, a, b };
    case 'inside':
    case 'outside':
      return a === undefined ? undefined : { kind, c: a };
    case 'other':
      if (a !== undefined && b !== undefined && c !== undefined && args.length === 3)
        return { kind: 'other', p: a, rest: [b, c] };
      return a === undefined || args.length !== 1 ? undefined : { kind: 'other', p: a };
    case 'near':
    case 'far_from':
      return a === undefined ? undefined : { kind, p: a };
    case 'along':
    case 'orient':
      return { kind, sign };
    default:
      return assertNever(kind, 'selector kind');
  }
}
