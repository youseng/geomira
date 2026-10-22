/**
 * The GUI choice writes other(Q) for a tangent only when Q stays at the other touch point
 * (pre-beta review, ADR-0027). Q = (4, 3) lies on c by construction but is the touch point
 * from P = (0, 25/3) only by coincidence; `tangent_from(P, c, other(Q))` became Undefined
 * ("other(Q) needs the point on the polar of P") as soon as P moved.
 */
import { describe, expect, it } from 'vitest';
import { defText, edit, editorOf, idOf, input, useTool, valueOf } from './helpers/editor';

describe('tier 1 (other(P)) for tangent_from', () => {
  it('a point at the touch point by coincidence is not used; both tangents survive a drag', () => {
    let s = editorOf('O = (0, 0)\nQ = (4, 3)\nc = circle(O, Q)\nP = (0, 25/3)');
    s = useTool(s, 'tangent');
    s = input(s, { kind: 'object', id: idOf(s, 'P') });
    s = input(s, { kind: 'object', id: idOf(s, 'c') });
    const tangents = s.doc.objects.filter((o) => o.name.startsWith('l')).map((o) => o.name);
    expect(tangents).toHaveLength(2);
    for (const n of tangents) expect(defText(s, n)).not.toContain('other(Q)');
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'P') });
    s = edit(s, { kind: 'dragMove', to: { x: 0.5, y: 8.4 } });
    s = edit(s, { kind: 'dragEnd' });
    for (const n of tangents) expect(valueOf(s, n).kind).toBe('line');
  });
});
