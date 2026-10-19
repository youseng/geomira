import { describe, expect, it } from 'vitest';
import { findObject, findObjectByName, type Document } from '../src/document';
import {
  addObject,
  dependents,
  redefineObject,
  removeCascade,
  renameObject,
  setObjectLayers,
  setStyle,
  type EditResult,
} from '../src/edit';
import { call, ref } from '../src/expr';
import { assertInvariants } from '../src/invariants';
import { Builder, must, pt } from './helpers/doc';
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

function names(doc: Document): string[] {
  return doc.objects.map((o) => o.name);
}

function chain(): Builder {
  const b = new Builder();
  const A = b.point('A', 0, 0);
  const B = b.point('B', 4, 0);
  const M = b.call('M', 'midpoint', A, B);
  b.call('l', 'line', A, M);
  b.point('C', 1, 3);
  return b;
}

describe('addObject', () => {
  it('appends with a fresh id, default layer main, and never mutates its input', () => {
    const b = chain();
    const before = JSON.stringify(b.doc, (_k, v: unknown) =>
      typeof v === 'bigint' ? String(v) : v,
    );
    const r = ok(addObject(b.doc, { name: 'D', def: pt(5, 5) }));
    expect(r.id).toBe(b.doc.nextId);
    expect(r.doc.nextId).toBe(b.doc.nextId + 1);
    expect(findObject(r.doc, r.id)?.layers).toEqual(['main']);
    expect(JSON.stringify(b.doc, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v))).toBe(
      before,
    );
  });

  it('rejects bad names, used names, bad layers and missing references', () => {
    const b = chain();
    expect(err(addObject(b.doc, { name: 'Ma', def: pt(0, 0) }))).toMatch(/did you mean M_a/);
    expect(err(addObject(b.doc, { name: 'A', def: pt(0, 0) }))).toMatch(/already used/);
    const withClaim = {
      ...b.doc,
      claims: [{ id: 99, name: 'c', kind: 'collinear', args: [] }],
      nextId: 100,
    };
    expect(err(addObject(withClaim, { name: 'c', def: pt(0, 0) }))).toMatch(/already used/);
    expect(err(addObject(b.doc, { name: 'D', def: pt(0, 0), layers: [] }))).toMatch(
      /at least one layer/,
    );
    expect(err(addObject(b.doc, { name: 'D', def: pt(0, 0), layers: ['main', 'main'] }))).toMatch(
      /twice/,
    );
    expect(err(addObject(b.doc, { name: 'D', def: pt(0, 0), layers: ['x'] }))).toMatch(
      /no layer "x"/,
    );
    expect(err(addObject(b.doc, { name: 'D', def: call('midpoint', [ref(1), ref(77)]) }))).toMatch(
      /no object #77/,
    );
  });
});

