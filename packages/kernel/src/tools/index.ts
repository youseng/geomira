/**
 * The v1 tools of Runs 2 and 3a, in registry order (read only by registry.ts; the generated
 * docs group them by family).
 */
import type { ToolSpec } from '../tool';
import { ARITHMETIC_TOOLS } from './arithmetic';
import { CIRCLE_TOOLS } from './circles';
import { DISPLAY_TOOLS } from './display';
import { INCIRCLE_TOOLS } from './incircle';
import { INTERSECT_TOOLS } from './intersect';
import { LINE_TOOLS } from './lines';
import { MEASURE_TOOLS } from './measures';
import { GLIDER_TOOLS } from './on';
import { OTHER_TOOLS } from './other';
import { POINT_TOOLS } from './points';
import { TANGENT_TOOLS } from './tangents';
import { TRIANGLE_TOOLS } from './triangle';

export const BUILTIN_TOOLS: readonly ToolSpec[] = Object.freeze([
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
]);
