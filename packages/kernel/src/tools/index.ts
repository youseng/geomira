/** The v1 tools of Run 2, in documentation order (read only by registry.ts). */
import type { ToolSpec } from '../tool';
import { ARITHMETIC_TOOLS } from './arithmetic';
import { DISPLAY_TOOLS } from './display';
import { INTERSECT_TOOLS } from './intersect';
import { LINE_TOOLS } from './lines';
import { MEASURE_TOOLS } from './measures';
import { POINT_TOOLS } from './points';
import { TRIANGLE_TOOLS } from './triangle';

export const BUILTIN_TOOLS: readonly ToolSpec[] = Object.freeze([
  ...POINT_TOOLS,
  ...INTERSECT_TOOLS,
  ...TRIANGLE_TOOLS,
  ...LINE_TOOLS,
  ...MEASURE_TOOLS,
  ...DISPLAY_TOOLS,
  ...ARITHMETIC_TOOLS,
]);
