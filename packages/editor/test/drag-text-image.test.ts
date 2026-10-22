/**
 * Found in the Run 10 audit (SPEC §8.4 drag-through, ADR-0012 decision 10: a text is dragged
 * through its anchor): a text anchored at a managed image (t = text(C*, "x")) rewrote the
 * image's SOURCE C as if C were the dragged position itself, so C went to the cursor and the
 * text to the mirror image of the cursor; for the image of a glider the parameter was
 * projected from the cursor directly. The anchor is now dragged as the anchor would be:
 * through T⁻¹ for an image.
 */
import { describe, expect, it } from 'vitest';
import type { EditorState } from '../src/state';
import { edit, editorOf, idOf, valueOf, xyOf } from './helpers/editor';

function drag(s: EditorState, name: string, ...to: [number, number][]): EditorState {
  let t = edit(s, { kind: 'dragStart', id: idOf(s, name) });
  for (const [x, y] of to) t = edit(t, { kind: 'dragMove', to: { x, y } });
  return edit(t, { kind: 'dragEnd' });
}

function textAt(s: EditorState, name: string): [number, number] {
  const v = valueOf(s, name);
  if (v.kind !== 'text') throw new Error(v.kind);
  return [v.at.x, v.at.y];
}

const BASE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'T = reflect(line(A, B))',
  '@layer m = image(T, main)',
];

describe('a text anchored at an image is dragged through the map', () => {
  it('text(C*, …): the text goes to the cursor, C to its mirror image', () => {
    const s = drag(editorOf([...BASE, 't = text(C*, "x") [layers=m]'].join('\n')), 't', [2, -5]);
    expect(textAt(s, 't')).toEqual([2, -5]);
    expect(xyOf(s, 'C')).toEqual([2, 5]);
  });

  it('text(P*, …) with P a glider: the text goes to the cursor on the image circle', () => {
    const s0 = editorOf(
      [...BASE, 'k = circle(C, 1)', 'P = on(k, 0)', 't = text(P*, "x") [layers=m]'].join('\n'),
    );
    // (2, −3) is on the image of k: P goes to (2, 3).
    const s = drag(s0, 't', [2, -3]);
    expect(textAt(s, 't')[0]).toBeCloseTo(2, 3);
    expect(textAt(s, 't')[1]).toBeCloseTo(-3, 3);
    expect(xyOf(s, 'P')[0]).toBeCloseTo(2, 3);
    expect(xyOf(s, 'P')[1]).toBeCloseTo(3, 3);
  });

  it('a text anchored at a plain free point still moves its point', () => {
    const s = drag(editorOf([...BASE, 't = text(C, "x")'].join('\n')), 't', [2, 2]);
    expect(xyOf(s, 'C')).toEqual([2, 2]);
    expect(textAt(s, 't')).toEqual([2, 2]);
  });
});
