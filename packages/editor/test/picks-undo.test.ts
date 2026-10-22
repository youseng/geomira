/**
 * Found in the Run 10 audit: a tool's picks survived an edit that removed the object they
 * named. Undoing the point a click had just created left its id in the picks; every later click
 * was refused ("there is no object #3") until Cancel, or, once another object took the freed id
 * (undo restores the old nextId), the tool silently built on that object instead. The picks
 * (and a pending choice) now reset when an object they name is gone.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { click, defText, edit, editorOf, env, input, useTool } from './helpers/editor';

describe('tool picks after the picked object is gone', () => {
  it('undo of the picked point resets the picks; the next clicks start the tool afresh', () => {
    let s = useTool(editorOf('A = (0, 0)\nB = (4, 0)'), 'midpoint');
    s = input(s, click(s, 1, 2));
    const c = s.doc.objects.find((o) => o.name === 'C')?.id ?? -1;
    expect(s.toolState.picks).toEqual([c]);
    s = edit(s, { kind: 'undo' });
    expect(s.toolState.picks).toEqual([]);
    expect(s.tool).toBe('midpoint');
    expect(toolInput(s, click(s, 4, 0), env).ok).toBe(true);
  });

  it('a freed id taken by a new object is never used as an old pick', () => {
    let s = useTool(editorOf('A = (0, 0)\nB = (4, 0)'), 'midpoint');
    s = input(s, click(s, 1, 2));
    s = edit(s, { kind: 'undo' });
    s = edit(s, { kind: 'replaceText', text: '@version 1\nA = (0, 0)\nB = (4, 0)\nD = (-3, 7)' });
    s = input(s, click(s, 0, 0));
    s = input(s, click(s, 4, 0));
    const built = s.doc.objects[s.doc.objects.length - 1]?.name ?? '';
    expect(defText(s, built)).toBe('midpoint(A, B)');
  });

  it('picks that still exist are kept across an unrelated edit', () => {
    let s = useTool(editorOf('A = (0, 0)\nB = (4, 0)\nE = (9, 9)'), 'midpoint');
    s = input(s, click(s, 0, 0));
    const a = s.doc.objects.find((o) => o.name === 'A')?.id ?? -1;
    const e = s.doc.objects.find((o) => o.name === 'E')?.id ?? -1;
    s = edit(s, { kind: 'style', id: e, style: { color: 'red' } });
    expect(s.toolState.picks).toEqual([a]);
  });
});
