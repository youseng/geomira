/**
 * The Point tool at a tangency (ADR-0028): a click on the touch point of two drawn curves
 * creates their intersection, through the editor's own tool path, not a glider on one of
 * them (the scene's virtual hit treats a drawn near-tangency as the double point).
 */
import { describe, expect, it } from 'vitest';
import {
  addedNames,
  click,
  defText,
  editorOf,
  input,
  useTool,
  valueOf,
  xyOf,
} from './helpers/editor';

describe('Point tool on a touch point', () => {
  it("the incircle's touch point on a side is intersect(a, i, …)", () => {
    for (let k = 0; k < 12; k++) {
      const [ax, ay, cx] = [-1 + (k % 6) * 0.37, 3 + (k % 5) * 0.21, 4 + (k % 7) * 0.13];
      const s = useTool(
        editorOf(`@viewport 1.5 1.5 60
A = (${ax.toFixed(2)}, ${ay.toFixed(2)})
B = (0, 0)
C = (${cx.toFixed(2)}, 0)
a = segment(B, C)
i = incircle(A, B, C)
`),
        'point',
      );
      const i = valueOf(s, 'i');
      if (i.kind !== 'circle') throw new Error('no incircle');
      const after = input(s, click(s, i.c.x, 0));
      const [name] = addedNames(s, after);
      if (name === undefined) throw new Error('nothing created');
      expect(defText(after, name)).toMatch(/^intersect\(a, i(, .*)?\)$/);
      const [x, y] = xyOf(after, name);
      expect(x).toBeCloseTo(i.c.x, 9);
      expect(y).toBeCloseTo(0, 9);
    }
  });

  it('the touch point of a tangent line from a point is the intersection', () => {
    for (let k = 0; k < 12; k++) {
      const [px0, py0, r] = [4 + k * 0.173, (k % 5) * 0.37, 2 + (k % 7) * 0.31];
      const s = useTool(
        editorOf(`@viewport 0 0 50
O = (0, 0)
P = (${px0.toFixed(3)}, ${py0.toFixed(2)})
c = circle(O, ${r.toFixed(2)})
t = tangent_from(P, c, orient(+))
`),
        'point',
      );
      const c = valueOf(s, 'c');
      const t = valueOf(s, 't');
      if (c.kind !== 'circle' || t.kind !== 'line') throw new Error('bad figure');
      // The foot of the perpendicular from the centre on the tangent line.
      const [px, py, dx, dy] = [t.p.x, t.p.y, t.d.x, t.d.y];
      const u = ((c.c.x - px) * dx + (c.c.y - py) * dy) / (dx * dx + dy * dy);
      const after = input(s, click(s, px + u * dx, py + u * dy));
      const [name] = addedNames(s, after);
      if (name === undefined) throw new Error('nothing created');
      expect(defText(after, name)).toMatch(/^intersect\((t, c|c, t)(, .*)?\)$/);
    }
  });
});
