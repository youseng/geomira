/**
 * Rounding at drag end must not move a dependent object (pre-beta review, ADR-0027). The
 * check covered only the dragged object and the object it rewrites; rounding Q onto the far
 * side of l flipped `same_side(Q, l)` and X jumped 300 px.
 */
import { describe, expect, it } from 'vitest';
import type { EditorState } from '../src/state';
import { print } from '@geomira/lang/print';
import type { Value } from '@geomira/kernel/value';
import { dependentsKept } from '../src/drag-dependents';
import { edit, editorOf, idOf, xyOf } from './helpers/editor';

const FIGURE = [
  'A = (0, 0.0003)',
  'B = (10, 0.0003)',
  'l = line(A, B)',
  'm = line((5, -10), (5, 10))',
  'c = circle((5, 0), (5, 3))',
  'Q = (1, 1)',
  'X = intersect(m, c, same_side(Q, l))',
].join('\n');

function dragTo(s: EditorState, name: string, x: number, y: number): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, name) });
  t = edit(t, { kind: 'dragMove', to: { x, y } });
  return edit(t, { kind: 'dragEnd' });
}

function zoomed(s: EditorState, zoom: number): EditorState {
  return edit(s, { kind: 'viewport', viewport: { ...s.viewport, zoom } });
}

describe('drag-end rounding keeps every dependent in place', () => {
  it('a rounding that would flip a selector is not applied: X stays at (5, 3)', () => {
    const s = dragTo(zoomed(editorOf(FIGURE), 50), 'Q', 1, 0.00045);
    expect(xyOf(s, 'X')).toEqual([5, 3]);
    const [, qy] = xyOf(s, 'Q');
    expect(qy).toBeGreaterThan(0.0003);
  });

  it('far from the line the rounding still applies (short decimals)', () => {
    const s = dragTo(zoomed(editorOf(FIGURE), 50), 'Q', 1.23456789, 2.3456789);
    expect(print(s.doc)).toContain('Q = (1.235, 2.346)');
    expect(xyOf(s, 'X')).toEqual([5, 3]);
  });

  it('a dependent that changes kind (a point becoming undefined) or moves 1 px blocks it', () => {
    const P = { kind: 'point' as const, x: 0, y: 0 };
    const gone = { kind: 'undefined' as const, reason: 'gone' };
    const kept = (a: Value<number>, b: Value<number>, zoom = 50) =>
      dependentsKept(new Map([[1, a]]), new Map([[1, b]]), zoom, new Set());
    expect(kept(P, gone)).toBe(false);
    expect(kept(gone, P)).toBe(false);
    expect(kept(P, { ...P, x: 0.01 })).toBe(true);
    expect(kept(P, { ...P, x: 0.03 })).toBe(false);
    const c = { kind: 'circle' as const, c: { x: 0, y: 0 }, r2: 1, arc: null };
    expect(kept(c, { ...c, r2: 1.1 })).toBe(false);
    const l = {
      kind: 'line' as const,
      p: { x: 0, y: 0 },
      d: { x: 1, y: 0 },
      lo: null,
      hi: null,
      chiral: false,
    };
    expect(kept(l, { ...l, d: { x: 2, y: 0 } })).toBe(true);
    expect(kept(l, { ...l, d: { x: 1, y: 1 } })).toBe(false);
    expect(dependentsKept(new Map([[1, P]]), new Map([[1, gone]]), 50, new Set([1]))).toBe(true);
  });
});
