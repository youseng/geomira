import { describe, expect, it } from 'vitest';
import { emptyDocument, findLayer, type Document } from '../src/document';
import type { EditResult } from '../src/edit';
import { addLayer, removeLayer, updateLayer } from '../src/layers';
import { assertInvariants } from '../src/invariants';
import { Builder, must } from './helpers/doc';
import { derivedDocument } from './helpers/derived';

function ok<X extends object>(r: EditResult<X>): { readonly doc: Document } & X {
  if (!r.ok) throw new Error(r.error);
  assertInvariants(r.doc);
  return r;
}

function err(r: { ok: boolean; error?: string }): string {
  expect(r.ok).toBe(false);
  return r.error ?? '';
}

describe('layers', () => {
  it('addLayer: a plain layer on top, with an id from nextId', () => {
    const r = ok(addLayer(emptyDocument(), 'aux', { visible: false, opacity: 0.5 }));
    expect(r.layerId).toBe('L1');
    expect(findLayer(r.doc, 'L1')?.name).toBe('aux');
    expect(findLayer(r.doc, 'L2')).toBeUndefined();
    expect(r.doc.layers[1]).toEqual({
      id: 'L1',
      name: 'aux',
      visible: false,
      locked: false,
      opacity: 0.5,
      order: 1,
    });
    const s = ok(addLayer(r.doc, 'more', { locked: true }));
    expect(s.doc.layers[2]?.order).toBe(2);
    expect(err(addLayer(r.doc, 'aux'))).toMatch(/already used/);
    expect(err(addLayer(r.doc, 'Bad name'))).toMatch(/not a valid name/);
    expect(err(addLayer(r.doc, 'x', { opacity: 1.5 }))).toMatch(/opacity/);
  });

  it('updateLayer: renames and changes flags', () => {
    const r = ok(addLayer(emptyDocument(), 'aux'));
    const s = ok(
      updateLayer(r.doc, r.layerId, { name: 'help', visible: false, locked: true, opacity: 0 }),
    );
    expect(s.doc.layers[1]).toMatchObject({
      name: 'help',
      visible: false,
      locked: true,
      opacity: 0,
    });
    expect(ok(updateLayer(r.doc, r.layerId, { name: 'aux' })).doc).toEqual(r.doc);
    expect(err(updateLayer(r.doc, r.layerId, { name: 'main' }))).toMatch(/already used/);
    expect(err(updateLayer(r.doc, r.layerId, { opacity: -1 }))).toMatch(/opacity/);
    expect(err(updateLayer(r.doc, 'L9', { visible: true }))).toMatch(/no layer/);
  });

  it('removeLayer: objects only there move to main, views forget it', () => {
    const r = ok(addLayer(emptyDocument(), 'aux'));
    const b = new Builder();
    b.doc = {
      ...r.doc,
      views: [
        { name: 'v', layerVisibility: { main: true, [r.layerId]: false } },
        { name: 'w', layerVisibility: {} },
      ],
    };
    b.add('A', { kind: 'call', tool: 'point', args: [], selectors: [] }, { layers: [r.layerId] });
    b.add(
      'B',
      { kind: 'call', tool: 'point', args: [], selectors: [] },
      { layers: ['main', r.layerId] },
    );
    const s = ok(removeLayer(b.doc, r.layerId));
    expect(s.doc.objects.map((o) => o.layers)).toEqual([['main'], ['main']]);
    expect(s.doc.views.map((v) => v.layerVisibility)).toEqual([{ main: true }, {}]);
    expect(s.removed.objects).toEqual([]);
  });

  it('removeLayer: main and rule sources cannot be removed; a derived layer takes its images', () => {
    const { doc, ids, layer } = derivedDocument();
    expect(err(removeLayer(doc, 'main'))).toMatch(/main layer cannot be removed/);
    expect(err(removeLayer(doc, 'L99'))).toMatch(/no layer/);
    const r = ok(removeLayer(doc, layer));
    expect(r.removed.objects).toEqual([ids['A*'], ids['l*'], ids.K]);
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 'B', 'C', 'l', 't']);
    const chained = ok(addLayer(doc, 'other'));
    const withRule: Document = {
      ...chained.doc,
      layers: chained.doc.layers.map((l) =>
        l.id === chained.layerId
          ? { ...l, rule: { ...must(doc.layers[1]?.rule), source: layer } }
          : l,
      ),
    };
    assertInvariants(withRule);
    expect(err(removeLayer(withRule, layer))).toMatch(/is the source of layer "other"/);
  });
});
