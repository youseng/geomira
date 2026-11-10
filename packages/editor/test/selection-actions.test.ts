/**
 * ADR-0060 in the editor core: several objects at once. The Move tool's extended click (Shift
 * or Ctrl) adds the clicked object to the selection or takes it out; the selection bar's
 * actions (hide, show, labels off and on, move to a layer, remove) are each ONE history entry
 * that one undo takes back; a refusal names its reason and changes nothing; "select all" takes
 * what is drawn; a new layer is offered the first free name of layer1, layer2, ….
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { toolInput } from '../src/machine';
import {
  layerNameProblem,
  nextLayerName,
  selectableIds,
  selectionEdit,
  selectionSummary,
  SELECTION_NAMES,
  type SelectionAction,
} from '../src/selection-actions';
import type { EditorState } from '../src/state';
import type { ToolInput } from '../src/machine';
import { click, edit, editorOf, env, hitAt, idOf, input } from './helpers/editor';

const FIGURE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'ω = circle(A, B, C)',
  'l = line(A, B)',
  'M = midpoint(A, B)',
].join('\n');

const names = (s: EditorState) =>
  s.selection.map((id) => s.doc.objects.find((o) => o.id === id)?.name);

function select(s: EditorState, ...ns: string[]): EditorState {
  return edit(s, { kind: 'select', ids: ns.map((n) => idOf(s, n)), mode: 'replace' });
}

/** The state after a selection action that must succeed. */
function act(s: EditorState, action: SelectionAction): EditorState {
  const r = selectionEdit(s, action);
  if (!r.ok) throw new Error(r.reason);
  return edit(s, r.edit);
}

/** A click at world (x, y) with Shift or Ctrl held. */
function extended(s: EditorState, x: number, y: number): ToolInput {
  return { kind: 'click', hit: hitAt(s, x, y), world: { x, y }, extend: true };
}

const lines = (s: EditorState) => print(s.doc).trimEnd().split('\n');

describe('the extended click of the Move tool (Shift or Ctrl)', () => {
  it('adds the clicked object to the selection, and takes it out again', () => {
    let s = input(editorOf(FIGURE), click(editorOf(FIGURE), 0, 0));
    expect(names(s)).toEqual(['A']);
    s = input(s, extended(s, 1, 3));
    expect(names(s)).toEqual(['A', 'C']);
    s = input(s, extended(s, 0, 0));
    expect(names(s)).toEqual(['C']);
  });

  it('on empty space keeps the selection (a plain click there clears it)', () => {
    const base = select(editorOf(FIGURE), 'A', 'C');
    expect(names(input(base, extended(base, 9, 9)))).toEqual(['A', 'C']);
    expect(names(input(base, click(base, 9, 9)))).toEqual([]);
  });

  it('is not a document edit: the history is untouched', () => {
    const base = editorOf(FIGURE);
    const s = input(base, extended(base, 1, 3));
    expect(s.doc).toBe(base.doc);
    expect(s.history).toBe(base.history);
  });

  it('a construction tool ignores it', () => {
    const base = edit(editorOf(FIGURE), { kind: 'tool', tool: 'segment' });
    const plain = toolInput(base, click(base, 0, 0), env);
    const held = toolInput(base, extended(base, 0, 0), env);
    expect(plain.ok && held.ok).toBe(true);
    expect(held.ok && held.state.toolState.picks).toEqual([idOf(base, 'A')]);
    expect(held.ok && held.state.toolState).toEqual(plain.ok && plain.state.toolState);
    expect(held.ok && held.state.selection).toEqual([]);
  });
});

