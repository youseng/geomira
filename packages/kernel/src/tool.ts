/**
 * ToolSpec (SPEC §6.1). A tool is data plus ONE field-generic `compute<T>`; nothing
 * outside the registry enumerates tools. No tool up to Run 3a is branchable, so ToolSpec
 * has no `candidates` and `compute` takes no selectors yet (ADR-0003, item 10).
 */
import type { Field } from '@geomira/num/field';
import type { ToleranceContext } from '@geomira/num/tolerance';
import type { Capability, Value, ValueKind } from './value';

/** The evaluation context (SPEC §3.1): `scale` = figure diameter, ≥ 1. */
export type EvalContext = ToleranceContext;

export type ToolFamily =
  'points' | 'lines' | 'circles' | 'transformations' | 'measures' | 'display' | 'arithmetic';

/**
 * One overload: a capability per parameter; `rest` accepts any number of further
 * arguments of one capability (polygon(A, B, C, …)).
 */
export interface Signature {
  readonly params: readonly Capability[];
  readonly rest?: Capability;
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

export interface ToolExample {
  readonly args: readonly ExampleArg[];
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
   * Undefined with a reason, a non-representable number gives Inexact.
   */
  compute<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext): Value<T>;
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
