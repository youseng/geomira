/**
 * The syntax tree of one line (parse-*.ts). Names are still names here; the builder
 * (build*.ts) resolves them to object ids and turns expressions into kernel Exprs.
 */
import type { Selector } from '@geomira/kernel/expr';
import type { Span } from './diagnostic';

export type ExprNode =
  /** An exact number as written, sign included (`-3/4`, `60°`). */
  | { readonly kind: 'num'; readonly text: string; readonly span: Span }
  | { readonly kind: 'name'; readonly name: string; readonly span: Span }
  /** A string literal, unescaped (ADR-0011: text's string). */
  | { readonly kind: 'str'; readonly value: string; readonly span: Span }
  | {
      readonly kind: 'call';
      readonly tool: string;
      readonly args: readonly ExprNode[];
      readonly selectors: readonly SelectorNode[];
      readonly span: Span;
      /**
       * Written as glued point names (ADR-0025): `AB` is line(A, B), `ABC` circle(A, B, C),
       * `ABCD…` polygon(A, B, C, D, …); as an argument the names are spread when the call
       * takes the points and not the line, circle or polygon (`midpoint(AB)`).
       */
      readonly glued?: boolean;
    }
  /** `(x, y)`: point(x, y). */
  | { readonly kind: 'pair'; readonly x: ExprNode; readonly y: ExprNode; readonly span: Span }
  | {
      readonly kind: 'binary';
      readonly op: 'add' | 'sub' | 'mul' | 'div';
      readonly left: ExprNode;
      readonly right: ExprNode;
      readonly span: Span;
    }
  | { readonly kind: 'neg'; readonly operand: ExprNode; readonly span: Span };

export type SelectorKind = Selector['kind'];

export type SelectorNode =
  | {
      readonly kind: Exclude<SelectorKind, 'along' | 'orient' | 'on_arc'>;
      readonly args: readonly ExprNode[];
      readonly span: Span;
    }
  | {
      readonly kind: 'on_arc';
      readonly args: readonly ExprNode[];
      readonly not: boolean;
      readonly span: Span;
    }
  | { readonly kind: 'along' | 'orient'; readonly sign: 1 | -1; readonly span: Span };

/** A claim or an assumption after notation: a kind and its arguments. */
export interface Condition {
  readonly kind: string;
  readonly args: readonly ExprNode[];
  readonly span: Span;
  /** Written as the relation `x = y` (equal), not as a kind call. */
  readonly relation?: boolean;
}

export interface AttrValue {
  readonly text: string;
  readonly kind: 'number' | 'word' | 'string' | 'stars';
  /** A `-` before a word (`layers=inv,-main` in views). */
  readonly minus: boolean;
  readonly span: Span;
}

/** `key`, `key=value` or `key=v1,v2,…` (a list takes the rest of its bracket group). */
export interface Attr {
  readonly key: string;
  readonly values: readonly AttrValue[] | null;
  readonly span: Span;
}

export interface NameRef {
  readonly name: string;
  readonly span: Span;
}

export type Statement =
  | {
      readonly kind: 'def';
      readonly target: NameRef;
      readonly expr: ExprNode;
      readonly attrs: readonly Attr[];
    }
  /** `point A`, `points A B C` (ADR-0025): free points at places drawn from the line. */
  | {
      readonly kind: 'points';
      readonly points: readonly NameRef[];
      readonly attrs: readonly Attr[];
      readonly span: Span;
    }
  /** `X, Y = intersect(a, b)` (ADR-0025): both branches of a two-candidate call. */
  | {
      readonly kind: 'branches';
      readonly targets: readonly NameRef[];
      readonly expr: ExprNode;
      readonly attrs: readonly Attr[];
      readonly span: Span;
    }
  | { readonly kind: 'claim'; readonly claim: Condition; readonly attrs: readonly Attr[] }
  | { readonly kind: 'assume'; readonly condition: Condition }
  | {
      readonly kind: 'triangle';
      readonly points: readonly NameRef[];
      readonly attrs: readonly Attr[];
      readonly span: Span;
    }
  | { readonly kind: 'style'; readonly target: NameRef; readonly attrs: readonly Attr[] }
  | { readonly kind: 'label'; readonly target: NameRef; readonly text: string }
  | { readonly kind: 'version'; readonly version: number; readonly span: Span }
  | { readonly kind: 'title' | 'author'; readonly text: string; readonly span: Span }
  | {
      readonly kind: 'layer';
      readonly target: NameRef;
      readonly image?: { readonly transform: NameRef; readonly source: NameRef };
      readonly attrs: readonly Attr[];
    }
  | { readonly kind: 'view'; readonly target: NameRef; readonly attrs: readonly Attr[] }
  | { readonly kind: 'viewport'; readonly values: readonly number[]; readonly span: Span };

/** A parsed line: its statement (if it has one and it parsed), comment and position. */
export interface Line {
  readonly line: number;
  readonly statement?: Statement;
  /** The statement had a syntax error (it is not applied). */
  readonly failed: boolean;
  readonly comment?: string;
}
