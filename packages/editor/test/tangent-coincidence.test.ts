/**
 * The tangent tool writes tangent(P, k) only when P stays on k as the figure moves, as the
 * kernel decides it in each local response (the check ADR-0027 item 5 gave other(P)). A point
 * on k only by coincidence is refused with the reason: tangent(P, k) would become Undefined
 * after any drag of P.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { defText, edit, editorOf, env, idOf, input, useTool, valueOf } from './helpers/editor';
import type { EditorState } from '../src/state';

function picked(fig: string, point: string): EditorState {
  let s = useTool(editorOf(fig), 'tangent');
  s = input(s, { kind: 'object', id: idOf(s, point) });
  return s;
}

function drag(s: EditorState, name: string, to: { x: number; y: number }): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, name) });
  t = edit(t, { kind: 'dragMove', to });
  return edit(t, { kind: 'dragEnd' });
}

describe('tangent tool at a point on the circle', () => {
  it('P = (0, 5) on circle(O, Q) by coincidence: refused with the reason, nothing added', () => {
    const s = picked('O = (0, 0)\nQ = (3, 4)\nk = circle(O, Q)\nP = (0, 5)', 'P');
    const r = toolInput(s, { kind: 'object', id: idOf(s, 'k') }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/^P is on k only by coincidence/u);
    expect(r.state.doc).toBe(s.doc);
  });

  it('Q, the circle’s own point: tangent(Q, k), still a line after a drag', () => {
    const fig = 'O = (0, 0)\nQ = (3, 4)\nk = circle(O, Q)';
    let s = input(picked(fig, 'Q'), { kind: 'object', id: idOf(editorOf(fig), 'k') });
    expect(defText(s, 't_Q')).toBe('tangent(Q, k)');
    s = drag(s, 'Q', { x: 3.3, y: 4.5 });
    expect(valueOf(s, 't_Q').kind).toBe('line');
  });

  it('a glider on k: tangent(P, k), still a line after dragging the centre', () => {
    const fig = 'O = (0, 0)\nQ = (3, 4)\nk = circle(O, Q)\nP = on(k, 90)';
    let s = input(picked(fig, 'P'), { kind: 'object', id: idOf(editorOf(fig), 'k') });
    expect(defText(s, 't_P')).toBe('tangent(P, k)');
    s = drag(s, 'O', { x: 0.4, y: -0.2 });
    expect(valueOf(s, 't_P').kind).toBe('line');
  });
});
