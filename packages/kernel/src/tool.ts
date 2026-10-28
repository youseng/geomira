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
 * What an argument symmetry keeps (ADR-0029): 'value' — the permuted call has exactly the
 * same value (a point, a number); 'figure' — the same figure (the same point set), but a
 * direction, an anchor or a vertex order may differ (line(A, B) and line(B, A) have
 * opposite directions). Only 'value' symmetries apply inside nested calls, where a
 * direction or an anchor can matter (along(±), gliders).
 */
export type Sameness = 'value' | 'figure';

/**
 * A symmetry of an overload's arguments, as data (ADR-0029; read by construction-key.ts and
 * the generated docs):
 *   - 'permute': any order of the arguments at `positions` (0-based) gives the same
 *     construction; `flipsOrient`: an odd permutation also flips orient(±) (intersect of two
 *     circles labels its points by the orientation from the first centre to the second);
 *   - 'dihedral': any rotation or reversal of ALL the arguments (a polygon's vertices).
 */
export type ArgSymmetry =
  | {
      readonly kind: 'permute';
      readonly positions: readonly number[];
      readonly same: Sameness;
      readonly flipsOrient?: true;
    }
  | { readonly kind: 'dihedral'; readonly same: Sameness };

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
   * The argument symmetries of the overload (ADR-0029): two calls that differ only by one
   * are the same construction, and the editor and the language refuse the second.
   */
  readonly symmetry?: readonly ArgSymmetry[];
  /**
   * The kinds this overload's result can have, when narrower than the tool's outputKinds
   * (Run 4: reflect(l) is a transform, reflect(X, l) has X's kind). Read by the static
   * kinds of derived layers (derived.ts).
   */
  readonly output?: readonly ValueKind[];
  /**
   * The index of an argument whose kind the result has (an image has its figure's kind:
   * reflect(X, l) and apply(T, X) preserve X). The static kinds narrow `output` to the kinds
   * that argument can have, so the image of a line is a line, never a circle (kinds.ts).
   */
  readonly preserves?: number;
  /**
   * The overload's VALUE needs a square root or a trigonometric function (√, sin, cos,
   * atan2), even of an exact argument (sqrt(9/4), rotate(O, 90)). Square roots taken only
   * to normalise a decision do not count (exact fields fall back to the exact test). Read
   * by packages/claims: a closure with such an overload never uses the mod-p rung (SPEC
   * §10.5, law L17; ADR-0008). The candidates of a two-candidate branch overload need roots
   * too, unless the call selects with other(P); that rule reads BranchShape instead.
   */
  readonly radical?: boolean;
  /**
   * Positions of number arguments that carry an absolute SIZE (a length or an area), such as
   * an inversion's power (ADR-0032 decision 14): a random similarity of the figure would
   * change their meaning, so packages/claims' samplers do not apply one unless they map them.
   */
  readonly absolute?: readonly number[];
  /**
   * The facts the overload's result has BY DEFINITION (ADR-0035), as claim templates: the
   * claim kind's name (packages/claims) and its arguments over the call. Read by the generated
   * docs and by packages/discovery, which hides such facts ("construction facts") instead of
   * reporting them as findings. Every declared guarantee is property-tested there.
   */
  readonly guarantees?: readonly Guarantee[];
  /**
   * What the transform this overload builds does (ADR-0039): its type, fixed points and curves,
   * centre, ratio, turn and known images, as data over the call. Read by the generated docs and
   * by packages/discovery, which hides facts that hold by the map alone. Property-tested there.
   */
  readonly map?: MapFacts;
  /**
   * The overload's result is the image of argument `of` under the map `map` (a term over the
   * call: `apply(T, X)` is { of: 1, map: 0 }; `reflect(X, l)` is { of: 0, map: reflect(#2) }).
   */
  readonly imageOf?: ImageOf;
}

/**
 * How a map acts (ADR-0039). A similarity keeps every v1 claim kind (directed angles reversed
 * when anti); an inversion keeps equal points, incidence and tangency, takes clines to clines,
 * and has a centre; another Möbius map keeps incidence, tangency and clines; a projective map
 * (ADR-0040) keeps equal points, the incidence of points and lines and cross ratios, never
 * lengths, angles, circles or tangency.
 */
export type MapType = 'similarity' | 'anti-similarity' | 'inversion' | 'moebius' | 'projective';

