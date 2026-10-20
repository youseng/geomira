/**
 * ToolSpec (SPEC §6.1). A tool is data plus ONE field-generic `compute<T>`; nothing
 * outside the registry enumerates tools. Branchable tools (SPEC §7: intersect of curves,
 * tangent_point, tangent_from) also list their candidates, and their overloads carry a
 * BranchShape; `compute` receives the evaluated selectors as its last, optional argument
 * (ADR-0006, which supersedes ADR-0003 item 10).
 */
import type { Field } from '@geomira/num/field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import type { EvaluatedSelector } from './selector';
import type { Capability, Value, ValueKind } from './value';

/** The evaluation context (SPEC §3.1): `scale` = figure diameter, ≥ 1. */
export type EvalContext = ToleranceContext;

export type ToolFamily =
  'points' | 'lines' | 'circles' | 'transformations' | 'measures' | 'display' | 'arithmetic';

/**
 * How a branchable overload chooses among its candidates (SPEC §7, ADR-0006). The
 * evaluator and the static check (selector-check.ts) read it.
 */
export interface BranchShape {
  /** The most candidates the overload can have (line ∩ line: 1, line ∩ circle: 2). */
  readonly candidates: 1 | 2;
  /** The low-level selector it accepts: along(±) on line ∩ circle, orient(±) on circle ∩ circle and tangent choices. */
  readonly low: 'along' | 'orient' | 'none';
  /** Whether other(P) applies (two objects that can meet twice). */
  readonly other: boolean;
  /** "line ∩ circle", "circle ∩ circle", "tangent choices": named in messages. */
  readonly describe: string;
}

/**
 * One overload: a capability per parameter; `rest` accepts any number of further
 * arguments of one capability (polygon(A, B, C, …)); `branch` marks an overload of a
 * branchable tool; `output` narrows the result kinds of the overload.
 */
export interface Signature {
  readonly params: readonly Capability[];
  readonly rest?: Capability;
  readonly branch?: BranchShape;
  /**
   * The kinds this overload's result can have, when narrower than the tool's outputKinds
   * (Run 4: reflect(l) is a transform, reflect(X, l) has X's kind). Read by the static
   * kinds of derived layers (derived.ts).
   */
  readonly output?: readonly ValueKind[];
}

/** How exporters draw a tool's result (ADR-0003: every Run 2 tool is 'numeric'). */
export type ExportMapping = 'numeric';

/**
 * An example argument, as exact text: a point `[x, y]`, a number `"2/3"`, a line-like
 * object through two points, a polygon, or any nested call (`circle(O, A)` as
 * `{ call: 'circle', args: [O, A] }`).
 */
export type ExampleArg =
  | readonly [string, string]
  | string
  | {
      readonly through: readonly [readonly [string, string], readonly [string, string]];
      readonly as: 'line' | 'segment' | 'ray';
    }
  | { readonly polygon: readonly (readonly [string, string])[] }
  | { readonly call: string; readonly args: readonly ExampleArg[] };

/** A selector of an example call (the kinds the examples use). */
export type ExampleSelector =
  | { readonly kind: 'along' | 'orient'; readonly sign: 1 | -1 }
  | { readonly kind: 'other' | 'near' | 'far_from'; readonly p: ExampleArg };

export interface ToolExample {
  readonly args: readonly ExampleArg[];
  readonly selectors?: readonly ExampleSelector[];
}

export interface ToolSpec {
  /** Stable identifier (equal to `name` for every v1 tool). */
  readonly id: string;
  /** The name used in the language. */
  readonly name: string;
  readonly family: ToolFamily;
  /** Overloads, tried in order. */
  readonly signatures: readonly Signature[];
  /** The kinds a successful result can have. */
  readonly outputKinds: readonly ValueKind[];
  /**
   * The ONLY implementation, over any field. Called with arguments that match one of the
   * signatures (the registry resolves them); must be total: degenerate input gives
   * Undefined with a reason, a non-representable number gives Inexact. A branchable tool
   * applies `selectors` (in order) to its candidates; the evaluator never passes selectors
   * to a tool without `candidates` ("<tool> takes no selectors").
   */
  compute<T>(
    F: Field<T>,
    args: readonly Value<T>[],
    ctx: EvalContext,
    selectors?: readonly EvaluatedSelector<T>[],
  ): Value<T>;
  /**
   * Branchable tools only (SPEC §6.1): the values a call can select, 0–2 (a double point
   * is one), in a fixed order; a value that is not representable in F is Inexact.
   */
  candidates?<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): readonly Value<T>[];
  /** The degenerate cases, each tested by name (packages/kernel/test/degenerate.test.ts). */
  readonly degenerate: readonly string[];
  readonly export: ExportMapping;
  readonly doc: string;
  readonly examples: readonly ToolExample[];
}

/** "midpoint(point, point)", "polygon(point, point, point, point…)". */
export function formatSignature(name: string, s: Signature): string {
  const params = s.rest === undefined ? s.params : [...s.params, `${s.rest}…`];
  return `${name}(${params.join(', ')})`;
}