describe('selection actions: one edit, one undo', () => {
  it('hide and show', () => {
    const base = select(editorOf(FIGURE), 'A', 'ω');
    const hidden = act(base, { kind: 'hide' });
    expect(lines(hidden)).toContain('A = (0, 0) [hidden]');
    expect(lines(hidden)).toContain('ω = circle(A, B, C) [hidden]');
    expect(hidden.history.past).toHaveLength(base.history.past.length + 1);
    expect(print(edit(hidden, { kind: 'undo' }).doc)).toBe(print(base.doc));
    const shown = act(hidden, { kind: 'show' });
    expect(print(shown.doc)).toBe(print(base.doc));
  });

  it('hide changes only what is not hidden yet, and keeps every other style', () => {
    const s = select(
      editorOf('A = (0, 0) [color=red, hidden]\nB = (4, 0) [color=blue, width=2]'),
      'A',
      'B',
    );
    const r = selectionEdit(s, { kind: 'hide' });
    expect(r.ok && r.count).toBe(1);
    expect(lines(act(s, { kind: 'hide' }))).toContain('B = (4, 0) [color=blue, width=2, hidden]');
  });

  it('labels off and on: a point shows its name again, a curve gets its name as label', () => {
    const base = select(editorOf(FIGURE), 'A', 'ω');
    const off = act(base, { kind: 'hideLabels' });
    // The circle shows no label by default: only A changes.
    expect(lines(off)).toContain('A = (0, 0) [label=""]');
    expect(lines(off)).toContain('ω = circle(A, B, C)');
    const on = act(off, { kind: 'showLabels' });
    expect(lines(on)).toContain('A = (0, 0)');
    expect(lines(on)).toContain('ω = circle(A, B, C) [label="ω"]');
    expect(on.history.past).toHaveLength(base.history.past.length + 2);
  });

  it('remove: an object another selected object takes with it is not named twice', () => {
    const base = select(editorOf(FIGURE), 'A', 'M', 'C');
    const s = act(base, { kind: 'remove' });
    expect(s.doc.objects.map((o) => o.name)).toEqual(['B']);
    expect(s.selection).toEqual([]);
    expect(print(edit(s, { kind: 'undo' }).doc)).toBe(print(base.doc));
  });

  it('move to a layer: every selected object, one entry; images are left to their rule', () => {
    let s = edit(editorOf(FIGURE), { kind: 'addLayer', name: 'aux' });
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    s = select(s, 'A', 'ω');
    const before = s.history.past.length;
    const moved = act(s, { kind: 'toLayer', layer: aux });
    expect(lines(moved)).toContain('A = (0, 0) [layers=aux]');
    expect(lines(moved)).toContain('ω = circle(A, B, C) [layers=aux]');
    expect(moved.history.past).toHaveLength(before + 1);
    expect(selectionEdit(moved, { kind: 'toLayer', layer: aux })).toEqual({
      ok: false,
      reason: 'the selected objects are in that layer already',
    });
  });

  it('a managed image is not moved or removed directly', () => {
    const s0 = editorOf(
      ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 't = reflect(line(A, B))'].join('\n') +
        '\n@layer inv = image(t, main)',
    );
    const s = select(s0, 'C*');
    expect(selectionEdit(s, { kind: 'remove' })).toEqual({
      ok: false,
      reason: 'the selected objects are images: they follow their sources',
    });
    expect(selectionEdit(s, { kind: 'toLayer', layer: 'main' }).ok).toBe(false);
    // Its style is its own (style A* [hidden], SPEC §11.1).
    expect(lines(act(s, { kind: 'hide' }))).toContain('style C* [hidden]');
  });
});

describe('refusals change nothing and say why', () => {
  it('an empty selection', () => {
    expect(selectionEdit(editorOf(FIGURE), { kind: 'hide' })).toEqual({
      ok: false,
      reason: 'nothing is selected',
    });
  });

  it('nothing to change', () => {
    const s = select(editorOf(FIGURE), 'ω');
    expect(selectionEdit(s, { kind: 'show' })).toEqual({
      ok: false,
      reason: 'no selected object is hidden',
    });
    expect(selectionEdit(s, { kind: 'hideLabels' })).toEqual({
      ok: false,
      reason: 'no selected object shows a label',
    });
    expect(selectionEdit(s, { kind: 'toLayer', layer: 'nope' })).toEqual({
      ok: false,
      reason: 'there is no layer "nope"',
    });
  });

  it('a locked layer refuses the batch whole (ADR-0020)', () => {
    let s = edit(editorOf(FIGURE), { kind: 'updateLayer', id: 'main', patch: { locked: true } });
    s = select(s, 'A', 'B');
    const r = selectionEdit(s, { kind: 'hide' });
    const applied = r.ok ? applyEdit(s, r.edit, env) : undefined;
    expect(applied?.ok).toBe(false);
    expect(applied?.state).toBe(s);
  });
});

