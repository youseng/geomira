/**
 * The triangle centers and circles as GUI tools (ADR-0016 decisions 21, 23): pick three
 * points A, B, C, as for the kernel tools of the same name. Keys: Geomdraw's chord digits for
 * the five centers it numbers (centroid 1, circumcenter 2, incenter 3, orthocenter 4,
 * nine-point center 5; Geomdraw types them after G, which is the glider here), the free
 * digits 6–9 for the excenter and three circles, and Shift+N for the nine-point circle (every
 * lowercase letter is taken). The excenter and the excircle are the ones opposite the first
 * pick. Each center, the circumcircle and the incircle take their olympiad name when it is
 * free (conventional-names.ts). The centres of similitude of two circles (ADR-0045) pick two
 * circles; every letter and digit being taken, their keys are . and : (two free keys side by side; < and > would be escaped in the
 * palette's titles).
 */
import type { NamePreference } from './conventional-names';
import { C, call, P, type ToolStep, type ToolUI } from './tool-ui';

const TRIANGLE: readonly ToolStep[] = [P('first vertex'), P('second vertex'), P('third vertex')];

const OPPOSITE: readonly ToolStep[] = [
  P('vertex the excircle is opposite'),
  P('second vertex'),
  P('third vertex'),
];

const named = (name: string): NamePreference => ({ kind: 'fixed', name });

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
    named('ω'),
  ),
  call(
    'incircle',
    'Incircle',
    '8',
    'incircle',
    'circle',
    TRIANGLE,
    'The circle inside triangle ABC tangent to its three sides.',
    named('ω'),
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

/** Centers of a triangle (the Centers group). */
export const CENTER_TOOLS: readonly ToolUI[] = [
  call(
    'centroid',
    'Centroid',
    '1',
    'centroid',
    'point',
    TRIANGLE,
    'The centroid G of triangle ABC, where its medians meet.',
    named('G'),
  ),
  call(
    'circumcenter',
    'Circumcenter',
    '2',
    'circumcenter',
    'point',
    TRIANGLE,
    'The circumcenter O of triangle ABC, the center of the circle through A, B, C.',
    named('O'),
  ),
  call(
    'incenter',
    'Incenter',
    '3',
    'incenter',
    'point',
    TRIANGLE,
    'The incenter I of triangle ABC, where its angle bisectors meet.',
    named('I'),
  ),
  call(
    'orthocenter',
    'Orthocenter',
    '4',
    'orthocenter',
    'point',
    TRIANGLE,
    'The orthocenter H of triangle ABC, where its altitudes meet.',
    named('H'),
  ),
  call(
    'ninepoint_center',
    'Nine-point center',
    '5',
    'ninepoint_center',
    'point',
    TRIANGLE,
    'The center N of the nine-point circle of triangle ABC.',
    named('N'),
  ),
  call(
    'excenter',
    'Excenter',
    '6',
    'excenter',
    'point',
    OPPOSITE,
    'The excenter I_a of triangle ABC opposite A (the center of that excircle).',
    { kind: 'vertex', base: 'I' },
  ),
  call(
    'exsimilicenter',
    'Exsimilicenter',
    '.',
    'exsimilicenter',
    'point',
    [C('first circle'), C('second circle')],
    'The external center of similitude of two circles, where their external common tangents meet (a point at infinity for equal radii).',
  ),
  call(
    'insimilicenter',
    'Insimilicenter',
    ':',
    'insimilicenter',
    'point',
    [C('first circle'), C('second circle')],
    'The internal center of similitude of two circles, where their internal common tangents meet.',
  ),
];
