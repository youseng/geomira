/**
 * A click that creates a point for a tool's last pick, when the tool then refuses to build,
 * is a refusal with the tool's reason, and the point it would have created is not added
 * (it was reported as a success with a stray point and no message).
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { click, edit, editorOf, env, idOf, input, useTool } from './helpers/editor';

describe('a refused build after a click-created pick', () => {
  it('tangent: circle k, then empty space inside k: refused, nothing added', () => {
    let s = useTool(editorOf('O = (0, 0)\nQ = (3, 0)\nk = circle(O, Q)'), 'tangent');
    s = input(s, { kind: 'object', id: idOf(s, 'k') });
    const r = toolInput(s, click(s, 1, 1), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('the point is inside the circle: there is no tangent from it');
    expect(r.state.doc).toBe(s.doc);
    expect(r.state.toolState).toEqual(s.toolState);
    expect(r.state.history).toBe(s.history);
  });

  it('rotate with "90 deg": A, then empty space: refused with the reason, nothing added', () => {
    let s = useTool(editorOf('A = (0, 0)\nB = (3, 0)'), 'rotate');
    s = edit(s, { kind: 'toolValue', value: '90 deg' });
    s = input(s, { kind: 'object', id: idOf(s, 'A') });
    const r = toolInput(s, click(s, 1, 1), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^Angle/u);
    expect(r.state.doc).toBe(s.doc);
    expect(r.state.toolState).toEqual(s.toolState);
  });

  it('a polygon side made for a refused pick is not added either', () => {
    const fig = 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)\ntri_ABC = polygon(A, B, C)';
    let s = useTool(editorOf(fig), 'rotate');
    s = edit(s, { kind: 'toolValue', value: 'x' });
    s = input(s, { kind: 'object', id: idOf(s, 'C') });
    const r = toolInput(s, click(s, 2, 0), env);
    expect(r.ok).toBe(false);
    expect(r.state.doc).toBe(s.doc);
  });
});
