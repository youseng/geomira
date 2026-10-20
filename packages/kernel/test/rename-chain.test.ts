/**
 * Bug (found in Run 4): renameObject renamed the direct images of a source (X* follows X)
 * but not the images of those images in a chained derived layer (X** kept the old name),
 * which breaks I4 ("its name must be source + suffix").
 */
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { call, ref } from '../src/expr';
import { renameObject } from '../src/edit';
import { assertInvariants } from '../src/invariants';
import { addLayer } from '../src/layers';
import { derivedDocument } from './helpers/derived';
import { must } from './helpers/doc';

/** derivedDocument plus a layer "two" imaging "inv" (suffix *): A** and l** of A* and l*. */
function chained(): { doc: Document; ids: Record<string, number> } {
  const { doc, ids, layer } = derivedDocument();
  const r = addLayer(doc, 'two');
  if (!r.ok) throw new Error(r.error);
  const rule = must(must(doc.layers.find((l) => l.id === layer)).rule);
  let next = r.doc.nextId;
  const img = (name: string, src: number) => {
    const o = {
      id: next,
      name,
      def: call('apply', [ref(rule.transform.id), ref(src)]),
      style: {},
      layers: [r.layerId],
      managedBy: r.layerId,
    };
    next += 1;
    return o;
  };
  const [a2, l2, k2] = [
    img('A**', must(ids['A*'])),
    img('l**', must(ids['l*'])),
    img('K*', must(ids.K)),
  ];
  const doc2: Document = {
    ...r.doc,
    nextId: next,
    layers: r.doc.layers.map((l) =>
      l.id === r.layerId ? { ...l, rule: { ...rule, source: layer, exclude: [] } } : l,
    ),
    objects: [...r.doc.objects, a2, l2, k2],
  };
  return { doc: assertInvariants(doc2), ids: { ...ids, 'A**': a2.id, 'l**': l2.id, 'K*': k2.id } };
}

describe('renameObject with chained derived layers', () => {
  it('renames images of images too (Z, Z*, Z**)', () => {
    const { doc, ids } = chained();
    const r = renameObject(doc, must(ids.A), 'Z');
    if (!r.ok) throw new Error(r.error);
    expect(() => assertInvariants(r.doc)).not.toThrow();
    const name = (id: string) => r.doc.objects.find((o) => o.id === ids[id])?.name;
    expect([name('A'), name('A*'), name('A**'), name('l**'), name('K*')]).toEqual([
      'Z',
      'Z*',
      'Z**',
      'l**',
      'K*',
    ]);
    const k = renameObject(doc, must(ids.K), 'M');
    if (!k.ok) throw new Error(k.error);
    expect(k.doc.objects.find((o) => o.id === ids['K*'])?.name).toBe('M*');
  });
});
