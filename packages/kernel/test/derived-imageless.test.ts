import { describe, expect, it } from 'vitest';
import { emptyDocument } from '../src/document';
import { applyDocEdit } from '../src/doc-edit';
import { call, lit, ref } from '../src/expr';
import { syncDerived } from '../src/derived';
import { createRegistry } from '../src/registry';
import { rational } from '@geomira/num/rational';

/**
 * syncDerived's early exit (Run 9a, note F): a document without rules or images is returned
 * unchanged (no image added or removed), as the general path does; with a rule it still images.
 */
describe('syncDerived without rules or images', () => {
  const registry = createRegistry();
  const add = (
    doc: ReturnType<typeof emptyDocument>,
    name: string,
    def: ReturnType<typeof call>,
  ) => {
    const r = applyDocEdit(doc, registry, { kind: 'add', object: { name, def } });
    if (!r.ok) throw new Error(r.error);
    return r.doc;
  };
  const pt = (x: number, y: number) =>
    call('point', [lit(rational(BigInt(x))), lit(rational(BigInt(y)))]);

  it('returns the same objects, adds and removes nothing', () => {
    let doc = add(emptyDocument(), 'A', pt(0, 0));
    doc = add(doc, 'B', pt(4, 0));
    doc = add(
      doc,
      'M',
      call('midpoint', [ref(doc.objects[0]?.id ?? 0), ref(doc.objects[1]?.id ?? 0)]),
    );
    const r = syncDerived(doc, registry);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.objects).toEqual(doc.objects);
    expect(r.added).toEqual([]);
    expect(r.removed.objects).toEqual([]);
  });

  it('a document with a rule is still imaged', () => {
    let doc = add(emptyDocument(), 'A', pt(0, 0));
    doc = add(doc, 'B', pt(4, 0));
    doc = add(doc, 'P', pt(1, 2));
    const [a, b] = [doc.objects[0]?.id ?? 0, doc.objects[1]?.id ?? 0];
    doc = add(doc, 's', call('reflect', [call('line', [ref(a), ref(b)])]));
    const s = doc.objects[3]?.id ?? 0;
    const spec = { name: 'r', transform: s, source: 'main' };
    const r = applyDocEdit(doc, registry, { kind: 'addDerivedLayer', spec });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.objects.map((o) => o.name)).toContain('P*');
  });
});
