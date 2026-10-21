/**
 * The triangle centres and circles as GUI tools (ADR-0016 decision 21): pick three points
 * A, B, C, as for the kernel tools of the same name. Keys: Geomdraw's chord digits for the
 * five centres it numbers (centroid 1, circumcentre 2, incentre 3, orthocentre 4, nine-point
 * centre 5; Geomdraw types them after G, which is the glider here), the free digits 6–9 for
 * the excentre and three circles, and Shift+N for the nine-point circle (every lowercase
 * letter is taken). The excentre and the excircle are the ones opposite the first pick.
 */
import { call, P, type ToolStep, type ToolUI } from './tool-ui';

const TRIANGLE: readonly ToolStep[] = [P('first vertex'), P('second vertex'), P('third vertex')];

const OPPOSITE: readonly ToolStep[] = [
  P('vertex the excircle is opposite'),
  P('second vertex'),
  P('third vertex'),
];

/** Circles of a triangle (the Circles group). */
export const TRIANGLE_CIRCLE_TOOLS: readonly ToolUI[] = [
  call(
    'circumcircle',
    'Circumcircle',
    '7',
    'circumcircle',
    'circle',
    TRIANGLE,
    'The circle through the three vertices of triangle ABC.',
  ),
  call(
    'incircle',
    'Incircle',
    '8',
    'incircle',
    'circle',
    TRIANGLE,
    'The circle inside triangle ABC tangent to its three sides.',
  ),
  call(
    'excircle',
    'Excircle',
    '9',
    'excircle',
    'circle',
    OPPOSITE,
    'The excircle of triangle ABC opposite A, tangent to BC and to lines AB, AC.',
  ),
  call(
    'ninepoint_circle',
    'Nine-point circle',
    'N',
    'ninepoint_circle',
    'circle',
    TRIANGLE,
    'The circle through the midpoints of the sides of triangle ABC.',
  ),
];

/** Centres of a triangle (the Centers group; labels spelt as the rest of the interface). */
export const CENTRE_TOOLS: readonly ToolUI[] = [
  call(
    'centroid',
    'Centroid',
    '1',
    'centroid',
    'point',
    TRIANGLE,
    'The centroid G of triangle ABC, where its medians meet.',
  ),
  call(
    'circumcenter',
    'Circumcentre',
    '2',
    'circumcenter',
    'point',
    TRIANGLE,
    'The circumcentre O of triangle ABC, the centre of the circle through A, B, C.',
  ),
  call(
    'incenter',
    'Incentre',
    '3',
    'incenter',
    'point',
    TRIANGLE,
    'The incentre I of triangle ABC, where its angle bisectors meet.',
  ),
  call(
    'orthocenter',
    'Orthocentre',
    '4',
    'orthocenter',
    'point',
    TRIANGLE,
    'The orthocentre H of triangle ABC, where its altitudes meet.',
  ),
  call(
    'ninepoint_center',
    'Nine-point centre',
    '5',
    'ninepoint_center',
    'point',
    TRIANGLE,
    'The centre N of the nine-point circle of triangle ABC.',
  ),
  call(
    'excenter',
    'Excentre',
    '6',
    'excenter',
    'point',
    OPPOSITE,
    'The excentre of triangle ABC opposite A (the centre of that excircle).',
  ),
];
