/**
 * The glider tool clicked on an existing point (M on m) made D = on(m, 1/2) exactly on M, a
 * second point at the same place. As with the point tool, a click on a point never creates
 * one there: the glider tool refuses it, naming the point, and adds nothing.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { addedNames, click, defText, editorOf, env, input, useTool } from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'm = line(A, C)', 'M = midpoint(A, C)'].join(
  '\n',
);

describe('glider tool on an existing point', () => {
  it('a click on M (on m) is refused, nothing added', () => {
    const s = useTool(editorOf(FIG), 'glider');
    const r = toolInput(s, click(s, 0.5, 1.5), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('M is here already: click the curve where there is no point');
    expect(r.state.doc).toBe(s.doc);
  });

  it('elsewhere on m it still makes a glider', () => {
    const base = editorOf(FIG);
    const s = input(useTool(base, 'glider'), click(base, 2, 6));
    expect(addedNames(base, s)).toEqual(['D']);
    expect(defText(s, 'D')).toBe('on(m, 2)');
  });
});