describe('removeCascade and dependents', () => {
  it('removes the object and everything depending on it, and lists it all', () => {
    const b = chain();
    const doc = {
      ...b.doc,
      nextId: 50,
      claims: [
        { id: 40, kind: 'on', args: [b.ref('C'), b.ref('l')] },
        { id: 41, kind: 'x', args: [b.ref('C')] },
      ],
      assumptions: [{ id: 42, kind: 'acute', args: [b.ref('M')] }],
    };
    const r = ok(removeCascade(doc, b.id('B')));
    expect(r.removed.objects).toEqual([b.id('B'), b.id('M'), b.id('l')]);
    expect(r.removed.claims).toEqual([40]);
    expect(r.removed.assumptions).toEqual([42]);
    expect(names(r.doc)).toEqual(['A', 'C']);
    expect(r.doc.claims.map((c) => c.id)).toEqual([41]);
    expect(dependents(doc, [b.id('A')]).objects).toEqual([b.id('A'), b.id('M'), b.id('l')]);
    expect(err(removeCascade(doc, 1234))).toMatch(/no object #1234/);
  });

  it('removing a rule transform clears the rule and removes its images (derived layers)', () => {
    const { doc, ids, layer } = derivedDocument();
    const r = ok(removeCascade(doc, must(ids.t)));
    expect(r.removed.clearedRules).toEqual([layer]);
    expect(names(r.doc)).toEqual(['A', 'B', 'C', 'l']);
    expect(r.doc.layers.find((l) => l.id === layer)?.rule).toBeUndefined();
  });

  it('removing an excluded object prunes the exclusion list; removing a source removes its image', () => {
    const { doc, ids, layer } = derivedDocument();
    const r = ok(removeCascade(doc, must(ids.B)));
    expect(r.doc.layers.find((l) => l.id === layer)?.rule?.exclude).toEqual([]);
    expect(names(r.doc)).toEqual(['A', 'C', 'l', 't', 'A*', 'l*']);
    const s = ok(removeCascade(doc, must(ids.A)));
    expect(names(s.doc)).toEqual(['B', 'C', 't']);
  });
});

describe('renameObject', () => {
  it('renames; references are by id so definitions are untouched', () => {
    const b = chain();
    const r = ok(renameObject(b.doc, b.id('A'), 'P_1'));
    expect(names(r.doc)).toEqual(['P_1', 'B', 'M', 'l', 'C']);
    expect(r.doc.objects[2]?.def).toEqual(b.doc.objects[2]?.def);
    expect(ok(renameObject(b.doc, b.id('A'), 'A')).doc).toEqual(b.doc);
  });

  it('rejects bad, used and missing names and managed objects; images follow their source', () => {
    const b = chain();
    expect(err(renameObject(b.doc, b.id('A'), 'B'))).toMatch(/already used/);
    expect(err(renameObject(b.doc, b.id('A'), 'x y'))).toMatch(/not a valid name/);
    expect(err(renameObject(b.doc, 999, 'Z'))).toMatch(/no object/);
    const { doc, ids } = derivedDocument();
    expect(err(renameObject(doc, must(ids['A*']), 'Z'))).toMatch(/managed by layer/);
    const r = ok(renameObject(doc, must(ids.A), 'Z'));
    expect(findObject(r.doc, must(ids['A*']))?.name).toBe('Z*');
    const m = ok(renameObject(doc, must(ids.l), 'm'));
    expect(findObject(m.doc, must(ids['l*']))?.name).toBe('m*');
  });
});

describe('redefineObject', () => {
  it('redefines in place, or reorders when the new definition uses a later object', () => {
    const b = chain();
    const r = ok(redefineObject(b.doc, b.id('M'), call('midpoint', [b.ref('A'), b.ref('C')])));
    expect(names(r.doc)).toEqual(['A', 'B', 'C', 'M', 'l']);
    const s = ok(redefineObject(b.doc, b.id('A'), pt(1, 1)));
    expect(names(s.doc)).toEqual(names(b.doc));
  });

  it('rejects cycles, missing references, missing and managed objects', () => {
    const b = chain();
    expect(
      err(redefineObject(b.doc, b.id('A'), call('midpoint', [b.ref('A'), b.ref('B')]))),
    ).toMatch(/cycle: A cannot depend on A/);
    expect(
      err(redefineObject(b.doc, b.id('A'), call('midpoint', [b.ref('l'), b.ref('B')]))),
    ).toMatch(/cycle: A cannot depend on l/);
    expect(err(redefineObject(b.doc, b.id('A'), call('midpoint', [ref(77), b.ref('B')])))).toMatch(
      /no object #77/,
    );
    expect(err(redefineObject(b.doc, 999, pt(0, 0)))).toMatch(/no object #999/);
    const { doc, ids } = derivedDocument();
    expect(err(redefineObject(doc, must(ids['A*']), pt(0, 0)))).toMatch(/managed/);
  });

  it('repairs a misordered document, and reports a cycle in a cyclic one (invalid input)', () => {
    const b = chain();
    const reversed = { ...b.doc, objects: [...b.doc.objects].reverse() };
    expect(names(ok(redefineObject(reversed, b.id('C'), pt(2, 2))).doc)).toEqual([
      'C',
      'B',
      'A',
      'M',
      'l',
    ]);
    const [a, bb] = [b.id('A'), b.id('B')];
    const cyclic = {
      ...b.doc,
      objects: b.doc.objects.map((o) =>
        o.id === a
          ? { ...o, def: call('midpoint', [ref(bb), ref(bb)]) }
          : o.id === bb
            ? { ...o, def: call('midpoint', [ref(a), ref(a)]) }
            : o,
      ),
    };
    expect(err(redefineObject(cyclic, b.id('C'), pt(2, 2)))).toMatch(/cycle: C cannot be defined/);
  });
});

describe('setStyle and setObjectLayers', () => {
  it('replaces the style; [noimage] on a source removes its images and their dependents', () => {
    const b = chain();
    const r = ok(setStyle(b.doc, b.id('A'), { color: '#ff0000', hidden: true }));
    expect(findObjectByName(r.doc, 'A')?.style).toEqual({ color: '#ff0000', hidden: true });
    expect(err(setStyle(b.doc, 999, {}))).toMatch(/no object/);
    const { doc, ids } = derivedDocument();
    const s = ok(setStyle(doc, must(ids.A), { noimage: true }));
    expect(s.removed.objects).toEqual([ids['A*'], ids.K]);
    expect(ok(setStyle(doc, must(ids['A*']), { color: 'blue' })).removed.objects).toEqual([]);
  });

  it('moves objects between layers; leaving the source layer removes images', () => {
    const { doc, ids, layer } = derivedDocument();
    expect(ok(setObjectLayers(doc, must(ids.B), ['main', layer])).removed.objects).toEqual([]);
    const r = ok(setObjectLayers(doc, must(ids.A), [layer]));
    expect(r.removed.objects).toEqual([ids['A*'], ids.K]);
    expect(err(setObjectLayers(doc, must(ids['A*']), ['main']))).toMatch(/managed/);
    expect(err(setObjectLayers(doc, must(ids.A), []))).toMatch(/at least one layer/);
    expect(err(setObjectLayers(doc, 999, ['main']))).toMatch(/no object/);
  });
});
