/**
 * ADR-0024: a click on a side of a polygon where a tool wants a line creates that side as a
 * segment (its own edit, drawn over the edge), so a perpendicular, a foot or an intersection
 * can use a triangle's side in one click, as in Geomdraw, whose triangles were segments.
 */
import { describe, expect, it } from 'vitest';
import { addedNames, click, defText, editorOf, input, useTool, xyOf } from './helpers/editor';

const TRI = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'tri_ABC = polygon(A, B, C)'].join('\n');

describe('polygon sides as line picks', () => {
  it('perpendicular from C to side AB, the side clicked first: segment(A, B), then perp(C, …)', () => {
    let s = useTool(editorOf(TRI), 'perpendicular');
    s = input(s, click(s, 2, 0));
    expect(defText(s, 's_AB')).toBe('segment(A, B)');
    s = input(s, click(s, 1, 3));
    expect(addedNames(editorOf(TRI), s)).toEqual(['s_AB', 'l_C']);
    expect(defText(s, 'l_C')).toBe('perp(C, s_AB)');
    // The side's segment is its own edit, then the perpendicular.
    expect(s.history.past).toHaveLength(2);
  });

  it('a second click on that side picks the segment made the first time', () => {
    let s = useTool(editorOf(TRI), 'foot');
    s = input(s, click(s, 1, 3));
    s = input(s, click(s, 2, 0));
    expect(defText(s, 'D')).toBe('foot(C, s_AB)');
    expect(xyOf(s, 'D')).toEqual([1, 0]);
    s = useTool(s, 'parallel');
    s = input(s, click(s, 3, 0));
    s = input(s, click(s, 1, 3));
    expect(addedNames(editorOf(TRI), s)).toEqual(['s_AB', 'D', 'l_C']);
    expect(defText(s, 'l_C')).toBe('parallel(C, s_AB)');
  });

  it('the side nearest the click is the one made (BC, not AB)', () => {
    let s = useTool(editorOf(TRI), 'foot');
    s = input(s, click(s, 2.5, 1.5));
    expect(defText(s, 's_BC')).toBe('segment(B, C)');
  });

  it('a point clicked on a side is a glider on that side (the side is made first)', () => {
    let s = useTool(editorOf(TRI), 'midpoint');
    s = input(s, click(s, 2, 0));
    expect(defText(s, 's_AB')).toBe('segment(A, B)');
    expect(defText(s, 'D')).toBe('on(s_AB, 1/2)');
    s = input(s, click(s, 1, 3));
    expect(defText(s, 'E')).toBe('midpoint(D, C)');
  });

  it('a click where a side meets a circle makes the side, then the intersection', () => {
    const fig = `${TRI}\nc = circle(A, (2, 0))`;
    let s = useTool(editorOf(fig), 'point');
    s = input(s, click(s, 2, 0));
    expect(addedNames(editorOf(fig), s)).toEqual(['s_AB', 'D']);
    expect(defText(s, 's_AB')).toBe('segment(A, B)');
    expect(defText(s, 'D')).toMatch(/^intersect\((s_AB, c|c, s_AB), .+\)$/u);
    expect(xyOf(s, 'D')[0]).toBeCloseTo(2, 12);
  });
});
