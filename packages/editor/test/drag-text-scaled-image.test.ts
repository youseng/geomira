/**
 * A text anchored at an image under a scaling map (homothety ×1000) is dragged through the map
 * (drag-text-image.test.ts); at drag end its source is rounded on the grid of the IMAGE's
 * scale, exactly as when the image point itself is dragged (it used the text's own scale, 1,
 * so the rounding moved the image visibly, was refused, and the source stayed unrounded).
 */
import { describe, expect, it } from 'vitest';
import type { EditorState } from '../src/state';
import { defText, edit, editorOf, idOf } from './helpers/editor';

function drag(s: EditorState, id: number, to: [number, number]): EditorState {
  let t = edit(s, { kind: 'dragStart', id });
  t = edit(t, { kind: 'dragMove', to: { x: to[0], y: to[1] } });
  return edit(t, { kind: 'dragEnd' });
}

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'T = homothety(A, 1000)',
  '@layer m = image(T, main)',
  't = text(C*, "x") [layers=m]',
].join('\n');

describe('a text anchored at a scaled image', () => {
  it('rounds its source as a drag of the image point itself does', () => {
    const s0 = editorOf(FIG);
    const to: [number, number] = [2012.3456789, 3098.7654321];
    const byText = drag(s0, idOf(s0, 't'), to);
    expect(defText(s0, 'C*')).toBe('apply(T, C)');
    const byImage = drag(s0, idOf(s0, 'C*'), to);
    expect(defText(byImage, 'C')).not.toMatch(/\d{8}/u);
    expect(defText(byText, 'C')).toBe(defText(byImage, 'C'));
  });
});
