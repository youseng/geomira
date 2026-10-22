/**
 * ADR-0024: the live preview of the active tool is what its build would make with the point
 * under the cursor as the last pick, computed by the kernel's tool code; it changes nothing.
 */
import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/edit';
import { toolPreview } from '../src/preview';
import type { EditorState } from '../src/state';
import { click, editorOf, env, hitAt, idOf, input, useTool } from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'l = line(A, B)', 'c = circle(A, C)'].join(
  '\n',
);

function preview(s: EditorState, x: number, y: number) {
  return toolPreview(s, hitAt(s, x, y), { x, y }, env);
}

describe('toolPreview', () => {
  it('line from A to the cursor: one line through A and the cursor; the state is untouched', () => {
    let s = useTool(editorOf(FIG), 'line');
    s = input(s, click(s, 0, 0));
    const before = s;
    const p = preview(s, 2, 5);
    expect(s).toBe(before);
    expect(p?.primitives).toHaveLength(1);
    const sh = p?.primitives[0]?.shape;
    expect(sh?.kind).toBe('line');
    if (sh?.kind === 'line') {
      // Through A (0, 0) and (2, 5): the cross product of u and the point is 0.
      expect(Math.abs(sh.u.x * 5 - sh.u.y * 2)).toBeLessThan(1e-12);
      expect(Math.abs(sh.u.x * sh.p.y - sh.u.y * sh.p.x)).toBeLessThan(1e-12);
    }
  });

  it('the cursor on a point previews with that point (snaps)', () => {
    let s = useTool(editorOf(FIG), 'circle');
    s = input(s, click(s, 0, 0));
    const p = preview(s, 4.02, 0.01);
    const sh = p?.primitives[0]?.shape;
    expect(sh?.kind === 'circle' && sh.r).toBeCloseTo(4, 12);
  });

  it('perpendicular once its line is picked; both tangents once the circle is', () => {
    let s = useTool(editorOf(FIG), 'perpendicular');
    s = input(s, { kind: 'object', id: idOf(s, 'l') });
    const p = preview(s, 2, 2);
    const sh = p?.primitives[0]?.shape;
    expect(sh?.kind === 'line' && Math.abs(sh.u.x)).toBeLessThan(1e-12);
    let t = useTool(editorOf(FIG), 'tangent');
    t = input(t, { kind: 'object', id: idOf(t, 'c') });
    expect(preview(t, 6, 1)?.primitives.map((q) => q.shape.kind)).toEqual(['line', 'line']);
    // From inside the circle there is no tangent to show.
    expect(preview(t, 0.5, 0.5)).toBeNull();
  });

  it('rotate previews the image with the typed angle; no preview without a number', () => {
    let s = useTool(editorOf(FIG), 'rotate');
    const r = applyEdit(s, { kind: 'toolValue', value: '90' }, env);
    if (!r.ok) throw new Error(r.reason);
    s = input(r.state, click(r.state, 1, 3));
    const sh = preview(s, 0, 0)?.primitives[0]?.shape;
    expect(sh?.kind === 'point' && [sh.at.x, sh.at.y]).toEqual([-3, 1]);
    const bad = applyEdit(s, { kind: 'toolValue', value: 'x' }, env);
    expect(bad.ok && preview(bad.state, 0, 0)).toBeNull();
  });

  it('nothing to preview: the move tool, a tool still missing two picks, a curve step', () => {
    expect(preview(editorOf(FIG), 1, 1)).toBeNull();
    expect(preview(useTool(editorOf(FIG), 'circle3'), 1, 1)).toBeNull();
    expect(preview(useTool(editorOf(FIG), 'radical_axis'), 1, 1)).toBeNull();
    let s = useTool(editorOf(FIG), 'foot');
    s = input(s, click(s, 1, 3));
    expect(preview(s, 5, 5)).toBeNull();
  });

  it('a polygon previews with the cursor as its next vertex once it has two', () => {
    let s = useTool(editorOf(FIG), 'polygon');
    s = input(s, click(s, 0, 0));
    expect(preview(s, 2, 2)).toBeNull();
    s = input(s, click(s, 4, 0));
    expect(preview(s, 2, 2)?.primitives[0]?.shape.kind).toBe('polygon');
  });
});
