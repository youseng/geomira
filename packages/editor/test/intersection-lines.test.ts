/**
 * The intersection tool on two lines (or segments, rays) checks what it builds, as it does for
 * curves that can meet twice (ADR-0024 item 3): segments whose ranges miss are refused instead of
 * adding an Undefined point; parallel lines make their point at infinity (ADR-0042). (A point that is
 * a point of the figure already is still made: frozen tests in machine.test.ts and
 * geomdraw-tools.test.ts assert intersect(line(A, B), line(A, C)) is built.)
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import type { EditorState } from '../src/state';
import { addedNames, defText, editorOf, env, idOf, input, useTool, xyOf } from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'D = (5, 3)',
  'ab = line(A, B)',
  'ac = line(A, C)',
  'cd = line(C, D)',
  'bc = line(B, C)',
  'ad = line(A, D)',
  's1 = segment(A, B)',
  's2 = segment(C, (3, 2))',
].join('\n');

function picked(a: string): EditorState {
  let s = useTool(editorOf(FIG), 'intersection');
  s = input(s, { kind: 'object', id: idOf(s, a) });
  return s;
}

function refusedWith(a: string, b: string, reason: string): void {
  const s = picked(a);
  const r = toolInput(s, { kind: 'object', id: idOf(s, b) }, env);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe(reason);
  expect(r.state.doc).toBe(s.doc);
}

describe('intersection tool on two lines', () => {
  it('parallel lines: their point at infinity, selected, with a notice (ADR-0042)', () => {
    const r = toolInput(picked('ab'), { kind: 'object', id: idOf(picked('ab'), 'cd') }, env);
    expect(r.ok && r.notice).toBe('point at infinity, direction of ab');
    expect(r.ok && r.state.values.values.get(r.id ?? -1)?.kind).toBe('ideal_point');
    expect(r.state.selection).toEqual(r.ok ? [r.id] : []);
  });

  it('segments that do not meet: refused, no Undefined point', () => {
    refusedWith('s1', 's2', 'the curves do not meet here');
  });

  it('lines that meet at a new point still make it', () => {
    const base = editorOf(FIG);
    const s = input(picked('ad'), { kind: 'object', id: idOf(base, 'bc') });
    expect(addedNames(base, s)).toEqual(['E']);
    expect(defText(s, 'E')).toBe('intersect(ad, bc)');
    expect(xyOf(s, 'E')).toEqual([2.5, 1.5]);
  });
});
