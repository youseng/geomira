/**
 * The GUI tools in labelled groups, as DATA for the tool palette (Run 9b, ADR-0016): every
 * tool of the tool table belongs to exactly one group (the Record makes the compiler check
 * it), and a group lists its tools in the table's order. Presentation only: the tools, their
 * keys and their help stay in tools.ts.
 */
import type { ToolId } from './tool-state';
import { TOOLS, type ToolUI } from './tools';

export type ToolGroupId =
  'points' | 'lines' | 'circles' | 'centers' | 'transform' | 'marks' | 'measure';

export interface ToolGroup {
  readonly id: ToolGroupId;
  readonly label: string;
  readonly tools: readonly ToolUI[];
}

const GROUP_OF: Readonly<Record<ToolId, ToolGroupId>> = {
  move: 'points',
  point: 'points',
  glider: 'points',
  intersection: 'points',
  second_intersection: 'points',
  midpoint: 'points',
  foot: 'points',
  line: 'lines',
  segment: 'lines',
  ray: 'lines',
  parallel: 'lines',
  perpendicular: 'lines',
  perp_bisector: 'lines',
  bisector: 'lines',
  ext_bisector: 'lines',
  symmedian: 'lines',
  symmedian_point: 'lines',
  tangent: 'lines',
  polar: 'lines',
  radical_axis: 'lines',
  polygon: 'lines',
  circle: 'circles',
  circle_radius: 'circles',
  circle3: 'circles',
  conic5: 'circles',
  diameter_circle: 'circles',
  arc: 'circles',
  circumcircle: 'circles',
  incircle: 'circles',
  excircle: 'circles',
  ninepoint_circle: 'circles',
  centroid: 'centers',
  circumcenter: 'centers',
  incenter: 'centers',
  orthocenter: 'centers',
  ninepoint_center: 'centers',
  excenter: 'centers',
  exsimilicenter: 'centers',
  insimilicenter: 'centers',
  isogonal: 'centers',
  spiral_center: 'centers',
  radical_center: 'centers',
  pole: 'points',
  reflect: 'transform',
  rotate: 'transform',
  translate: 'transform',
  homothety: 'transform',
  spiral: 'transform',
  apply_map: 'transform',
  inversion: 'transform',
  sqrt_bc: 'transform',
  sqrt_bc2: 'transform',
  feet_inversion: 'transform',
  inversion_fixing: 'transform',
  derived_layer: 'transform',
  mark_angle: 'marks',
  mark_right: 'marks',
  mark_segment: 'marks',
  text: 'marks',
  measure_distance: 'measure',
  measure_angle: 'measure',
  measure_ratio: 'measure',
  measure_area: 'measure',
  measure_power: 'measure',
  claim: 'measure',
};

const LABELS: readonly { readonly id: ToolGroupId; readonly label: string }[] = [
  { id: 'points', label: 'Points' },
  { id: 'lines', label: 'Lines' },
  { id: 'circles', label: 'Circles' },
  { id: 'centers', label: 'Centers' },
  { id: 'transform', label: 'Transform' },
  { id: 'marks', label: 'Marks' },
  { id: 'measure', label: 'Measure / Claim' },
];

/** The groups in palette order, each with its tools in the tool table's order. */
export const TOOL_GROUPS: readonly ToolGroup[] = Object.freeze(
  LABELS.map((g) => ({ ...g, tools: TOOLS.filter((t) => GROUP_OF[t.id] === g.id) })),
);

/** The group of a tool. */
export function toolGroup(id: ToolId): ToolGroupId {
  return GROUP_OF[id];
}

/** How a tool's key is shown on its button: a letter in capitals, "⇧N" for a Shift letter. */
export function keyCap(key: string): string {
  return key === key.toLowerCase() ? key.toUpperCase() : `⇧${key}`;
}
