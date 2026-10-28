/**
 * Run 16a (ADR-0040 decisions 5 and 12): a derived layer through send_to_infinity(l),
 * `@layer inf = image(f, main)`, with a view showing it alone. Points at infinity are listed in
 * the Objects panel as "at infinity, direction θ°", never drawn; the images of points at
 * infinity are finite points on l; drag-through goes through f⁻¹ = f (an involution); a cursor
 * on l has a point at infinity as preimage and is refused; images whose map depends on their
 * source are not draggable (SPEC §8.4). The text round-trips (P1).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { objectsByLayer } from '../src/panels';
import { switchView } from '../src/views';
import { edit, editorOf, env, idOf, ok, registry, valueOf, xyOf } from './helpers/editor';
import type { EditorState } from '../src/state';

const TEXT = [
  '@layer inf = image(f, main)',
  '@view projective [layers=-main,inf]',
  'A = (0, 0)',
  'B = (4, 1)',
  'l = line(A, B) [noimage]',
  'f = send_to_infinity(l)',
  'C = (1, 3)',
  'D = (4, 5)',
  'X = intersect(line(C, D), parallel(A, line(C, D)))',
].join('\n');

function drag(s: EditorState, name: string, to: [number, number]): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, name) });
  t = edit(t, { kind: 'dragMove', to: { x: to[0], y: to[1] } });
  return edit(t, { kind: 'dragEnd' });
}

/** Whether P lies on line(A, B) (within 1e-9 of the figure's size). */
function onAB(s: EditorState, p: [number, number]): boolean {
  const [a, b] = [xyOf(s, 'A'), xyOf(s, 'B')];
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  return Math.abs(cross) < 1e-9;
}

describe('a derived layer through send_to_infinity(l)', () => {
  const s = editorOf(TEXT);

  it('lists points at infinity with their direction, and the images of X on l', () => {
    const [main, inf] = objectsByLayer(s);
    const x = main?.rows.find((r) => r.name === 'X');
    // CD = (3, 2): atan(2/3) = 33.69°.
    expect(x).toMatchObject({ status: 'ok', kind: 'ideal_point' });
    expect(x?.note).toBe('at infinity, direction 33.69°');
    expect(inf?.rows.map((r) => r.name)).toEqual(['A*', 'B*', 'C*', 'D*', 'X*']);
    // A and B are on l: their images are at infinity; X* is a point of l.
    for (const n of ['A*', 'B*']) {
      const r = inf?.rows.find((y) => y.name === n);
      expect(r?.kind, n).toBe('ideal_point');
      expect(r?.note, n).toMatch(/^at infinity, direction \d+(\.\d+)?°$/u);
    }
    expect(valueOf(s, 'X*').kind).toBe('point');
    expect(onAB(s, xyOf(s, 'X*'))).toBe(true);
    // A point at infinity has no coordinates: the note is all a row shows.
    expect(main?.rows.find((r) => r.name === 'A')?.note).toBeUndefined();
  });

  it('the text round-trips, view included', () => {
    const text = print(s.doc);
    expect(text).toContain('@layer inf = image(f, main)');
    expect(text).toContain('@view projective [layers=-main,inf]');
    expect(print(parse(text, registry).doc)).toBe(text);
  });

  it('switching to the view shows the image layer alone', () => {
    const t = ok(switchView(s, 'projective', env));
    expect(t.doc.layers.map((l) => [l.name, l.visible])).toEqual([
      ['main', false],
      ['inf', true],
    ]);
  });

  it('dragging C* moves C through f⁻¹ = f', () => {
    const t = drag(s, 'C*', [2, -1]);
    const [x, y] = xyOf(t, 'C*');
    expect(Math.hypot(x - 2, y + 1)).toBeLessThan(1e-3);
    expect(xyOf(t, 'C')).not.toEqual(xyOf(s, 'C'));
  });

  it('a cursor on l has a point at infinity as preimage: the move is refused', () => {
    const t = edit(s, { kind: 'dragStart', id: idOf(s, 'C*') });
    const r = applyEdit(t, { kind: 'dragMove', to: { x: 8, y: 2 } }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/the preimage under f is a point at infinity/u);
  });

  it('A* is at infinity, not drawn: not draggable', () => {
    const r = applyEdit(s, { kind: 'dragStart', id: idOf(s, 'A*') }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('A* is a point at infinity: it is not drawn');
  });
});
