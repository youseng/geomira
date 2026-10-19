/**
 * A document with a derived layer, built by hand (derived-layer rules are created by a
 * later run; Run 2's helpers must keep I4 on such documents).
 */
import type { DocObject, Document } from '../../src/document';
import { call, ref } from '../../src/expr';
import { assertInvariants } from '../../src/invariants';
import { addLayer } from '../../src/layers';
import { Builder, num, pt } from './doc';

export interface Derived {
  readonly doc: Document;
  readonly ids: Readonly<Record<string, number>>;
  readonly layer: string;
}

/**
 * main: A, B, C (C styled [noimage]), T = a placeholder transform object; layer "inv"
 * with rule image(T, main), suffix "*", exclude B: images A* and l* of A and l = line(A, C),
 * and a user object K in "inv" built from A*.
 */
export function derivedDocument(): Derived {
  const b = new Builder();
  const A = b.point('A', 1, 2);
  const B = b.point('B', 4, 6);
  const C = b.add('C', pt(-2, 5), { style: { noimage: true } });
  const l = b.call('l', 'line', A, C);
  const T = b.add('t', call('param', [num(0), num(1), num('1/2')]));
  const r = addLayer(b.doc, 'inv');
  if (!r.ok) throw new Error(r.error);
  const layer = r.layerId;
  const withRule: Document = {
    ...r.doc,
    layers: r.doc.layers.map((x) =>
      x.id === layer
        ? { ...x, rule: { transform: T, source: 'main', suffix: '*', exclude: [B.id] } }
        : x,
    ),
  };
  let next = withRule.nextId;
  const image = (src: DocObject): DocObject => {
    const id = next;
    next += 1;
    return {
      id,
      name: `${src.name}*`,
      def: call('apply', [ref(T.id), ref(src.id)]),
      style: {},
      layers: [layer],
      managedBy: layer,
    };
  };
  const [oa, ol] = [A.id, l.id].map((id) => withRule.objects.find((o) => o.id === id));
  if (oa === undefined || ol === undefined) throw new Error('missing source');
  const [ia, il] = [image(oa), image(ol)];
  const k: DocObject = {
    id: next,
    name: 'K',
    def: call('midpoint', [ref(ia.id), ref(B.id)]),
    style: {},
    layers: [layer],
  };
  const doc = assertInvariants({
    ...withRule,
    nextId: next + 1,
    objects: [...withRule.objects, ia, il, k],
  });
  return {
    doc,
    layer,
    ids: { A: A.id, B: B.id, C: C.id, l: l.id, t: T.id, 'A*': ia.id, 'l*': il.id, K: k.id },
  };
}
