/**
 * GUI tools over the v1.1 kernel tools (Run 13, ADR-0031) and the "Apply transformation" tool
 * that maps an object with a transformation built alone (a map tool's "Transformation only",
 * ToolState.mapOnly). Keys: Shift letters that no other tool or command takes: ⇧K the arc
 * (K is the circle through three points), ⇧Y the symmedian, ⇧I the isogonal conjugate, ⇧Z the
 * spiral center, ⇧E the pole, ⇧X the radical center, ⇧G apply a transformation.
 */
import { anyOrder, C, call, L, P, type ToolUI } from './tool-ui';

export const ARC_TOOL: ToolUI = call(
  'arc',
  'Arc (3 points)',
  'K',
  'arc',
  'circle',
  [P('start of the arc'), P('a point it passes through'), P('end of the arc')],
  'The arc from a point through a second to a third (of the circle through all three).',
);

export const SYMMEDIAN_TOOL: ToolUI = call(
  'symmedian',
  'Symmedian',
  'Y',
  'symmedian',
  'line',
  [P('vertex'), P('second vertex'), P('third vertex')],
  'The symmedian of triangle ABC from A: the median from A reflected in the bisector at A.',
);

/** The symmedian (Lemoine) point, next to Symmedian (ADR-0033): ⇧D, a free Shift letter. */
export const SYMMEDIAN_POINT_TOOL: ToolUI = call(
  'symmedian_point',
  'Symmedian point',
  'D',
  'symmedian_point',
  'point',
  [P('first vertex'), P('second vertex'), P('third vertex')],
  'The symmedian (Lemoine) point K of triangle ABC, where the three symmedians meet.',
);

/** Points defined by a triangle or by maps and circles (after the Centers group's tools). */
export const V11_POINT_TOOLS: readonly ToolUI[] = [
  call(
    'isogonal',
    'Isogonal conjugate',
    'I',
    'isogonal',
    'point',
    [P('the point to conjugate'), P('first vertex'), P('second vertex'), P('third vertex')],
    'The isogonal conjugate of a point in triangle ABC.',
  ),
  call(
    'spiral_center',
    'Spiral center',
    'Z',
    'spiral_center',
    'point',
    [P('A'), P('B'), P('the image of A'), P('the image of B')],
    'The center of the spiral similarity taking A to C and B to D.',
  ),
  anyOrder(
    call(
      'pole',
      'Pole',
      'E',
      'pole',
      'point',
      [L('line'), C('circle')],
      'The pole of a line with respect to a circle (click them in either order).',
    ),
  ),
  call(
    'radical_center',
    'Radical center',
    'X',
    'radical_center',
    'point',
    [C('first circle'), C('second circle'), C('third circle')],
    'The point with equal power to three circles.',
  ),
];

export const APPLY_MAP_TOOL: ToolUI = anyOrder(
  call(
    'apply_map',
    'Apply transformation',
    'G',
    'apply',
    'point',
    [
      { pick: 'transform', prompt: 'the transformation (from the objects panel)' },
      { pick: 'figure', prompt: 'object to map' },
    ],
    'The image of an object under a transformation built alone (a map tool’s “Transformation only”), chosen in the objects panel; in either order.',
  ),
);
