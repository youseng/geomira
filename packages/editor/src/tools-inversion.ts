/**
 * GUI tools over Run 14's inversion tools (ADR-0032 decision 16), as data: each builds the map
 * alone, named as a transformation (`f = inversion(c)`), to use with Apply transformation (⇧G)
 * or Layer from transform (⇧J). Keys: the Shift letters no other tool or command takes: ⇧W the
 * inversion in a circle, ⇧U the √(bc) inversion, ⇧F the inversion fixing a circle. The other
 * presets (orthocenter_inversion, inversion_swap) are typed.
 */
import { anyOrder, C, call, P, type ToolUI } from './tool-ui';

export const INVERSION_TOOLS: readonly ToolUI[] = [
  call(
    'inversion',
    'Inversion',
    'W',
    'inversion',
    'transform',
    [C('circle of inversion')],
    'The inversion in a circle (built alone: apply it with Apply transformation or make a layer from it).',
  ),
  call(
    'sqrt_bc',
    '√(bc) inversion',
    'U',
    'sqrt_bc',
    'transform',
    [P('vertex A'), P('vertex B'), P('vertex C')],
    'The √(bc) inversion of triangle ABC at A: it swaps B and C (the inversion with power AB·AC, then the reflection in the bisector at A).',
  ),
  anyOrder(
    call(
      'inversion_fixing',
      'Inversion fixing a circle',
      'F',
      'inversion_fixing',
      'transform',
      [P('center'), C('circle to fix')],
      'The inversion centered at a point that maps a circle to itself (click them in either order).',
    ),
  ),
];
