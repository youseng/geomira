/**
 * Locked layers (ADR-0020, the maintainer's decision on audit proposal P3): an object in a
 * locked layer cannot be dragged, edited or removed through the GUI (tools, the style
 * palette, drag, delete, the objects panel), and no object can be added to a locked layer
 * that way. The text (the text panel's replaceText, the command bar) still applies, and
 * so do undo and redo. Each refusal names the object and the layer and leaves the state as
 * it was.
 */
import { describe, expect, it } from 'vitest';
import { call, lit, ref } from '@geomira/kernel/expr';
import { print } from '@geomira/lang/print';
import { rational } from '@geomira/num/rational';
import { runCommand } from '../src/command';
import { applyEdit, type Edit } from '../src/edit';
import { toolInput } from '../src/machine';
import type { EditorState } from '../src/state';
import { click, edit, editorOf, env, idOf, useTool, xyOf } from './helpers/editor';

const FIG = [
  '@layer given [locked]',
  'A = (0, 0) [layers=given]',
  'B = (4, 0)',
  'C = (1, 3) [layers=given]',
  'M = midpoint(A, B)',
  'N = midpoint(B, C) [layers=given]',
].join('\n');

function layerId(s: EditorState, name: string): string {
  const l = s.doc.layers.find((x) => x.name === name);
  if (l === undefined) throw new Error(name);
  return l.id;
}

/** The refusal of an edit that must be refused: its reason; the state is the same object. */
function refused(s: EditorState, e: Edit): string {
  const r = applyEdit(s, e, env);
  if (r.ok) throw new Error(`accepted: ${e.kind}`);
  expect(r.state).toBe(s);
  return r.reason;
}

const LOCKED_A = 'A is in the locked layer given: unlock the layer to change it';

