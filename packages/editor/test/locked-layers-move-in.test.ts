/**
 * No object can be moved INTO a locked layer through the GUI (ADR-0020: nothing is added to
 * a locked layer that way): setLayers of an unlocked object onto a locked layer is refused
 * with "the layer given is locked: unlock it to add objects to it". Locking a layer that
 * holds objects is still allowed (the objects did not move).
 */
import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/edit';
import type { EditorState } from '../src/state';
import { edit, editorOf, env, idOf } from './helpers/editor';

const FIG = [
  '@layer given [locked]',
  '@layer aux',
  'A = (0, 0) [layers=given]',
  'B = (4, 0)',
  'C = (1, 3) [layers=aux]',
].join('\n');

function layerId(s: EditorState, name: string): string {
  const l = s.doc.layers.find((x) => x.name === name);
  if (l === undefined) throw new Error(name);
  return l.id;
}

describe('moving an object into a locked layer', () => {
  it('setLayers onto the locked layer is refused, the state unchanged', () => {
    const s = editorOf(FIG);
    for (const layers of [[layerId(s, 'given')], ['main', layerId(s, 'given')]]) {
      const r = applyEdit(s, { kind: 'setLayers', id: idOf(s, 'B'), layers }, env);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('the layer given is locked: unlock it to add objects to it');
      expect(r.state).toBe(s);
    }
  });

  it('setLayers between unlocked layers still applies', () => {
    const s = editorOf(FIG);
    const t = edit(s, { kind: 'setLayers', id: idOf(s, 'B'), layers: [layerId(s, 'aux')] });
    expect(t.doc.objects.find((o) => o.name === 'B')?.layers).toEqual([layerId(s, 'aux')]);
  });

  it('locking a layer that holds objects is still allowed', () => {
    const s = editorOf(FIG);
    const t = edit(s, { kind: 'updateLayer', id: layerId(s, 'aux'), patch: { locked: true } });
    expect(t.doc.layers.find((l) => l.name === 'aux')?.locked).toBe(true);
  });
});