/** A map's facts as data over its call (ADR-0039); terms as in guarantees. */
export interface MapFacts {
  readonly type: MapType;
  /** Applying the map twice is the identity. */
  readonly involution?: boolean;
  /** |X*Y*| / |XY| of a similarity: an exact literal, or a number argument (its absolute value). */
  readonly ratio?: GuaranteeTerm;
  /** A direct similarity's turn, in degrees: every direction turns by it (mod 180°). */
  readonly turn?: GuaranteeTerm;
  /** Points the map fixes. */
  readonly fixedPoints?: readonly GuaranteeTerm[];
  /** A curve the map fixes point by point (the mirror line, the inversion circle). */
  readonly fixedCurve?: GuaranteeTerm;
  /** Curves the map takes onto themselves (not necessarily point by point). */
  readonly invariantCurves?: readonly GuaranteeTerm[];
  /** An inversion's centre: X, X* and the centre are collinear; its own image is Undefined. */
  readonly center?: GuaranteeTerm;
  /**
   * A homothety's signed ratio k about its first fixed point P: X* − P = k·(X − P), so P, X and
   * X* are collinear and XX* = |k − 1|·PX.
   */
  readonly factor?: GuaranteeTerm;
  /** Known images: [X, the image of X] (points or curves). */
  readonly sends?: readonly (readonly [GuaranteeTerm, GuaranteeTerm])[];
}

/** The image an overload's result is: argument `of` under the map `map` (ADR-0039). */
export interface ImageOf {
  readonly of: number;
  readonly map: GuaranteeTerm;
}

/**
 * A term of a guarantee (ADR-0035): the call's result, one of its arguments (0-based), a
 * nested call of a registry tool over such terms (`midpoint(0, 1)`), or an exact literal.
 */
export type GuaranteeTerm =
  | 'result'
  | number
  | { readonly tool: string; readonly args: readonly GuaranteeTerm[] }
  | { readonly lit: string };

/** A claim that holds for every call of the overload where its objects are defined. */
export interface Guarantee {
  /** A claim kind of packages/claims (the kernel stores claims as data, ADR-0003 item 5). */
  readonly claim: string;
  readonly args: readonly GuaranteeTerm[];
}

/**
 * A construction the Asymptote exporter writes by name (SPEC §14, ADR-0014): one helper
 * function or builtin per op, the variant chosen by the argument kinds and count of the
 * overload a call resolves to (foot(P, l) or foot(P, A, B); intersect of lines or curves;
 * reflect(l) or reflect(P), or the image sugar reflect(X, …)).
 */
export type ExportOp =
  | 'midpoint'
  | 'foot'
  | 'circumcenter'
  | 'centroid'
  | 'orthocenter'
  | 'incenter'
  | 'intersect'
  | 'line'
  | 'segment'
  | 'ray'
  | 'circle'
  | 'circumcircle'
  | 'incircle'
  | 'polygon'
  | 'reflect'
  | 'rotate'
  | 'homothety'
  | 'translate'
  | 'spiral'
  | 'compose'
  | 'inverse'
  | 'apply'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'neg';

/**
 * How exporters write a tool's result: 'numeric' (the value's coordinates), or
 * constructively (ADR-0014; ADR-0003 item 11 had every tool 'numeric' until the export run).
 */
export type ExportMapping = 'numeric' | { readonly constructive: ExportOp };

/**
 * An example argument, as exact text: a point `[x, y]`, a number `"2/3"`, a line-like
 * object through two points, a polygon, a string `{ text }`, or any nested call (`circle(O, A)` as
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
  /** A string literal (text's string, ADR-0011). */
  | { readonly text: string }
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
  /**
   * A free input (SPEC §5: point, on, param): its calls hold free state that drags and the
   * samplers change independently, so a definition with such a call anywhere is never the
   * same construction as another (ADR-0029).
   */
  readonly input?: true;
  /**
   * Every call of this tool is the call of `sameAs` with the same arguments
   * (circumcircle(A, B, C) is circle(A, B, C)): the same construction (ADR-0029).
   */
  readonly sameAs?: string;
  readonly export: ExportMapping;
  readonly doc: string;
  readonly examples: readonly ToolExample[];
}

/** "midpoint(point, point)", "polygon(point, point, point, point…)". */
export function formatSignature(name: string, s: Signature): string {
  const params = s.rest === undefined ? s.params : [...s.params, `${s.rest}…`];
  return `${name}(${params.join(', ')})`;
}
