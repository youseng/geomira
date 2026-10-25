/**
 * The views UI's actions (views.ts; SPEC §8.3, §15, Run 13): save, switch, cycle, rename and
 * delete are each ONE document edit (one history entry, in the text, undone exactly); a
 * refusal leaves the state as it was; switching moves the canvas to the view's viewport.
 */
import { describe, expect, it } from 'vitest';
import { stable } from '@geomira/lang/canonical';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import type { EditResult } from '../src/result';
import type { EditorState } from '../src/state';
import {
  currentView,
  cycleView,
  deleteView,
  renameView,
  saveView,
  suggestedViewName,
  switchView,
  viewOf,
  viewShown,
} from '../src/views';
import { edit, editorOf, env, ok } from './helpers/editor';

const FIG = ['@layer aux', 'A = (0, 0)', 'B = (4, 0)', 'M = midpoint(A, B) [layers=aux]'].join(
  '\n',
);

const vp = (cx: number, cy: number, zoom: number) => ({ cx, cy, zoom });

/** The figure with two saved views: `all` (both layers, view 1) and `bare` (aux hidden, view 2). */
function twoViews(): EditorState {
  let s = edit(editorOf(FIG), { kind: 'viewport', viewport: vp(1, 2, 50) });
  s = ok(saveView(s, 'all', env));
  s = edit(s, { kind: 'updateLayer', id: auxId(s), patch: { visible: false } });
  s = edit(s, { kind: 'viewport', viewport: vp(-3, 4, 80) });
  return ok(saveView(s, 'bare', env));
}

function auxId(s: EditorState): string {
  const l = s.doc.layers.find((x) => x.name === 'aux');
  if (l === undefined) throw new Error('aux');
  return l.id;
}

function refusal(s: EditorState, r: EditResult): string {
  if (r.ok) throw new Error('accepted');
  expect(r.state).toBe(s);
  return r.reason;
}

const visible = (s: EditorState) => s.doc.layers.map((l) => [l.name, l.visible]);

describe('views UI: save', () => {
  it('saves every layer and the canvas viewport as one edit, printed as @view', () => {
    const s = edit(editorOf(FIG), { kind: 'viewport', viewport: vp(1, 2, 50) });
    const r = ok(saveView(s, ' all ', env));
    expect(r.doc.views).toEqual([viewOf(s, 'all')]);
    expect(r.doc.views[0]?.layerVisibility).toEqual({ main: true, [auxId(s)]: true });
    expect(r.doc.views[0]?.viewport).toEqual(vp(1, 2, 50));
    expect(r.history.past).toHaveLength(s.history.past.length + 1);
    expect(print(r.doc)).toMatch(/^@view all \[layers=main,aux\] \[viewport=1,2,50\]$/mu);
    expect(ok(applyEdit(r, { kind: 'undo' }, env)).doc).toBe(s.doc);
  });

  it('refuses a name in use or not grammatical, leaving the state', () => {
    const s = twoViews();
    expect(refusal(s, saveView(s, 'all', env))).toBe('the view name all is already used');
    expect(refusal(s, saveView(s, 'Two words', env))).toBe('"Two words" is not a valid name');
    expect(refusal(s, saveView(s, '', env))).toBe('a name cannot be empty');
  });

  it('suggests view1, view2, … not yet used', () => {
    let s = editorOf(FIG);
    expect(suggestedViewName(s.doc)).toBe('view1');
    s = ok(saveView(s, 'view1', env));
    s = ok(saveView(s, 'view3', env));
    expect(suggestedViewName(s.doc)).toBe('view2');
  });
});

