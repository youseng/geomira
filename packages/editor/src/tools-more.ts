/**
 * GUI tools after the maintainer's Geomdraw palette (ADR-0024), over kernel tools that were
 * only reachable from the text: the second intersection, the external bisector, the polar,
 * the radical axis, the circle on a diameter and the circle with a typed radius, rotation,
 * translation, homothety and spiral similarity, and the ratio, area and power measures. Keys
 * follow Geomdraw's where it has one (E second intersection, D circle on a diameter, R
 * rotate, Z homothety); the others take a Shift letter (shown ⇧X).
 */
import { anyOrder, C, call, mapTool, P, withValue, type ToolStep, type ToolUI } from './tool-ui';

const FIGURE = (prompt: string): ToolStep => ({ pick: 'figure', prompt });

export const SECOND_INTERSECTION: ToolUI = anyOrder(
  call(
    'second_intersection',
    'Second intersection',
    'e',
    'other',
    'point',
    [
      { pick: 'curve', prompt: 'first curve' },
      { pick: 'curve', prompt: 'second curve' },
      P('the common point you know'),
    ],
    'The other common point of two curves through a known one (exact, no square root).',
  ),
);

export const EXT_BISECTOR: ToolUI = call(
  'ext_bisector',
  'External bisector',
  'B',
  'ext_bisector',
  'line',
  [P('point on the first arm'), P('vertex'), P('point on the second arm')],
  'The external bisector of angle ABC (at B).',
);

export const POLAR: ToolUI = anyOrder(
  call(
    'polar',
    'Polar',
    'P',
    'polar',
    'line',
    [P('pole'), C('circle')],
    'The polar of a point with respect to a circle (click them in either order).',
  ),
);

export const RADICAL_AXIS: ToolUI = call(
  'radical_axis',
  'Radical axis',
  'R',
  'radical_axis',
  'line',
  [C('first circle'), C('second circle')],
  'The radical axis of two circles.',
);

export const CIRCLE_RADIUS: ToolUI = withValue(
  call(
    'circle_radius',
    'Circle (center, radius)',
    'C',
    'circle',
    'circle',
    [P('center')],
    'The circle with a center and the radius typed in the tool’s field.',
  ),
  'Radius',
  '1',
);

export const DIAMETER_CIRCLE: ToolUI = call(
  'diameter_circle',
  'Circle on a diameter',
  'd',
  'diameter_circle',
  'circle',
  [P('first end of the diameter'), P('second end of the diameter')],
  'The circle with diameter AB.',
);

/**
 * Rotation, translation, homothety and spiral similarity of an object (after Reflect); with
 * “Transformation only” (ToolState.mapOnly) each builds the map itself (rotate(O, 60)).
 */
export const MAP_TOOLS: readonly ToolUI[] = (
  [
    withValue(
      call(
        'rotate',
        'Rotate',
        'r',
        'rotate',
        'point',
        [FIGURE('object to rotate'), P('center')],
        'The image of an object under the rotation about a center by the angle typed in the tool’s field (degrees, counterclockwise).',
      ),
      'Angle (degrees)',
      '60',
    ),
    call(
      'translate',
      'Translate',
      'V',
      'translate',
      'point',
      [FIGURE('object to translate'), P('start of the vector'), P('end of the vector')],
      'The image of an object under the translation by vector AB.',
    ),
    withValue(
      call(
        'homothety',
        'Homothety',
        'z',
        'homothety',
        'point',
        [FIGURE('object to scale'), P('center')],
        'The image of an object under the homothety with a center and the ratio typed in the tool’s field.',
      ),
      'Ratio k',
      '2',
    ),
    {
      // A point may be picked twice: spiral(X, A, B, A, C) is the spiral similarity about A
      // taking B to C, the olympiad's usual one.
      ...call(
        'spiral',
        'Spiral similarity',
        'S',
        'spiral',
        'point',
        [FIGURE('object to map'), P('A'), P('B'), P('the image of A'), P('the image of B')],
        'The image of an object under the spiral similarity taking A to C and B to D (A may be its own image: the spiral about A).',
      ),
      repeats: true,
    },
  ] satisfies ToolUI[]
).map(mapTool);

/** Measures beside distance and angle (the Measure / Claim group). */
export const MEASURE_TOOLS: readonly ToolUI[] = [
  {
    ...call(
      'measure_ratio',
      'Ratio',
      'Q',
      'ratio',
      'number',
      [P('A'), P('B'), P('C'), P('D')],
      'The ratio of lengths AB / CD (a point may be picked twice, as A in AB / AC).',
    ),
    repeats: true,
  },
  call(
    'measure_area',
    'Area',
    'A',
    'area',
    'number',
    [P('first vertex'), P('second vertex'), P('third vertex')],
    'The area of triangle ABC.',
  ),
  anyOrder(
    call(
      'measure_power',
      'Power of a point',
      'O',
      'power',
      'number',
      [P('point'), C('circle')],
      'The power of a point with respect to a circle (click them in either order).',
    ),
  ),
];
