/**
 * The "Point on object" (glider) tool takes a side of a polygon, as every tool with a curve
 * step does (ADR-0024 item 8): the side is made as segment(A, B) (its own edit), then the
 * glider on it.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { addedNames, click, defText, editorOf, env, input, useTool, xyOf } from './helpers/editor';

const TRI = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'tri_ABC = polygon(A, B, C)'].join('\n');

describe('glider tool on a polygon side', () => {
  it('a click on side AB makes segment(A, B), then a glider on it', () => {
    const base = editorOf(TRI);
    let s = useTool(base, 'glider');
    s = input(s, click(s, 2, 0));
    expect(addedNames(base, s)).toEqual(['l', 'D']);
    expect(defText(s, 'l')).toBe('segment(A, B)');
    expect(defText(s, 'D')).toBe('on(l, 1/2)');
    expect(xyOf(s, 'D')).toEqual([2, 0]);
    expect(s.history.past).toHaveLength(2);
  });

  it('a click on side BC makes segment(B, C)', () => {
    const base = editorOf(TRI);
    let s = useTool(base, 'glider');
    s = input(s, click(s, 2.5, 1.5));
    expect(defText(s, 'l')).toBe('segment(B, C)');
    expect(defText(s, 'D')).toBe('on(l, 1/2)');
  });

  it('empty space is still refused, with nothing added', () => {
    const base = useTool(editorOf(TRI), 'glider');
    const r = toolInput(base, click(base, 6, 5), env);
    expect(r.ok).toBe(false);
    expect(r.state.doc).toBe(base.doc);
  });
});
