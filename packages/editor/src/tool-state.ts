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
  | 'midpoint'
  | 'line'
  | 'segment'
  | 'ray'
  | 'parallel'
  | 'perpendicular'
  | 'perp_bisector'
  | 'bisector'
  | 'circle'
  | 'circle3'
  | 'tangent'
  | 'foot'
  | 'reflect'
  | 'polygon'
  | 'mark_angle'
  | 'mark_right'
  | 'mark_segment'
  | 'text'
  | 'measure_distance'
  | 'measure_angle'
  | 'claim'
  | 'derived_layer';

/**
 * A branchable call waiting for the user to click the candidate they mean (intersection of
 * two curves with two candidates, a tangent from a point outside a circle).
 */
export interface Choosing {
  readonly tool: 'intersect' | 'tangent_from';
  readonly args: readonly number[];
}

export interface ToolState {
  /** Objects picked for the active tool, in order. */
  readonly picks: readonly number[];
  /** Set when the tool waits for a click on one of two candidates. */
  readonly choosing: Choosing | null;
  /** The claim kind of the claim tool (a CLAIM_KINDS name). */
  readonly claimKind: string;
}

export const DEFAULT_CLAIM_KIND = 'collinear';

export function idleTool(claimKind: string = DEFAULT_CLAIM_KIND): ToolState {
  return { picks: [], choosing: null, claimKind };
}
