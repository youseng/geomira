import { describe, expect, it } from 'vitest';
import { buildScene } from '@geomira/scene/build';
import { print } from '@geomira/lang/print';
import { objectsByLayer } from '../src/panels';
import { selectableIds, selectionEdit, selectionSummary } from '../src/selection-actions';
import { edit, editorOf, idOf } from './helpers/editor';

const FIGURE = 'A=(0,0)\nB=(4,0)\nC=(1,3) [hidden]\nt=reflect(line(A,B))\n@layer inv=image(t,main)';
const drawn = (s: ReturnType<typeof editorOf>, name: string) =>
  buildScene(s.doc, s.values.values).primitives.some((p) => p.id === idOf(s, name));

describe('inherited visibility is the visibility edited by the GUI', () => {
  it('shows a hidden image with one override and one undo while leaving its source hidden', () => {
    const original = editorOf(FIGURE);
    const image = idOf(original, 'C*');
    expect(
      objectsByLayer(original)
        .flatMap((g) => g.rows)
        .find((r) => r.id === image)?.hidden,
    ).toBe(true);
    expect(selectableIds(original)).not.toContain(image);
    const s = edit(original, { kind: 'select', ids: [image], mode: 'replace' });
    expect(selectionSummary(s).canShow).toBe(true);
    const result = selectionEdit(s, { kind: 'show' });
    if (!result.ok) throw new Error(result.reason);
    const shown = edit(s, result.edit);
    expect(drawn(shown, 'C*')).toBe(true);
    expect(drawn(shown, 'C')).toBe(false);
    expect(print(shown.doc)).toContain('hidden=false');
    expect(edit(shown, { kind: 'undo' }).doc).toEqual(original.doc);
    expect(drawn(edit(edit(shown, { kind: 'undo' }), { kind: 'redo' }), 'C*')).toBe(true);
    expect(drawn(editorOf(print(shown.doc)), 'C*')).toBe(true);
  });
  it('shows mixed normal and inherited-hidden objects as one batch, with terse normal style', () => {
    let s = editorOf(FIGURE + '\nD=(2,5) [hidden]');
    s = edit(s, { kind: 'select', ids: ['C*', 'D'].map((n) => idOf(s, n)), mode: 'replace' });
    const result = selectionEdit(s, { kind: 'show' });
    if (!result.ok) throw new Error(result.reason);
    const shown = edit(s, result.edit);
    expect(result.count).toBe(2);
    expect(shown.doc.objects.find((o) => o.name === 'D')?.style).toEqual({});
    expect(edit(shown, { kind: 'undo' }).doc).toEqual(s.doc);
  });
});

it('an eye cannot secretly enable a hidden layer or make undefined geometry drawable', () => {
  let s = editorOf(FIGURE + '\nX=intersect(line(A,B),line(A,B))');
  s = edit(s, { kind: 'updateLayer', id: 'main', patch: { visible: false } });
  const rows = objectsByLayer(s).flatMap((g) => g.rows);
  expect(rows.find((r) => r.name === 'C')?.visibilityNote).toContain('layers are hidden');
  expect(rows.find((r) => r.name === 'X')?.status).toBe('undefined');
  const result = selectionEdit(s, { kind: 'show' }, [idOf(s, 'C')]);
  if (!result.ok) throw new Error(result.reason);
  const shown = edit(s, result.edit);
  expect(shown.doc.layers).toEqual(s.doc.layers);
  expect(drawn(shown, 'C')).toBe(false);
});
