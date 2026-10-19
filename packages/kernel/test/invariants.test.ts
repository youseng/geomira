import { rational } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_VERSION, emptyDocument, type DocObject, type Document } from '../src/document';
import { call, lit, ref } from '../src/expr';
import { assertInvariants, checkInvariants, type InvariantCode } from '../src/invariants';
import { Builder, must } from './helpers/doc';
import { derivedDocument } from './helpers/derived';

function codes(doc: Document): InvariantCode[] {
  return [...new Set(checkInvariants(doc).map((v) => v.code))];
}

function base(): Document {
  const b = new Builder();
  const A = b.point('A', 0, 0);
  const B = b.point('B', 1, 0);
  b.call('l', 'line', A, B);
  return b.doc;
}

function patchObject(doc: Document, name: string, patch: Partial<DocObject>): Document {
  return { ...doc, objects: doc.objects.map((o) => (o.name === name ? { ...o, ...patch } : o)) };
}

describe('checkInvariants', () => {
  it('accepts the empty document, a construction and a derived-layer document', () => {
    expect(checkInvariants(emptyDocument())).toEqual([]);
    expect(checkInvariants(base())).toEqual([]);
    expect(checkInvariants(derivedDocument().doc)).toEqual([]);
    expect(assertInvariants(base())).toEqual(base());
  });

  it('I1: duplicate, ungrammatical and reserved names', () => {
    expect(codes(patchObject(base(), 'B', { name: 'A' }))).toEqual(['I1']);
    expect(codes(patchObject(base(), 'B', { name: 'Ma' }))).toEqual(['I1']);
    expect(codes(patchObject(base(), 'B', { name: 'B*' }))).toEqual(['I1']);
    expect(codes(patchObject(base(), 'B', { name: 'claim' }))).toEqual(['I1']);
    const claim = {
      ...base(),
      claims: [{ id: 9, name: 'l', kind: 'collinear', args: [] }],
      nextId: 10,
    };
    expect(codes(claim)).toEqual(['I1']);
    const badClaimName = {
      ...base(),
      claims: [{ id: 9, name: '9x', kind: 'collinear', args: [] }],
      nextId: 10,
    };
    expect(codes(badClaimName)).toEqual(['I1']);
    const layers = base().layers;
    expect(
      codes({
        ...base(),
        layers: [...layers, { ...must(layers[0]), id: 'L9', name: 'main' }],
        nextId: 10,
      }),
    ).toEqual(['I1']);
    expect(
      codes({
        ...base(),
        layers: [...layers, { ...must(layers[0]), id: 'L9', name: 'Bad' }],
        nextId: 10,
      }),
    ).toEqual(['I1']);
  });

  it('I2: references must point to earlier objects', () => {
    const doc = base();
    const swapped = {
      ...doc,
      objects: [must(doc.objects[2]), must(doc.objects[0]), must(doc.objects[1])],
    };
    expect(codes(swapped)).toEqual(['I2']);
    expect(codes(patchObject(doc, 'l', { def: call('line', [ref(99), ref(1)]) }))).toEqual(['I2']);
    expect(codes(patchObject(doc, 'A', { def: call('midpoint', [ref(1), ref(1)]) }))).toEqual([
      'I2',
    ]);
  });

  it('I3: layers exist, are non-empty and listed once; main exists; ids unique; opacity in [0, 1]', () => {
    expect(codes(patchObject(base(), 'A', { layers: [] }))).toEqual(['I3']);
    expect(codes(patchObject(base(), 'A', { layers: ['nope'] }))).toEqual(['I3']);
    expect(codes(patchObject(base(), 'A', { layers: ['main', 'main'] }))).toEqual(['I3']);
    expect(codes({ ...base(), layers: [] })).toEqual(['I3']);
    const main = must(base().layers[0]);
    expect(codes({ ...base(), layers: [main, { ...main, name: 'second' }] })).toEqual(['I3']);
    expect(codes({ ...base(), layers: [{ ...main, opacity: 2 }] })).toEqual(['I3']);
    expect(codes({ ...base(), layers: [{ ...main, opacity: Number.NaN }] })).toEqual(['I3']);
  });

  it('I4: managed objects match their rule exactly', () => {
    const { doc, ids, layer } = derivedDocument();
    const img = (patch: Partial<DocObject>): Document => ({
      ...doc,
      objects: doc.objects.map((o) => (o.id === ids['A*'] ? { ...o, ...patch } : o)),
    });
    expect(codes(img({ name: 'A**' }))).toEqual(['I4']);
    expect(codes(img({ layers: ['main'] }))).toEqual(['I4']);
    expect(codes(img({ managedBy: 'main' }))).toEqual(['I4']);
    expect(
      codes(img({ def: call('apply', [ref(must(ids.t)), ref(must(ids.B))]), name: 'B*' })),
    ).toEqual(['I4']);
    expect(
      codes(img({ def: call('apply', [ref(must(ids.t)), ref(must(ids.C))]), name: 'C*' })),
    ).toEqual(['I4']);
    expect(codes(img({ def: call('apply', [ref(must(ids.A)), ref(must(ids.A))]) }))).toEqual([
      'I4',
    ]);
    expect(codes(img({ def: call('apply', [lit(rational(1n))]) }))).toEqual(['I4']);
    expect(codes(img({ def: call('rotate', [ref(must(ids.t)), ref(must(ids.A))]) }))).toEqual([
      'I4',
    ]);
    // A source moved out of the source layer, or listed twice.
    const outOfSource = {
      ...doc,
      objects: doc.objects.map((o) => (o.id === ids.A ? { ...o, layers: [layer] } : o)),
    };
    expect(codes(outOfSource)).toEqual(['I4']);
    const twice = {
      ...doc,
      nextId: doc.nextId + 1,
      objects: [
        ...doc.objects,
        { ...must(doc.objects.find((o) => o.id === ids['A*'])), id: doc.nextId },
      ],
    };
    expect(codes(twice)).toEqual(expect.arrayContaining(['I4']));
    // An image placed before its source.
    const early = [...doc.objects];
    const ai = early.findIndex((o) => o.id === ids['A*']);
    const [moved] = early.splice(ai, 1);
    early.unshift(must(moved));
    expect(codes({ ...doc, objects: early })).toEqual(expect.arrayContaining(['I4']));
  });

  it('I4: rules have an existing transform, source layer, star suffix, exclusions; no cycles', () => {
    const { doc, layer } = derivedDocument();
    const rule = must(must(doc.layers.find((l) => l.id === layer)).rule);
    const withRule = (r: Partial<typeof rule>, extra: Document['layers'] = []): Document => ({
      ...doc,
      layers: [
        ...doc.layers.map((l) => (l.id === layer ? { ...l, rule: { ...rule, ...r } } : l)),
        ...extra,
      ],
    });
    expect(codes(withRule({ suffix: "'" }))).toEqual(['I4']);
    expect(codes(withRule({ source: 'nope' }))).toEqual(['I4']);
    expect(codes(withRule({ source: layer }))).toEqual(['I4']);
    expect(codes(withRule({ transform: ref(999) }))).toEqual(['I4']);
    expect(codes(withRule({ exclude: [999] }))).toEqual(['I4']);
    const main = must(doc.layers[0]);
    const cyclic = withRule({ source: 'L90' }, [
      { ...main, id: 'L90', name: 'b', rule: { ...rule, source: 'L91' } },
      { ...main, id: 'L91', name: 'c', rule: { ...rule, source: 'L90' } },
    ]);
    expect(codes({ ...cyclic, nextId: 100 })).toEqual(['I4']);
  });

  it('I5: claims and assumptions reference existing objects', () => {
    const doc = base();
    expect(
      codes({
        ...doc,
        nextId: 10,
        claims: [{ id: 8, kind: 'collinear', args: [ref(1), ref(42)] }],
      }),
    ).toEqual(['I5']);
    expect(
      codes({
        ...doc,
        nextId: 10,
        assumptions: [{ id: 8, kind: 'acute', args: [call('f', [ref(42)])] }],
      }),
    ).toEqual(['I5']);
    expect(
      codes({ ...doc, nextId: 10, claims: [{ id: 8, kind: 'collinear', args: [ref(1)] }] }),
    ).toEqual([]);
  });

  it('I6: ids unique, issued by nextId', () => {
    const doc = base();
    expect(codes(patchObject(doc, 'B', { id: 1 }))).toEqual(expect.arrayContaining(['I6']));
    expect(codes({ ...doc, nextId: 2 })).toEqual(['I6']);
    expect(codes({ ...doc, nextId: 0 })).toEqual(['I6']);
    expect(codes({ ...doc, nextId: 1.5 })).toEqual(['I6']);
    expect(codes(patchObject(doc, 'A', { id: -1 }))).toEqual(expect.arrayContaining(['I6']));
    const main = must(doc.layers[0]);
    expect(codes({ ...doc, layers: [main, { ...main, id: 'X1', name: 'b' }] })).toEqual(['I6']);
    expect(codes({ ...doc, layers: [main, { ...main, id: 'L99', name: 'b' }] })).toEqual(['I6']);
    expect(codes({ ...doc, layers: [main, { ...main, id: 'L1', name: 'b' }] })).toEqual(['I6']);
    const claim = { id: 3, kind: 'collinear', args: [] };
    expect(codes({ ...doc, claims: [claim] })).toEqual(['I6']);
  });

  it('I7: views reference existing layers; view names unique', () => {
    const doc = base();
    expect(codes({ ...doc, views: [{ name: 'v', layerVisibility: { nope: true } }] })).toEqual([
      'I7',
    ]);
    const v = { name: 'v', layerVisibility: { main: true } };
    expect(codes({ ...doc, views: [v] })).toEqual([]);
    expect(codes({ ...doc, views: [v, v] })).toEqual(['I7']);
  });

  it('I8: the version is current', () => {
    expect(codes({ ...base(), version: DOCUMENT_VERSION + 1 })).toEqual(['I8']);
    expect(() => assertInvariants({ ...base(), version: 0 })).toThrow(/I8: version 0/);
  });
});
