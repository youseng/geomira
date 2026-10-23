/**
 * GUI tools and the command bar never add an object that is the same construction as an
 * existing one (ADR-0029): a tool reuses the existing object (selects it; a tool that goes on
 * picks it) and says so in the result's notice; the command bar refuses the statement with
 * the language's message.
 */
import { describe, expect, it } from 'vitest';
import { runCommand } from '../src/command';
import { toolInput } from '../src/machine';
import type { EditResult } from '../src/result';
import type { EditorState } from '../src/state';
import { addedNames, click, defText, editorOf, env, idOf, input, useTool } from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'D = (5, 3)',
  'l = line(A, B)',
  'w = circle(A, B, C)',
  'M = midpoint(A, B)',
  'ac = line(A, C)',
  'X = intersect(l, ac)',
].join('\n');

/** The last tool input (by object picks), which must succeed. */
function picks(s0: EditorState, tool: EditorState['tool'], names: readonly string[]): EditResult {
  let s = useTool(s0, tool);
  const ids = names.map((n) => idOf(s0, n));
  for (const id of ids.slice(0, -1)) s = input(s, { kind: 'object', id });
  return toolInput(s, { kind: 'object', id: ids[ids.length - 1] ?? -1 }, env);
}

function reused(base: EditorState, r: EditResult, name: string, notice: string): void {
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(addedNames(base, r.state)).toEqual([]);
  expect(r.state.doc).toBe(base.doc);
  expect(r.state.history).toEqual(useTool(base, r.state.tool).history);
  expect(r.id).toBe(idOf(base, name));
  expect(r.state.selection).toEqual([idOf(base, name)]);
  expect(r.notice).toBe(notice);
}

describe('a GUI tool reuses the object that is the same construction', () => {
  const base = editorOf(FIG);

  it('Line: B then A is l = line(A, B)', () => {
    reused(base, picks(base, 'line', ['B', 'A']), 'l', 'l is line(A, B) already');
  });

  it('Line: A then B is l too', () => {
    reused(base, picks(base, 'line', ['A', 'B']), 'l', 'l is line(A, B) already');
  });

  it('Circle (3 points): C, A, B is w = circle(A, B, C)', () => {
    reused(base, picks(base, 'circle3', ['C', 'A', 'B']), 'w', 'w is circle(A, B, C) already');
  });

  it('Circumcircle: B, C, A is w = circle(A, B, C) (the same construction)', () => {
    reused(base, picks(base, 'circumcircle', ['B', 'C', 'A']), 'w', 'w is circle(A, B, C) already');
  });

  it('Midpoint: B then A is M = midpoint(A, B)', () => {
    reused(base, picks(base, 'midpoint', ['B', 'A']), 'M', 'M is midpoint(A, B) already');
  });

  it('Intersection: ac then l is X = intersect(l, ac)', () => {
    reused(base, picks(base, 'intersection', ['ac', 'l']), 'X', 'X is intersect(l, ac) already');
  });

  it('what is not the same construction is still made: Ray B, A; Circle (center A, through B)', () => {
    const ray = picks(base, 'ray', ['B', 'A']);
    expect(ray.ok && addedNames(base, ray.state)).toHaveLength(1);
    const circle = picks(base, 'circle', ['A', 'B']);
    expect(circle.ok && addedNames(base, circle.state)).toHaveLength(1);
    expect(ray.ok && ray.notice).toBeUndefined();
  });

  it('both tangents a second time: nothing is added, both are reused and named', () => {
    const fig = editorOf('O = (0, 0)\nA = (1, 0)\nc = circle(O, A)\nP = (3, 1)');
    const once = picks(fig, 'tangent', ['P', 'c']);
    if (!once.ok) throw new Error(once.reason);
    const made = addedNames(fig, once.state);
    expect(made).toHaveLength(2);
    const again = picks(once.state, 'tangent', ['c', 'P']);
    if (!again.ok) throw new Error(again.reason);
    expect(addedNames(once.state, again.state)).toEqual([]);
    expect(again.state.selection).toEqual(made.map((n) => idOf(once.state, n)));
    expect(again.notice).toBe(
      made.map((n) => `${n} is ${defText(once.state, n)} already`).join('; '),
    );
  });

  it('a click that would create a hidden point again picks it, and the tool goes on', () => {
    const fig = editorOf(
      'A = (0, 0)\nB = (4, 0)\nC = (2, -2)\nD = (2, 2)\nE = (0, 3)\n' +
        'ab = line(A, B)\ncd = line(C, D)\nX = intersect(ab, cd) [hidden]',
    );
    let s = useTool(fig, 'line');
    const r = toolInput(s, click(s, 2, 0), env);
    if (!r.ok) throw new Error(r.reason);
    expect(addedNames(fig, r.state)).toEqual([]);
    expect(r.state.toolState.picks).toEqual([idOf(fig, 'X')]);
    expect(r.notice).toBe('X is intersect(ab, cd) already');
    s = r.state;
    s = input(s, { kind: 'object', id: idOf(fig, 'E') });
    expect(addedNames(fig, s)).toEqual(['l']);
    expect(defText(s, 'l')).toBe('line(X, E)');
  });
});

describe('the command bar refuses a statement that repeats a construction', () => {
  const base = editorOf(FIG);

  it('m = line(B, A): the language’s message, on the command’s line', () => {
    const r = runCommand(base, 'm = line(B, A)', env);
    expect(r).toEqual({
      kind: 'error',
      reason: 'm is the same construction as l (line(A, B)): use l',
      diagnostics: [
        {
          line: 1,
          column: 1,
          endColumn: 15,
          severity: 'error',
          message: 'm is the same construction as l (line(A, B)): use l',
          hint: 'write l where m is used, and delete this line',
        },
      ],
    });
  });

  it('circumcircle(B, C, A) and midpoint(B, A) too', () => {
    const r1 = runCommand(base, 'k = circumcircle(B, C, A)', env);
    expect(r1.kind === 'error' && r1.reason).toBe(
      'k is the same construction as w (circle(A, B, C)): use w',
    );
    const r2 = runCommand(base, 'N = midpoint(B, A)', env);
    expect(r2.kind === 'error' && r2.reason).toBe(
      'N is the same construction as M (midpoint(A, B)): use M',
    );
  });

  it('what is not a repeat is applied; a repeat already in the figure does not block others', () => {
    const r = runCommand(base, 'm = ray(B, A)', env);
    expect(r.kind).toBe('edit');
    const twice = editorOf(`${FIG}\nl2 = line(B, A)`);
    const r2 = runCommand(twice, 'N = midpoint(A, C)', env);
    expect(r2.kind).toBe('edit');
  });
});
