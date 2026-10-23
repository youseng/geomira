/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): dragging a glider whose parameter
 * is an expression (X = on(l, s) with s = param(0, 1, 1/3), Y = on(c, 2 * angle(A, O, B)))
 * rewrote its definition with a literal parameter. Only on(obj, <literal parameters>) is a
 * free glider (SPEC §5, claims/src/free.ts): such a glider, and its images, are refused with
 * "X is not draggable: its parameter is computed", and the document is unchanged.
 */
import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/edit';
import { dragDefinition } from '../src/drag';
import { defText, edit, editorOf, env, idOf } from './helpers/editor';

const FIG = [
  'O = (0, 0)',
  'A = (5, 0)',
  'B = (0, 3)',
  'c = circle(O, A)',
  'l = line(O, B)',
  's = param(0, 1, 1/3)',
  'X = on(l, s)',
  'Y = on(c, 2 * angle(A, O, B))',
  'U = on(l, 1/2)',
  't = rotate(O, 90)',
  '@layer img = image(t, main)',
].join('\n');

describe('a glider whose parameter is computed is not draggable', () => {
  it('dragStart on it or on its image is refused, and nothing changes', () => {
    const s = editorOf(FIG);
    for (const n of ['X', 'Y', 'X*', 'Y*']) {
      const r = applyEdit(s, { kind: 'dragStart', id: idOf(s, n) }, env);
      expect(r.ok, n).toBe(false);
      if (!r.ok)
        expect(r.reason).toBe(`${n.replace('*', '')} is not draggable: its parameter is computed`);
    }
  });

  it('dragDefinition never writes a literal over a computed parameter', () => {
    const s = editorOf(FIG);
    for (const n of ['X', 'Y']) {
      const id = idOf(s, n);
      expect(dragDefinition(s.doc, id, id, { x: 1, y: 2 }, s.values)).toBe(
        `${n} is not draggable: its parameter is computed`,
      );
    }
    expect(defText(s, 'X')).toBe('on(l, s)');
  });

  it('a glider with a literal parameter is still dragged', () => {
    let s = editorOf(FIG);
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'U') });
    s = edit(s, { kind: 'dragMove', to: { x: 0, y: 6 } });
    s = edit(s, { kind: 'dragEnd' });
    expect(defText(s, 'U')).toBe('on(l, 2)');
  });
});
