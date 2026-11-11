/**
 * ADR-0064: select first, then the tool. The selection becomes the chosen tool's picks, in the
 * order it was selected; a selection that fits exactly builds at once (one edit, one undo); a
 * smaller one leaves picks waiting; three points with Circle (center, point) build the circle
 * through them (TOOL_ALTERNATIVES); a selection no tool takes chooses the tool with no picks
 * and says why.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { chooseTool, TOOL_ALTERNATIVES } from '../src/selection-tool';
import type { EditorState } from '../src/state';
import type { ToolId } from '../src/tool-state';
import { defText, edit, editorOf, env, idOf } from './helpers/editor';

const FIGURE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'P = (6, 3)',
  'ω = circle(A, B, C)',
  'l = line(A, B)',
].join('\n');

function selected(s: EditorState, ...names: string[]): EditorState {
  return edit(s, { kind: 'select', ids: names.map((n) => idOf(s, n)), mode: 'replace' });
}

function choose(s: EditorState, tool: ToolId) {
  const r = chooseTool(s, tool, env);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

const added = (before: EditorState, after: EditorState) =>
  after.doc.objects.filter((o) => !before.doc.objects.some((x) => x.id === o.id));

describe('a selection that fits the tool builds at once', () => {
  it('three points, then Circumcenter: one object, one undo, the tool stays', () => {
    const base = selected(editorOf(FIGURE), 'A', 'B', 'C');
    const r = choose(base, 'circumcenter');
    const [o] = added(base, r.state);
    expect(o === undefined ? '' : defText(r.state, o.name)).toBe('circumcenter(A, B, C)');
    expect(r.state.history.past).toHaveLength(base.history.past.length + 1);
    expect(r.state.tool).toBe('circumcenter');
    expect(r.state.toolState.picks).toEqual([]);
    expect(print(edit(r.state, { kind: 'undo' }).doc)).toBe(print(base.doc));
  });

  it('in the order of selection', () => {
    const base = selected(editorOf(FIGURE), 'B', 'A');
    const r = choose(base, 'ray');
    const [o] = added(base, r.state);
    expect(o === undefined ? '' : defText(r.state, o.name)).toBe('ray(B, A)');
  });

  it('a point and a circle in either order, then Tangent: both tangents', () => {
    for (const order of [
      ['P', 'ω'],
      ['ω', 'P'],
    ]) {
      const base = selected(editorOf(FIGURE), ...order);
      const r = choose(base, 'tangent');
      expect(added(base, r.state).map((o) => defText(r.state, o.name))).toEqual([
        'tangent_from(P, ω, orient(+))',
        'tangent_from(P, ω, orient(-))',
      ]);
    }
  });

  it('a polygon takes any number of points and finishes', () => {
    const base = selected(editorOf(FIGURE), 'A', 'B', 'P', 'C');
    const r = choose(base, 'polygon');
    expect(added(base, r.state).map((o) => defText(r.state, o.name))).toContain(
      'polygon(A, B, P, C)',
    );
  });
});

describe('the circle tools take each other’s selections', () => {
  it('three points with Circle (center, point): the circle through them; Circle stays', () => {
    expect(TOOL_ALTERNATIVES.circle).toEqual(['circle3']);
    const base = selected(editorOf(FIGURE), 'A', 'B', 'P');
    const r = choose(base, 'circle');
    expect(added(base, r.state).map((o) => defText(r.state, o.name))).toEqual(['circle(A, B, P)']);
    expect(r.state.tool).toBe('circle');
    expect(r.state.toolState.picks).toEqual([]);
  });

  it('two points with Circle (3 points): its own first picks win, it waits for the third', () => {
    const base = selected(editorOf(FIGURE), 'A', 'B');
    const r = choose(base, 'circle3');
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.toolState.picks).toEqual([idOf(base, 'A'), idOf(base, 'B')]);
    expect(r.state.tool).toBe('circle3');
  });

  it('two points with Circle (center, point): the circle about the first', () => {
    const base = selected(editorOf(FIGURE), 'P', 'A');
    const r = choose(base, 'circle');
    expect(added(base, r.state).map((o) => defText(r.state, o.name))).toEqual(['circle(P, A)']);
  });
});

describe('a selection smaller than the tool’s input', () => {
  it('becomes the first picks; the tool waits for the rest; the selection is cleared', () => {
    const base = selected(editorOf(FIGURE), 'A');
    const r = choose(base, 'circumcenter');
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.toolState.picks).toEqual([idOf(base, 'A')]);
    expect(r.state.selection).toEqual([]);
    expect(r.state.history).toBe(base.history);
  });
});

describe('a selection the tool does not take', () => {
  it('a pick refused: the tool is chosen with no picks, the selection stays, the reason', () => {
    const base = selected(editorOf(FIGURE), 'ω', 'l');
    const r = choose(base, 'midpoint');
    expect(r.state.tool).toBe('midpoint');
    expect(r.state.toolState.picks).toEqual([]);
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.selection).toEqual(base.selection);
    expect(r.notice).toMatch(/^the selection \(ω, l\) is not Midpoint's input: /u);
  });

  it('more objects than its steps and no alternative', () => {
    const base = selected(editorOf(FIGURE), 'A', 'B', 'C');
    const r = choose(base, 'midpoint');
    expect(r.state.doc).toBe(base.doc);
    expect(r.notice).toBe(
      "the selection (A, B, C) is not Midpoint's input: it takes a different number of objects",
    );
  });
});

describe('without a selection, and the Move tool', () => {
  it('is the plain tool switch', () => {
    const base = editorOf(FIGURE);
    const r = choose(base, 'circumcenter');
    expect(r.state.tool).toBe('circumcenter');
    expect(r.state.toolState.picks).toEqual([]);
    expect(r.notice).toBeUndefined();
    const sel = selected(base, 'A', 'B');
    const m = choose(sel, 'move');
    expect(m.state.selection).toEqual(sel.selection);
    expect(m.state.doc).toBe(sel.doc);
  });
});

describe('only a selection made in the Move tool counts', () => {
  it('after a tool built (and selected) O, the next tool starts with no picks', () => {
    let s = edit(editorOf(FIGURE), { kind: 'tool', tool: 'circumcenter' });
    s = selected(s, 'A', 'B', 'C');
    const r = choose(s, 'incircle');
    expect(r.state.toolState.picks).toEqual([]);
    expect(r.state.doc).toBe(s.doc);
    expect(r.notice).toBeUndefined();
  });
});