describe('the selection bar summary', () => {
  it('names up to SELECTION_NAMES objects, then counts them', () => {
    expect(SELECTION_NAMES).toBe(3);
    expect(selectionSummary(select(editorOf(FIGURE), 'A', 'B', 'ω')).text).toBe('A, B, ω');
    expect(selectionSummary(select(editorOf(FIGURE), 'A', 'B', 'C', 'ω')).text).toBe('4 objects');
  });

  it('offers exactly the actions that would change something', () => {
    const base = select(editorOf(FIGURE), 'A', 'ω');
    expect(selectionSummary(base)).toMatchObject({
      count: 2,
      canHide: true,
      canShow: false,
      canHideLabels: true,
      canShowLabels: true,
    });
    expect(selectionSummary(act(base, { kind: 'hide' }))).toMatchObject({
      canHide: false,
      canShow: true,
    });
    expect(selectionSummary(editorOf(FIGURE)).count).toBe(0);
  });

  it('acts on given ids instead of the selection (the Objects panel’s eye)', () => {
    const base = select(editorOf(FIGURE), 'A');
    const r = selectionEdit(base, { kind: 'hide' }, [idOf(base, 'l')]);
    const s = r.ok ? edit(base, r.edit) : base;
    expect(lines(s)).toContain('l = line(A, B) [hidden]');
    expect(lines(s)).toContain('A = (0, 0)');
  });
});

describe('select all', () => {
  it('takes every object that is not hidden and is in a shown layer', () => {
    let s = edit(editorOf(`${FIGURE}\nH = (9, 9) [hidden]`), { kind: 'addLayer', name: 'aux' });
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    s = act(select(s, 'M'), { kind: 'toLayer', layer: aux });
    expect(selectableIds(s).map((id) => s.doc.objects.find((o) => o.id === id)?.name)).toEqual([
      'A',
      'B',
      'C',
      'ω',
      'l',
      'M',
    ]);
    s = edit(s, { kind: 'updateLayer', id: aux, patch: { visible: false } });
    expect(selectableIds(s)).not.toContain(idOf(s, 'M'));
    expect(selectableIds(s)).not.toContain(idOf(s, 'H'));
  });
});

describe('layers from the panel', () => {
  it('offers the first free name of layer1, layer2, …', () => {
    let s = editorOf(FIGURE);
    expect(nextLayerName(s.doc)).toBe('layer1');
    s = edit(s, { kind: 'addLayer', name: 'layer1' });
    s = edit(s, { kind: 'addLayer', name: 'layer3' });
    expect(nextLayerName(s.doc)).toBe('layer2');
  });

  it('a new layer is in the text, is one history entry, and undo removes it', () => {
    const base = editorOf(FIGURE);
    const s = edit(base, { kind: 'addLayer', name: nextLayerName(base.doc) });
    expect(lines(s)).toContain('@layer layer1');
    expect(s.history.past).toHaveLength(base.history.past.length + 1);
    expect(print(edit(s, { kind: 'undo' }).doc)).toBe(print(base.doc));
  });

  it('judges a name as the kernel does, before the edit is tried', () => {
    const s = edit(editorOf(FIGURE), { kind: 'addLayer', name: 'aux' });
    const aux = s.doc.layers.find((l) => l.name === 'aux')?.id ?? '';
    expect(layerNameProblem(s.doc, '')).toBe('type a name for the layer');
    expect(layerNameProblem(s.doc, 'aux')).toBe('the layer name aux is already used');
    expect(layerNameProblem(s.doc, 'aux', aux)).toBeUndefined();
    expect(layerNameProblem(s.doc, 'two words')).toBeDefined();
    expect(layerNameProblem(s.doc, 'sketch')).toBeUndefined();
    for (const name of ['', 'aux', 'two words', 'sketch']) {
      const tried = applyEdit(s, { kind: 'addLayer', name }, env);
      expect(tried.ok, name).toBe(layerNameProblem(s.doc, name) === undefined);
    }
  });
});
