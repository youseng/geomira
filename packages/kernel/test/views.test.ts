/** Views (SPEC §8.3): the data model — add, apply, remove — and I7 under layer removal. */
import { describe, expect, it } from 'vitest';
import type { DocEdit } from '../src/doc-edit';
import { checkInvariants } from '../src/invariants';
import { base, ed, imaged, refused } from './helpers/derived-fixture';

describe('views', () => {
  it('add, apply (layer visibility and viewport), remove', () => {
    const { doc, layer } = imaged();
    const v = ed(doc, {
      kind: 'addView',
      view: {
        name: 'only_image',
        layerVisibility: { main: false, [layer]: true },
        viewport: { cx: 1, cy: 2, zoom: 40 },
      },
    });
    expect(v.views).toEqual([
      {
        name: 'only_image',
        layerVisibility: { main: false, [layer]: true },
        viewport: { cx: 1, cy: 2, zoom: 40 },
      },
    ]);
    const a = ed(v, { kind: 'applyView', name: 'only_image' });
    expect(a.layers.map((l) => [l.id, l.visible])).toEqual([
      ['main', false],
      [layer, true],
    ]);
    expect(a.viewport).toEqual({ cx: 1, cy: 2, zoom: 40 });
    // Idempotent; a view without a viewport keeps the document's.
    expect(ed(a, { kind: 'applyView', name: 'only_image' })).toEqual(a);
    const w = ed(a, { kind: 'addView', view: { name: 'both', layerVisibility: { main: true } } });
    const b = ed(w, { kind: 'applyView', name: 'both' });
    expect(b.layers.map((l) => l.visible)).toEqual([true, true]);
    expect(b.viewport).toEqual({ cx: 1, cy: 2, zoom: 40 });
    const r = ed(b, { kind: 'removeView', name: 'only_image' });
    expect(r.views.map((x) => x.name)).toEqual(['both']);
    expect(r.layers).toEqual(b.layers);
  });

  it('refuses bad names, duplicates, missing layers, bad viewports and missing views', () => {
    const doc = base();
    const add = (e: DocEdit) => refused(doc, e);
    expect(add({ kind: 'addView', view: { name: 'Ma', layerVisibility: {} } })).toBe(
      '"Ma" is not a valid name: did you mean M_a?',
    );
    expect(add({ kind: 'addView', view: { name: 'v', layerVisibility: { L42: true } } })).toBe(
      'there is no layer "L42"',
    );
    expect(
      add({
        kind: 'addView',
        view: { name: 'v', layerVisibility: {}, viewport: { cx: 0, cy: 0, zoom: 0 } },
      }),
    ).toBe('a viewport needs finite coordinates and a zoom > 0');
    expect(
      add({
        kind: 'addView',
        view: { name: 'v', layerVisibility: {}, viewport: { cx: Number.NaN, cy: 0, zoom: 1 } },
      }),
    ).toBe('a viewport needs finite coordinates and a zoom > 0');
    const v = ed(doc, { kind: 'addView', view: { name: 'v', layerVisibility: {} } });
    expect(refused(v, { kind: 'addView', view: { name: 'v', layerVisibility: {} } })).toBe(
      'the view name v is already used',
    );
    expect(refused(v, { kind: 'applyView', name: 'w' })).toBe('there is no view "w"');
    expect(refused(v, { kind: 'removeView', name: 'w' })).toBe('there is no view "w"');
  });

  it('removing a layer drops it from every view (I7 keeps holding)', () => {
    const { doc, layer } = imaged();
    const v = ed(doc, {
      kind: 'addView',
      view: { name: 'v', layerVisibility: { main: true, [layer]: false } },
    });
    const r = ed(v, { kind: 'removeLayer', id: layer });
    expect(r.views).toEqual([{ name: 'v', layerVisibility: { main: true } }]);
    expect(checkInvariants(r)).toEqual([]);
  });
});
