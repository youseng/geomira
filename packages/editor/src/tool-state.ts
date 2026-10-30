/**
 * The tool part of the editor's state (SPEC §12: "GUI tools are data; one state machine runs
 * them"): which tool is active and what it has collected so far. The tools themselves are
 * data in tools.ts; machine.ts advances them.
 */

/** Every GUI tool (tools.ts holds one ToolUI per id; `move` selects and drags). */
export type ToolId =
  | 'move'
  | 'point'
  | 'glider'
  | 'intersection'
  | 'second_intersection'
  | 'midpoint'
  | 'line'
  | 'segment'
  | 'ray'
  | 'parallel'
  | 'perpendicular'
  | 'perp_bisector'
  | 'bisector'
  | 'ext_bisector'
  | 'symmedian'
  | 'symmedian_point'
  | 'polar'
  | 'radical_axis'
  | 'circle'
  | 'circle_radius'
  | 'circle3'
  | 'conic5'
  | 'diameter_circle'
  | 'arc'
  | 'circumcircle'
  | 'incircle'
  | 'excircle'
  | 'ninepoint_circle'
  | 'centroid'
  | 'circumcenter'
  | 'incenter'
  | 'orthocenter'
  | 'ninepoint_center'
  | 'excenter'
  | 'isogonal'
  | 'spiral_center'
  | 'pole'
  | 'radical_center'
  | 'tangent'
  | 'foot'
  | 'reflect'
  | 'rotate'
  | 'translate'
  | 'homothety'
  | 'spiral'
  | 'apply_map'
  | 'inversion'
  | 'sqrt_bc'
  | 'sqrt_bc2'
  | 'feet_inversion'
  | 'inversion_fixing'
  | 'polygon'
  | 'mark_angle'
  | 'mark_right'
  | 'mark_segment'
  | 'text'
  | 'measure_distance'
  | 'measure_angle'
  | 'measure_ratio'
  | 'measure_area'
  | 'measure_power'
  | 'claim'
  | 'derived_layer';

/**
 * What `ToolState.typed` is keyed by: a tool, or (ADR-0051) the claim tool's kind, whose
 * numbers differ in meaning (k = 2 for AB = k·CD, θ = 90 for ∡(l, m) = θ).
 */
export type TypedKey = ToolId | `claim:${string}`;

export interface ToolState {
  /** Objects picked for the active tool, in the order they were picked. */
  readonly picks: readonly number[];
  /**
   * The step each pick fills: picks[i] fills step slots[i]. A tool whose picks come in a
   * fixed order fills 0, 1, 2, …; an order-free tool (ToolUI.anyOrder) fills the step its
   * click fits, so a line may be picked before the point (ADR-0024).
   */
  readonly slots: readonly number[];
  /** The claim kind of the claim tool (a CLAIM_KINDS name). */
  readonly claimKind: string;
  /** The text of the number a tool asks for (rotate's angle, homothety's ratio, a radius). */
  readonly value: string;
  /**
   * The last number typed for each tool that asks for one: a tool switch gives it back, so
   * the field "keeps the last number for the next use" (ADR-0024 item 5).
   */
  readonly typed: Readonly<Partial<Record<TypedKey, string>>>;
  /**
   * The claim tool's steps filled by TWO points (ADR-0051): picks with such a slot give
   * line(first, second); a slot here with one pick so far waits for its second point.
   */
  readonly pairs?: readonly number[];
  /**
   * The map tools (reflect, rotate, translate, homothety, spiral; ToolUI.map) build the
   * transformation alone, `f = reflect(l)`, instead of an object's image (Run 13, ADR-0031):
   * the object step is left out. Kept across builds and across switches between map tools.
   */
  readonly mapOnly?: true;
}

export const DEFAULT_CLAIM_KIND = 'collinear';

export function idleTool(
  claimKind: string = DEFAULT_CLAIM_KIND,
  value = '',
  typed: ToolState['typed'] = {},
  mapOnly = false,
): ToolState {
  const ts: ToolState = { picks: [], slots: [], claimKind, value, typed };
  return mapOnly ? { ...ts, mapOnly: true } : ts;
}
