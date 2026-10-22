/**
 * Run 10 audit, hunt item "derived-layer desync after rename/delete/redefine/move/undo"
 * (SPEC §9, ADR-0006): a chain of two derived layers through every edit that touches them.
 * After each edit the invariants and the layers' sync hold, the values equal a full
 * evaluation, and the document is its own text (L5). Every edit of the sequence is accepted.
 */
import { describe, expect, it } from 'vitest';
import { syncProblems } from '@geomira/kernel/derived';
import { checkInvariants } from '@geomira/kernel/invariants';
import { sameUpToIds } from '@geomira/lang/canonical';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { call, ref } from '@geomira/kernel/expr';
import { applyEdit, type Edit } from '../src/edit';
import { evaluationOf, type EditorState } from '../src/state';
import { editorOf, env, idOf, registry } from './helpers/editor';

function laws(s: EditorState): void {
  expect(checkInvariants(s.doc)).toEqual([]);
  expect(syncProblems(s.doc, registry)).toEqual([]);
  expect(s.values.values).toEqual(evaluationOf(s.doc, env).values);
  const text = print(s.doc);
  const back = parse(text, registry);
  expect(
    back.diagnostics.filter((d) => d.severity === 'error'),
    text,
  ).toEqual([]);
  expect(sameUpToIds(back.doc, s.doc), text).toBe(true);
}

function step(s: EditorState, e: Edit): EditorState {
  const r = applyEdit(s, e, env);
  if (!r.ok) throw new Error(`${e.kind} refused: ${r.reason}`);
  laws(r.state);
  return r.state;
}

function layerId(s: EditorState, name: string): string {
  const l = s.doc.layers.find((x) => x.name === name);
  if (l === undefined) throw new Error(name);
  return l.id;
}

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'D = (2, 5)',
  'T = reflect(line(A, B))',
  'U = rotate(A, 90)',
  '@layer m = image(T, main) [exclude=D]',
  '@layer n = image(U, m)',
  'E = midpoint(C, D)',
].join('\n');

describe('derived layers through the editor', () => {
  it('rename, redefine T, move T, remove, undo, redo, replaceText', () => {
    let s = editorOf(FIG);
    laws(s);
    const seq: ((s: EditorState) => Edit)[] = [
      (t) => ({ kind: 'rename', id: idOf(t, 'C'), name: 'C_1' }),
      (t) => ({
        kind: 'redefine',
        id: idOf(t, 'T'),
        def: call('reflect', [call('line', [ref(idOf(t, 'A')), ref(idOf(t, 'C_1'))])]),
      }),
      (t) => ({ kind: 'move', id: idOf(t, 'T'), index: t.doc.objects.length - 1 }),
      (t) => ({ kind: 'move', id: idOf(t, 'U'), index: 0 }),
      (t) => ({ kind: 'remove', id: idOf(t, 'D') }),
      () => ({ kind: 'undo' }),
      () => ({ kind: 'undo' }),
      () => ({ kind: 'redo' }),
      (t) => ({
        kind: 'updateRule',
        layerId: layerId(t, 'm'),
        patch: { exclude: [idOf(t, 'A'), idOf(t, 'E')] },
      }),
      (t) => ({ kind: 'redefine', id: idOf(t, 'E'), def: { kind: 'ref', id: idOf(t, 'C_1') } }),
      (t) => ({ kind: 'replaceText', text: print(t.doc).replace(/exclude=[^\]]*/u, 'exclude=B') }),
      () => ({ kind: 'undo' }),
      () => ({ kind: 'redo' }),
      (t) => ({
        kind: 'replaceText',
        text: print(t.doc).replace(/^U = .*$/mu, 'U = rotate(A, 45)'),
      }),
      (t) => ({ kind: 'removeRule', layerId: layerId(t, 'm') }),
      () => ({ kind: 'undo' }),
      (t) => ({ kind: 'remove', id: idOf(t, 'T') }),
      () => ({ kind: 'undo' }),
    ];
    for (const f of seq) s = step(s, f(s));
    expect(print(s.doc)).toContain('@layer n = image(U, m)');
  });
});
