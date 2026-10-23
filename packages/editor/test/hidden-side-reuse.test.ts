/**
 * A click on a polygon side where a tool wants a line reuses an existing segment(A, B) or
 * segment(B, A) of that side, even a hidden one (which the click cannot hit), instead of
 * making a duplicate (ADR-0024 item 8).
 */
import { describe, expect, it } from 'vitest';
import { addedNames, click, defText, editorOf, input, useTool } from './helpers/editor';

const TRI = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'tri_ABC = polygon(A, B, C)'].join('\n');

describe('a polygon side that is a segment already', () => {
  it('perpendicular: the hidden segment(A, B) is picked, not made again', () => {
    const base = editorOf(`${TRI}\nab = segment(A, B) [hidden]`);
    let s = useTool(base, 'perpendicular');
    s = input(s, click(s, 2, 0));
    expect(addedNames(base, s)).toEqual([]);
    s = input(s, click(s, 1, 3));
    expect(addedNames(base, s)).toEqual(['l']);
    expect(defText(s, 'l')).toBe('perp(C, ab)');
  });

  it('a reversed hidden segment(B, A) is reused too', () => {
    const base = editorOf(`${TRI}\nba = segment(B, A) [hidden]`);
    let s = useTool(base, 'foot');
    s = input(s, click(s, 1, 3));
    s = input(s, click(s, 2, 0));
    expect(addedNames(base, s)).toEqual(['D']);
    expect(defText(s, 'D')).toBe('foot(C, ba)');
  });

  it('a point clicked on the side is a glider on the hidden segment', () => {
    const base = editorOf(`${TRI}\nab = segment(A, B) [hidden]`);
    let s = useTool(base, 'midpoint');
    s = input(s, click(s, 2, 0));
    expect(addedNames(base, s)).toEqual(['D']);
    expect(defText(s, 'D')).toBe('on(ab, 1/2)');
  });

  it('the glider tool on the side uses the hidden segment', () => {
    const base = editorOf(`${TRI}\nab = segment(A, B) [hidden]`);
    const s = input(useTool(base, 'glider'), click(base, 2, 0));
    expect(addedNames(base, s)).toEqual(['D']);
    expect(defText(s, 'D')).toBe('on(ab, 1/2)');
  });
});
