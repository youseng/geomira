/**
 * Tools that create points work near a text's anchor (ADR-0028): its handle is not a point
 * of the figure, so a click there makes a free point or a glider as anywhere else.
 */
import { describe, expect, it } from 'vitest';
import { addedNames, click, defText, editorOf, input, useTool } from './helpers/editor';

const TEXT = `@viewport 0 0 50
A = (-4, 0)
B = (4, 0)
l = line(A, B)
t = text((0, 0.5), "the line l")
u = text((2, 0), "on l")
`;

describe('Point tool on a text anchor', () => {
  it('a free point at a text anchor off the curves', () => {
    const s = useTool(editorOf(TEXT), 'point');
    const after = input(s, click(s, 0, 0.5));
    const [name] = addedNames(s, after);
    if (name === undefined) throw new Error('nothing created');
    expect(defText(after, name)).toMatch(/^point\(/);
  });

  it('a glider at a text anchor on a line', () => {
    const s = useTool(editorOf(TEXT), 'point');
    const after = input(s, click(s, 2, 0));
    const [name] = addedNames(s, after);
    if (name === undefined) throw new Error('nothing created');
    expect(defText(after, name)).toMatch(/^on\(l, /);
  });

  it('the Segment tool makes its first endpoint at a text anchor', () => {
    const s = useTool(editorOf(TEXT), 'segment');
    const after = input(s, click(s, 0, 0.5));
    expect(addedNames(s, after)).toHaveLength(1);
  });
});
