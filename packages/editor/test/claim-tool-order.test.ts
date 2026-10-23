/**
 * The claim tool takes the picks of a claim kind whose parameters differ in kind (on: a point
 * and a curve) in either order, by ADR-0024 item 1's rule: clicking the curve first picks the
 * curve, it does not create a point on it. Kinds whose parameters have one kind keep their
 * order.
 */
import { describe, expect, it } from 'vitest';
import { toolPrompt } from '../src/prompt';
import {
  addedNames,
  click,
  editorOf,
  idOf,
  input,
  show,
  useTool,
  valueOf,
  xyOf,
} from './helpers/editor';
import type { EditorState } from '../src/state';

const FIG = [
  'A = (0, 3)',
  'B = (-2, 0)',
  'C = (3, 0)',
  'ω = circumcircle(A, B, C)',
  'H = orthocenter(A, B, C)',
  'X = reflect(H, line(B, C))',
].join('\n');

function claimText(s: EditorState): string {
  const [c] = s.doc.claims;
  if (c === undefined) throw new Error('no claim');
  return `${c.kind}(${c.args.map((a) => show(s, a)).join(', ')})`;
}

describe('claim tool: order-free picks for mixed kinds', () => {
  it('on: the curve clicked first, then the point, gives on(X, ω) and no new object', () => {
    const base = useTool(editorOf(FIG), 'claim', 'on');
    expect(toolPrompt(base)).toBe('Claim: on: point and on: curve, in either order');
    const w = valueOf(base, 'ω');
    if (w.kind !== 'circle') throw new Error('ω is not a circle');
    let s = input(base, click(base, w.c.x - Math.sqrt(w.r2), w.c.y));
    expect(addedNames(base, s)).toEqual([]);
    expect(s.toolState.picks).toEqual([idOf(s, 'ω')]);
    expect(toolPrompt(s)).toBe('Claim: on: point');
    const [x, y] = xyOf(s, 'X');
    s = input(s, click(s, x, y));
    expect(addedNames(base, s)).toEqual([]);
    expect(claimText(s)).toBe('on(X, ω)');
  });

  it('on: panel picks in either order', () => {
    let s = useTool(editorOf(FIG), 'claim', 'on');
    s = input(s, { kind: 'object', id: idOf(s, 'ω') });
    s = input(s, { kind: 'object', id: idOf(s, 'X') });
    expect(claimText(s)).toBe('on(X, ω)');
  });

  it('collinear keeps its order (one kind of step)', () => {
    const s = useTool(editorOf(FIG), 'claim', 'collinear');
    expect(toolPrompt(s)).toBe('Claim: collinear: point');
  });
});
