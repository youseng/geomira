/**
 * ADR-0051 (maintainer request, item 7): the maintainer could not claim from the GUI that the
 * cevians AP, BQ, CR of a triangle concur. Reproduced here, through the real scene's clicks:
 * (1) cevians not drawn: a line step of the claim tool refused a point ("click a line"), so a
 * line could not be given by two points; (2) cevians drawn as segments: the three picks were
 * taken, but the status line kept asking for another line and never said that the claim is
 * made with Finish. Now a line step takes a line, segment or ray, or two points (A, then P:
 * line(A, P)), and the prompt says when Finish (or the first object again) makes the claim.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { evalClaim } from '@geomira/claims/eval-claim';
import { toolInput, type ToolInput } from '../src/machine';
import { toolPrompt } from '../src/prompt';
import type { EditorState } from '../src/state';
import {
  click,
  docOf,
  editorOf,
  env,
  idOf,
  input,
  registry,
  show,
  useTool,
  xyOf,
} from './helpers/editor';

const TRIANGLE = [
  'A = (0, 4)',
  'B = (-3, 0)',
  'C = (4, 0)',
  'P = on(line(B, C), 2/5)',
  'Q = on(line(C, A), 1/2)',
  'R = intersect(line(C, intersect(line(A, P), line(B, Q))), line(A, B))',
].join('\n');

const SEGMENTS = `${TRIANGLE}\ns_1 = segment(A, P)\ns_2 = segment(B, Q)\ns_3 = segment(C, R)`;

function at(s: EditorState, name: string): ToolInput {
  const [x, y] = xyOf(s, name);
  return click(s, x, y);
}

/** A click on the segment from `a` to `b`, at the fraction t from a (away from crossings). */
function onSegment(s: EditorState, a: string, b: string, t: number): ToolInput {
  const [ax, ay] = xyOf(s, a);
  const [bx, by] = xyOf(s, b);
  return click(s, ax + t * (bx - ax), ay + t * (by - ay));
}

function claims(s: EditorState): string[] {
  return print(s.doc)
    .split('\n')
    .filter((l) => l.startsWith('claim '));
}

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((x, i) => input(x, i), s);
}

describe('the cevians AP, BQ, CR concur: claimed from the GUI', () => {
  it('not drawn: A then P, B then Q, C then R give concurrent(line(A, P), …)', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'concurrent');
    expect(toolPrompt(s)).toBe('Claim: concurrent: line (or two points)');
    s = input(s, at(s, 'A'));
    expect(toolPrompt(s)).toBe('Claim: concurrent: the second point of the line');
    s = run(s, at(s, 'P'), at(s, 'B'), at(s, 'Q'), at(s, 'C'), at(s, 'R'));
    expect(s.doc.claims).toEqual([]);
    expect(toolPrompt(s)).toBe('Claim: concurrent: line (or two points), or Finish');
    s = input(s, { kind: 'finish' });
    expect(claims(s)).toEqual(['claim concurrent(line(A, P), line(B, Q), line(C, R))']);
    // Nothing was added to the figure: the lines live in the claim.
    expect(s.doc.objects).toHaveLength(editorOf(TRIANGLE).doc.objects.length);
    const id = s.doc.claims[0]?.id ?? -1;
    expect(evalClaim(s.doc, id, registry).value).toBe('true');
  });

  it('the canonical text of a two-point line is line(A, P), and it reads back (P1)', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'concurrent');
    s = run(s, at(s, 'A'), at(s, 'P'), at(s, 'B'), at(s, 'Q'), at(s, 'C'), at(s, 'R'));
    s = input(s, { kind: 'finish' });
    const text = print(s.doc);
    expect(print(docOf(text))).toBe(text);
    expect(docOf(text).claims).toEqual(s.doc.claims);
  });

  it('drawn as segments: three picks, the prompt names Finish, and Finish makes the claim', () => {
    let s = useTool(editorOf(SEGMENTS), 'claim', 'concurrent');
    s = run(
      s,
      onSegment(s, 'A', 'P', 0.25),
      onSegment(s, 'B', 'Q', 0.25),
      onSegment(s, 'C', 'R', 0.25),
    );
    expect(toolPrompt(s)).toBe('Claim: concurrent: line (or two points), or Finish');
    s = input(s, { kind: 'finish' });
    expect(claims(s)).toEqual(['claim concurrent(s_1, s_2, s_3)']);
    expect(evalClaim(s.doc, s.doc.claims[0]?.id ?? -1, registry).value).toBe('true');
  });

  it('segments: picking the first one again makes the claim (as a polygon closes)', () => {
    let s = useTool(editorOf(SEGMENTS), 'claim', 'concurrent');
    s = run(
      s,
      onSegment(s, 'A', 'P', 0.25),
      onSegment(s, 'B', 'Q', 0.25),
      onSegment(s, 'C', 'R', 0.25),
      onSegment(s, 'A', 'P', 0.3),
    );
    expect(claims(s)).toEqual(['claim concurrent(s_1, s_2, s_3)']);
  });

  it('a segment, two points and a segment mix in one claim', () => {
    let s = useTool(editorOf(SEGMENTS), 'claim', 'concurrent');
    s = run(s, onSegment(s, 'A', 'P', 0.25), at(s, 'B'), at(s, 'Q'), onSegment(s, 'C', 'R', 0.25));
    s = input(s, { kind: 'finish' });
    expect(claims(s)).toEqual(['claim concurrent(s_1, line(B, Q), s_3)']);
  });

  it('panel picks work the same way: points make a line', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'concurrent');
    for (const n of ['A', 'P', 'B', 'Q', 'C', 'R'])
      s = input(s, { kind: 'object', id: idOf(s, n) });
    s = input(s, { kind: 'finish' });
    expect(claims(s)).toEqual(['claim concurrent(line(A, P), line(B, Q), line(C, R))']);
  });
});

describe('two-point lines in the other line kinds', () => {
  it('AB ⟂ AC: one point in two lines (perpendicular builds at its second line)', () => {
    let s = useTool(editorOf('A = (0, 0)\nB = (3, 0)\nC = (0, 2)'), 'claim', 'perpendicular');
    s = run(s, at(s, 'A'), at(s, 'B'), at(s, 'A'), at(s, 'C'));
    expect(claims(s)).toEqual(['claim perpendicular(line(A, B), line(A, C))']);
  });

  it('the second point cannot be the first one again', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'parallel');
    s = input(s, at(s, 'A'));
    const r = toolInput(s, at(s, 'A'), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pick a second point: a line needs two points');
  });

  it('Finish waits for the second point of a line', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'concurrent');
    s = run(s, at(s, 'A'), at(s, 'P'), at(s, 'B'), at(s, 'Q'), at(s, 'C'));
    const r = toolInput(s, { kind: 'finish' }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('pick the second point of the line first');
  });

  it('a click on empty space for a line step makes no point', () => {
    const s = useTool(editorOf(TRIANGLE), 'claim', 'parallel');
    const r = toolInput(s, click(s, -2, 6), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('parallel: line (or two points): click a line, or a point');
  });

  it('cancel drops a half-made line', () => {
    let s = useTool(editorOf(TRIANGLE), 'claim', 'parallel');
    s = input(s, at(s, 'A'));
    s = input(s, { kind: 'cancel' });
    expect(s.toolState.picks).toEqual([]);
    expect(toolPrompt(s)).toBe('Claim: parallel: line (or two points)');
    expect(show(s, { kind: 'ref', id: idOf(s, 'A') })).toBe('A');
  });
});
