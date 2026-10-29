/**
 * Run 16c audit (SPEC §12: a rounded number moves its point by at most ROUNDING_PX on screen):
 * a new glider on a conic was rounded with the circle's bound on the parameter step, which a
 * conic does not satisfy (the point moves about |X − A|²/size per unit of w), so on the ellipse
 * x²/100 + y² = 1 at zoom 50 a click at (5, −0.866) made a point 0.45 px away. Its rounding is
 * now checked as the drag end's is (withinRounding), and not applied when it moves the point
 * further.
 */
import { describe, expect, it } from 'vitest';
import { ROUNDING_PX } from '../src/rounding';
import { addedNames, click, editorOf, input, useTool, valueOf } from './helpers/editor';

const FIG = [
  'A = (10, 0)',
  'B = (0, 1)',
  'C = (-10, 0)',
  'D = (0, -1)',
  'E = (6, 0.8)',
  'k = conic(A, B, C, D, E)',
].join('\n');

describe('a new glider on a conic', () => {
  it('lands within ROUNDING_PX of the clicked point of the curve', () => {
    const base = editorOf(FIG);
    const zoomed = { ...base, viewport: { ...base.viewport, zoom: 50 } };
    const target = { x: 5, y: -Math.sqrt(0.75) };
    const s = input(useTool(zoomed, 'glider'), click(zoomed, target.x, target.y));
    const [g] = addedNames(zoomed, s);
    expect(g).toBeDefined();
    const v = valueOf(s, g ?? '');
    expect(v.kind).toBe('point');
    if (v.kind === 'point')
      expect(Math.hypot(v.x - target.x, v.y - target.y) * 50).toBeLessThanOrEqual(ROUNDING_PX);
  });
});
