/**
 * The GUI tools as DATA (SPEC §12: "GUI tools are data; one state machine runs them",
 * machine.ts). Each tool lists the picks it needs (what a click or a panel choice must be),
 * optionally further picks of one kind ended by `finish` (polygon, collinear), and what it
 * builds from them. Shortcuts and help are generated from this table (E10).
 *
 * Pick kinds: a point (an existing point, or a new one: free, a glider on a curve, or an
 * intersection, with the GUI selector choice of SPEC §7), a line, a circle, a curve (line or
 * circle), a figure (point, line, circle, polygon: what a map can image), a mirror (line or
 * point), a transform (from the objects panel: maps are not drawn).
 *
 * Keys follow the maintainer's Geomdraw where it has one (H parallel, J perpendicular, K circle
 * through three points, X reflect, Q distance, A angle; ADR-0024); the tools it has no letter
 * for take a Shift letter. Tools whose picks differ in kind (a point and a line, a point and a
 * circle) take them in either order (`anyOrder`), as Geomdraw's did.
 */
import type { ToolId } from './tool-state';
import { anyOrder, C, call, L, mapTool, P, type ToolUI } from './tool-ui';
import { CENTER_TOOLS, TRIANGLE_CIRCLE_TOOLS } from './tools-centers';
import {
  CIRCLE_RADIUS,
  DIAMETER_CIRCLE,
  EXT_BISECTOR,
  MAP_TOOLS,
  MEASURE_TOOLS,
  POLAR,
  RADICAL_AXIS,
  SECOND_INTERSECTION,
} from './tools-more';
import { APPLY_MAP_TOOL, ARC_TOOL, SYMMEDIAN_TOOL, V11_POINT_TOOLS } from './tools-v11';
import { INVERSION_TOOLS } from './tools-inversion';

export type { Build, PickKind, ToolStep, ToolUI } from './tool-ui';

