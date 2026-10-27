/**
 * The v1 tools of Runs 2, 3a, 3b, 4 and 8a, the v1.1 tools of Run 13 and the inversion tools
 * of Run 14 (ADR-0032), in registry order (read only by registry.ts; the generated docs group
 * them by family).
 */
import { withGuarantees } from '../guarantees';
import { withMapFacts } from '../map-facts';
import type { ToolSpec } from '../tool';
import { ARC_TOOLS } from './arc';
import { ARITHMETIC_TOOLS } from './arithmetic';
import { CIRCLE_MEASURE_TOOLS } from './circle-measures';
import { CIRCLE_TOOLS, NINEPOINT_CENTER_TOOL } from './circles';
import { CONJUGATE_TOOLS } from './conjugates';
import { DISPLAY_TOOLS } from './display';
import { FUNCTION_TOOLS } from './functions';
import { INCIRCLE_TOOLS } from './incircle';
import { INTERSECT_TOOLS } from './intersect';
import { LINE_TOOLS } from './lines';
import { MARK_TOOLS } from './marks';
import { MEASURE_TOOLS } from './measures';
import { GLIDER_TOOLS } from './on';
import { OTHER_TOOLS } from './other';
import { POINT_TOOLS } from './points';
import { POLE_TOOLS } from './poles';
import { TANGENT_FROM_TOOLS } from './tangent-from';
import { TANGENT_TOOLS } from './tangents';
import { TRANSFORM_TOOLS } from './transforms';
import { TRIANGLE_TOOLS } from './triangle';
import { INVERSION_TOOLS } from '../transform/inversion-tools';

export const BUILTIN_TOOLS: readonly ToolSpec[] = Object.freeze(
  [
    ...POINT_TOOLS,
    ...INTERSECT_TOOLS,
    ...TRIANGLE_TOOLS,
    ...LINE_TOOLS,
    ...MEASURE_TOOLS,
    ...DISPLAY_TOOLS,
    ...ARITHMETIC_TOOLS,
    ...CIRCLE_TOOLS,
    ...GLIDER_TOOLS,
    ...OTHER_TOOLS,
    ...TANGENT_TOOLS,
    ...INCIRCLE_TOOLS,
    ...FUNCTION_TOOLS,
    NINEPOINT_CENTER_TOOL,
    ...CIRCLE_MEASURE_TOOLS,
    ...TANGENT_FROM_TOOLS,
    ...TRANSFORM_TOOLS,
    ...MARK_TOOLS,
    ...CONJUGATE_TOOLS,
    ...POLE_TOOLS,
    ...ARC_TOOLS,
    ...INVERSION_TOOLS,
  ]
    .map(withGuarantees)
    .map(withMapFacts),
);
