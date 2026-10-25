/** Renaming a view (the DocEdit renameView, view-rename.ts; the views UI of Run 13). */
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { base, ed, refused } from './helpers/derived-fixture';

function withViews(): Document {
  const a = ed(base(), {
    kind: 'addView',
    view: { name: 'first', layerVisibility: { main: true }, viewport: { cx: 1, cy: 2, zoom: 30 } },
  });
  return ed(a, { kind: 'addView', view: { name: 'second', layerVisibility: { main: false } } });
}

describe('renameView', () => {
  it('renames the view and keeps its content and its place in the list', () => {
    const doc = withViews();
    const r = ed(doc, { kind: 'renameView', from: 'first', to: 'overview' });
    expect(r.views).toEqual([
      {
        name: 'overview',
        layerVisibility: { main: true },
        viewport: { cx: 1, cy: 2, zoom: 30 },
      },
      { name: 'second', layerVisibility: { main: false } },
    ]);
    expect(r.layers).toEqual(doc.layers);
    expect(r.viewport).toEqual(doc.viewport);
    expect(r.objects).toEqual(doc.objects);
    // The renamed view applies under its new name, the old name is gone.
    expect(ed(r, { kind: 'applyView', name: 'overview' }).viewport).toEqual({
      cx: 1,
      cy: 2,
      zoom: 30,
    });
    expect(refused(r, { kind: 'applyView', name: 'first' })).toBe('there is no view "first"');
  });

  it('moves the comments anchored to the view with it, and only those', () => {
    const doc: Document = {
      ...withViews(),
      meta: {
        comments: [
          { anchor: { kind: 'view', name: 'first' }, lines: [' wide'], inline: ' all' },
          { anchor: { kind: 'view', name: 'second' }, lines: [' close'] },
          { anchor: { kind: 'header' }, lines: [' top'] },
        ],
      },
    };
    const r = ed(doc, { kind: 'renameView', from: 'first', to: 'overview' });
    expect(r.meta.comments).toEqual([
      { anchor: { kind: 'view', name: 'overview' }, lines: [' wide'], inline: ' all' },
      { anchor: { kind: 'view', name: 'second' }, lines: [' close'] },
      { anchor: { kind: 'header' }, lines: [' top'] },
    ]);
  });

  it('refuses an unknown view, a name that is not grammatical, and a name in use', () => {
    const doc = withViews();
    expect(refused(doc, { kind: 'renameView', from: 'nope', to: 'x' })).toBe(
      'there is no view "nope"',
    );
    expect(refused(doc, { kind: 'renameView', from: 'first', to: 'second' })).toBe(
      'the view name second is already used',
    );
    expect(refused(doc, { kind: 'renameView', from: 'first', to: '' })).toBe(
      'a name cannot be empty',
    );
    expect(refused(doc, { kind: 'renameView', from: 'first', to: '2nd' })).toBe(
      '"2nd" is not a valid name',
    );
    expect(refused(doc, { kind: 'renameView', from: 'first', to: 'claim' })).toBe(
      '"claim" is a keyword',
    );
  });

  it('renaming a view to its own name changes nothing', () => {
    const doc = withViews();
    const r = ed(doc, { kind: 'renameView', from: 'second', to: 'second' });
    expect(r.views).toEqual(doc.views);
  });
});