export const TOOLS: readonly ToolUI[] = Object.freeze([
  {
    id: 'move',
    label: 'Move',
    key: 'v',
    help: 'Select objects; drag free points, gliders, their images and texts.',
    steps: [],
    build: { kind: 'none' },
  },
  {
    id: 'point',
    label: 'Point',
    key: 'p',
    help: 'A free point, a point on a curve, or an intersection, where you click.',
    steps: [P('click: empty space, a curve or an intersection')],
    build: { kind: 'none' },
  },
  {
    id: 'glider',
    label: 'Point on object',
    key: 'g',
    help: 'A point on a line, a circle or a polygon side, free to move along it.',
    steps: [{ pick: 'curve', prompt: 'click the curve where the point goes' }],
    build: { kind: 'none' },
  },
  {
    id: 'intersection',
    label: 'Intersection',
    key: 'i',
    help: 'Intersect two curves: every common point that is not a point yet is created.',
    steps: [
      { pick: 'curve', prompt: 'first curve' },
      { pick: 'curve', prompt: 'second curve' },
    ],
    build: { kind: 'intersection' },
  },
  SECOND_INTERSECTION,
  call(
    'midpoint',
    'Midpoint',
    'm',
    'midpoint',
    'point',
    [P('first point'), P('second point')],
    'The midpoint of two points.',
  ),
  call(
    'line',
    'Line',
    'l',
    'line',
    'line',
    [P('first point'), P('second point')],
    'The line through two points.',
  ),
  call(
    'segment',
    'Segment',
    's',
    'segment',
    'line',
    [P('first end'), P('second end')],
    'The segment between two points.',
  ),
  call(
    'ray',
    'Ray',
    'L',
    'ray',
    'line',
    [P('start'), P('a point it passes through')],
    'The ray from a point through another.',
  ),
  anyOrder(
    call(
      'parallel',
      'Parallel',
      'h',
      'parallel',
      'line',
      [P('point'), L('line')],
      'The parallel to a line through a point (click them in either order).',
    ),
  ),
  anyOrder(
    call(
      'perpendicular',
      'Perpendicular',
      'j',
      'perp',
      'line',
      [P('point'), L('line')],
      'The perpendicular to a line through a point (click them in either order).',
    ),
  ),
  call(
    'perp_bisector',
    'Perpendicular bisector',
    'b',
    'perp_bisector',
    'line',
    [P('first point'), P('second point')],
    'The perpendicular bisector of two points.',
  ),
  call(
    'bisector',
    'Angle bisector',
    'n',
    'bisector',
    'line',
    [P('point on the first arm'), P('vertex'), P('point on the second arm')],
    'The bisector of angle ABC (at B).',
  ),
  EXT_BISECTOR,
  SYMMEDIAN_TOOL,
  call(
    'circle',
    'Circle (center, point)',
    'c',
    'circle',
    'circle',
    [P('center'), P('point on the circle')],
    'The circle with a center through a point.',
  ),
  CIRCLE_RADIUS,
  call(
    'circle3',
    'Circle (3 points)',
    'k',
    'circle',
    'circle',
    [P('first point'), P('second point'), P('third point')],
    'The circle through three points.',
  ),
  DIAMETER_CIRCLE,
  ARC_TOOL,
  ...TRIANGLE_CIRCLE_TOOLS,
  ...CENTER_TOOLS,
  ...V11_POINT_TOOLS,
  {
    id: 'tangent',
    label: 'Tangent',
    key: 't',
    help: 'The tangent at a point of a circle, or both tangents from an outside point (click the point and the circle in either order).',
    steps: [P('point'), C('circle')],
    anyOrder: true,
    build: { kind: 'tangent' },
  },
  POLAR,
  RADICAL_AXIS,
  anyOrder(
    call(
      'foot',
      'Foot',
      'f',
      'foot',
      'point',
      [P('point'), L('line')],
      'The foot of the perpendicular from a point to a line (click them in either order).',
    ),
  ),
  mapTool(
    call(
      'reflect',
      'Reflect',
      'x',
      'reflect',
      'point',
      [
        { pick: 'figure', prompt: 'object to reflect' },
        { pick: 'mirror', prompt: 'mirror line or center' },
      ],
      'The mirror image of an object in a line or a point (or, with “Transformation only”, the reflection itself).',
    ),
  ),
  ...MAP_TOOLS,
  APPLY_MAP_TOOL,
  ...INVERSION_TOOLS,
  {
    id: 'polygon',
    label: 'Polygon',
    key: 'y',
    help: 'A polygon: click its vertices, then the first again (or finish).',
    steps: [P('first vertex'), P('second vertex'), P('third vertex')],
    rest: P('next vertex, or the first to close'),
    build: { kind: 'call', tool: 'polygon', name: 'polygon' },
  },
  call(
    'mark_angle',
    'Angle mark',
    'M',
    'mark_angle',
    'mark',
    [P('point on the first arm'), P('vertex'), P('point on the second arm')],
    'Arcs marking angle ABC.',
  ),
  call(
    'mark_right',
    'Right-angle mark',
    'w',
    'mark_right',
    'mark',
    [P('point on the first arm'), P('vertex'), P('point on the second arm')],
    'The square of a right angle ABC (only a right angle gets it).',
  ),
  call(
    'mark_segment',
    'Segment mark',
    'u',
    'mark_segment',
    'mark',
    [P('first end'), P('second end')],
    'A tick across segment AB.',
  ),
  {
    id: 'text',
    label: 'Text',
    key: 'T',
    help: 'A text at a point: pick the point, then type the text.',
    steps: [P('where the text goes')],
    build: { kind: 'text' },
  },
  call(
    'measure_distance',
    'Distance',
    'q',
    'dist',
    'distance',
    [P('first point'), P('second point')],
    'The distance between two points.',
  ),
  call(
    'measure_angle',
    'Angle',
    'a',
    'angle',
    'angle',
    [P('point on the first arm'), P('vertex'), P('point on the second arm')],
    'The angle ABC in degrees.',
  ),
  ...MEASURE_TOOLS,
  {
    id: 'claim',
    label: 'Claim',
    key: 'H',
    help: 'A claim of the chosen kind about the objects you pick.',
    steps: [],
    build: { kind: 'claim' },
  },
  {
    id: 'derived_layer',
    label: 'Layer from transform',
    key: 'J',
    help: 'A new layer holding the image of the active layer under a transformation.',
    steps: [{ pick: 'transform', prompt: 'the transformation (from the objects panel)' }],
    build: { kind: 'derivedLayer' },
  },
] satisfies readonly ToolUI[]);

export function toolUI(id: ToolId): ToolUI | undefined {
  return TOOLS.find((t) => t.id === id);
}