describe('a locked layer: no GUI edit of its objects', () => {
  it('the figure is read with the layer locked', () => {
    const s = editorOf(FIG);
    expect(s.doc.layers.find((l) => l.name === 'given')?.locked).toBe(true);
    expect(print(s.doc)).toContain('@layer given [locked]');
  });

  it('drag: refused at dragStart for an object in the layer, allowed for the others', () => {
    const s = editorOf(FIG);
    expect(refused(s, { kind: 'dragStart', id: idOf(s, 'A') })).toBe(
      'A is in the locked layer given: unlock the layer to drag it',
    );
    const t = edit(s, { kind: 'dragStart', id: idOf(s, 'B') });
    const u = edit(edit(t, { kind: 'dragMove', to: { x: 5, y: 1 } }), { kind: 'dragEnd' });
    expect(xyOf(u, 'B')).toEqual([5, 1]);
    expect(xyOf(u, 'A')).toEqual([0, 0]);
  });

  it('drag-through: dragging a free object that would rewrite a locked one is refused', () => {
    // t is a text anchored at A: dragging t moves A (ADR-0012 decision 10).
    const s = editorOf(`${FIG}\nt = text(A, "x")`);
    expect(refused(s, { kind: 'dragStart', id: idOf(s, 't') })).toBe(
      'A is in the locked layer given: unlock the layer to drag it',
    );
  });

  it('delete, rename, redefine, style, moving it to another layer: refused', () => {
    const s = editorOf(FIG);
    const A = idOf(s, 'A');
    expect(refused(s, { kind: 'remove', id: A })).toBe(
      'A is in the locked layer given: unlock the layer to remove it',
    );
    expect(refused(s, { kind: 'batch', label: 'remove', edits: [{ kind: 'remove', id: A }] })).toBe(
      'A is in the locked layer given: unlock the layer to remove it',
    );
    expect(refused(s, { kind: 'rename', id: A, name: 'P' })).toBe(LOCKED_A);
    const at = call('point', [lit(rational(1n, 1n)), lit(rational(1n, 1n))]);
    expect(refused(s, { kind: 'redefine', id: A, def: at })).toBe(LOCKED_A);
    expect(refused(s, { kind: 'style', id: A, style: { color: 'red' } })).toBe(LOCKED_A);
    expect(refused(s, { kind: 'setLayers', id: A, layers: ['main'] })).toBe(LOCKED_A);
  });

  it('removing an unlocked object whose dependents include a locked one: refused', () => {
    // N = midpoint(B, C) is in the locked layer; removing B would remove N.
    const s = editorOf(FIG);
    expect(refused(s, { kind: 'remove', id: idOf(s, 'B') })).toBe(
      'N is in the locked layer given: unlock the layer to remove it',
    );
    // M depends on A (locked) but is not locked itself: removing M is fine.
    expect(edit(s, { kind: 'remove', id: idOf(s, 'M') }).doc.objects.map((o) => o.name)).toEqual([
      'A',
      'B',
      'C',
      'N',
    ]);
  });

  it('removing the locked layer itself: refused while it is locked', () => {
    const s = editorOf(FIG);
    expect(refused(s, { kind: 'removeLayer', id: layerId(s, 'given') })).toBe(LOCKED_A);
  });

  it('tools: a new object is never added to a locked active layer; building from its objects is fine', () => {
    const s = editorOf(FIG);
    // The midpoint tool builds from locked A and C into the main layer.
    let t = useTool(s, 'midpoint');
    t = edit(t, { kind: 'activeLayer', id: 'main' });
    for (const [x, y] of [
      [0, 0],
      [1, 3],
    ] as const) {
      const r = toolInput(t, click(t, x, y), env);
      if (!r.ok) throw new Error(r.reason);
      t = r.state;
    }
    expect(t.doc.objects.at(-1)?.def).toEqual(
      call('midpoint', [ref(idOf(s, 'A')), ref(idOf(s, 'C'))]),
    );
    // With the locked layer active, the point tool's click is refused.
    let u = useTool(s, 'point');
    u = edit(u, { kind: 'activeLayer', id: layerId(s, 'given') });
    const r = toolInput(u, click(u, 7, 7), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('the layer given is locked: unlock it to add objects to it');
    expect(r.state.doc).toBe(u.doc);
  });

  it('the text still applies: the text panel changes a locked object, the command bar adds one', () => {
    const s = editorOf(FIG);
    const text = print(s.doc).replace('A = (0, 0)', 'A = (2, 2)');
    const t = edit(s, { kind: 'replaceText', text });
    expect(xyOf(t, 'A')).toEqual([2, 2]);
    // The command bar appends a statement to the text: it may add to a locked layer.
    const c = runCommand(t, 'D = (5, 5) [layers=given]', env);
    if (c.kind !== 'edit') throw new Error(c.reason);
    expect(xyOf(c.result.state, 'D')).toEqual([5, 5]);
  });

  it('unlocking the layer (a GUI edit of the layer) makes its objects editable; undo locks again', () => {
    const s = editorOf(FIG);
    const t = edit(s, {
      kind: 'updateLayer',
      id: layerId(s, 'given'),
      patch: { locked: false },
    });
    const u = edit(t, { kind: 'remove', id: idOf(t, 'A') });
    expect(u.doc.objects.some((o) => o.name === 'A')).toBe(false);
    const back = edit(edit(u, { kind: 'undo' }), { kind: 'undo' });
    expect(back.doc.layers.find((l) => l.name === 'given')?.locked).toBe(true);
    expect(refused(back, { kind: 'remove', id: idOf(back, 'A') })).toBe(
      'A is in the locked layer given: unlock the layer to remove it',
    );
  });
});

describe('a locked derived layer', () => {
  const DER = [
    'A = (0, 0)',
    'B = (4, 0)',
    'T = reflect(line(A, (0, 1)))',
    '@layer img = image(T, main) [locked]',
  ].join('\n');

  it('its rule cannot be changed or removed through the GUI; its source stays editable', () => {
    const s = editorOf(DER);
    const img = layerId(s, 'img');
    expect(refused(s, { kind: 'removeRule', layerId: img })).toBe(
      'the layer img is locked: unlock it to change its rule',
    );
    expect(refused(s, { kind: 'updateRule', layerId: img, patch: { suffix: '**' } })).toBe(
      'the layer img is locked: unlock it to change its rule',
    );
    // A is in main (unlocked): dragging it moves its image too, through the rule.
    const t = edit(s, { kind: 'dragStart', id: idOf(s, 'B') });
    const u = edit(edit(t, { kind: 'dragMove', to: { x: 5, y: 0 } }), { kind: 'dragEnd' });
    expect(xyOf(u, 'B*')).toEqual([-5, 0]);
  });
});