describe('views UI: switch and cycle', () => {
  it('a switch is one applyView edit and moves the canvas to the view', () => {
    const s = twoViews();
    expect(currentView(s.doc)).toBeUndefined(); // the document has no @viewport yet
    const r = ok(switchView(s, 'all', env));
    expect(visible(r)).toEqual([
      ['main', true],
      ['aux', true],
    ]);
    expect(r.doc.viewport).toEqual(vp(1, 2, 50));
    expect(r.viewport).toEqual(vp(1, 2, 50));
    expect(r.history.past).toHaveLength(s.history.past.length + 1);
    expect(currentView(r.doc)).toBe('all');
    expect(print(r.doc)).toMatch(/^@viewport 1 2 50$/mu);
    // Undo restores the document exactly (L6); the canvas stays (viewport outside history).
    const u = ok(applyEdit(r, { kind: 'undo' }, env));
    expect(u.doc).toBe(s.doc);
    expect(u.viewport).toEqual(vp(1, 2, 50));
  });

  it('switching to the view already shown adds no history entry; the canvas still moves', () => {
    const s = ok(switchView(twoViews(), 'bare', env));
    const panned = edit(s, { kind: 'viewport', viewport: vp(9, 9, 10) });
    const r = ok(switchView(panned, 'bare', env));
    expect(r.doc).toBe(panned.doc);
    expect(r.history).toBe(panned.history);
    expect(r.viewport).toEqual(vp(-3, 4, 80));
  });

  it('a view without a viewport switches the layers and leaves the canvas', () => {
    let s = twoViews();
    s = ok(
      applyEdit(
        s,
        { kind: 'addView', view: { name: 'auxonly', layerVisibility: { main: false } } },
        env,
      ),
    );
    const r = ok(switchView(s, 'auxonly', env));
    expect(visible(r)).toEqual([
      ['main', false],
      ['aux', false],
    ]);
    expect(r.viewport).toEqual(s.viewport);
    expect(r.doc.viewport).toBe(s.doc.viewport);
  });

  it('cycles forward and backward from the view shown; with none shown, from the ends', () => {
    const s = twoViews();
    const first = ok(cycleView(s, 1, env));
    expect(currentView(first.doc)).toBe('all');
    const second = ok(cycleView(first, 1, env));
    expect(currentView(second.doc)).toBe('bare');
    expect(currentView(ok(cycleView(second, 1, env)).doc)).toBe('all');
    expect(currentView(ok(cycleView(second, -1, env)).doc)).toBe('all');
    expect(currentView(ok(cycleView(s, -1, env)).doc)).toBe('bare');
  });

  it('refuses an unknown view, and cycling without views says how to make one', () => {
    const s = twoViews();
    expect(refusal(s, switchView(s, 'nope', env))).toBe('there is no view "nope"');
    const e = editorOf(FIG);
    expect(refusal(e, cycleView(e, 1, env))).toBe(
      'there are no views: save one in the Layers panel',
    );
  });

  it('switching shows hidden layers of a locked layer too (visibility is not locked)', () => {
    let s = twoViews();
    s = edit(s, { kind: 'updateLayer', id: auxId(s), patch: { locked: true } });
    const r = ok(switchView(s, 'all', env));
    expect(visible(r)).toEqual([
      ['main', true],
      ['aux', true],
    ]);
  });

  it('a view is shown when its layers and its viewport match the document', () => {
    const s = ok(switchView(twoViews(), 'all', env));
    const all = s.doc.views[0];
    if (all === undefined) throw new Error('all');
    expect(viewShown(s.doc, all)).toBe(true);
    expect(viewShown({ ...s.doc, viewport: vp(1, 2, 51) }, all)).toBe(false);
    expect(viewShown({ ...s.doc, viewport: null }, all)).toBe(false);
    expect(viewShown(s.doc, { name: 'x', layerVisibility: {} })).toBe(true);
    expect(viewShown(s.doc, { name: 'x', layerVisibility: { nolayer: true } })).toBe(false);
  });
});

describe('views UI: rename and delete', () => {
  it('a rename is one edit, printed, and undone exactly', () => {
    const s = twoViews();
    const r = ok(renameView(s, 'all', ' overview ', env));
    expect(r.doc.views.map((v) => v.name)).toEqual(['overview', 'bare']);
    expect(print(r.doc)).toMatch(/^@view overview /mu);
    expect(r.history.past).toHaveLength(s.history.past.length + 1);
    expect(ok(applyEdit(r, { kind: 'undo' }, env)).doc).toBe(s.doc);
    expect(ok(renameView(s, 'all', 'all', env))).toBe(s);
  });

  it('a rename refuses a used, bad or unknown name and leaves the state', () => {
    const s = twoViews();
    expect(refusal(s, renameView(s, 'all', 'bare', env))).toBe(
      'the view name bare is already used',
    );
    expect(refusal(s, renameView(s, 'all', '1x', env))).toBe('"1x" is not a valid name');
    expect(refusal(s, renameView(s, 'gone', 'x', env))).toBe('there is no view "gone"');
  });

  it('a delete is one edit that keeps the layers; undo brings the view back', () => {
    const s = twoViews();
    const r = ok(deleteView(s, 'bare', env));
    expect(r.doc.views.map((v) => v.name)).toEqual(['all']);
    expect(r.doc.layers).toEqual(s.doc.layers);
    expect(print(r.doc)).not.toMatch(/@view bare/u);
    expect(ok(applyEdit(r, { kind: 'undo' }, env)).doc).toBe(s.doc);
    expect(refusal(r, deleteView(r, 'bare', env))).toBe('there is no view "bare"');
  });
});

describe('views UI: the text holds every view state (L5)', () => {
  it('after switch, rename, save and delete the printed text parses back to the same document', () => {
    let s = twoViews();
    const steps: ((x: EditorState) => EditResult)[] = [
      (x) => switchView(x, 'bare', env),
      (x) => renameView(x, 'bare', 'close_up', env),
      (x) => saveView(x, 'third', env),
      (x) => deleteView(x, 'all', env),
    ];
    for (const f of steps) {
      s = ok(f(s));
      const back = parse(print(s.doc), env.registry);
      expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(stable(back.doc)).toBe(stable(s.doc));
    }
    expect(s.doc.views.map((v) => v.name)).toEqual(['close_up', 'third']);
  });
});
