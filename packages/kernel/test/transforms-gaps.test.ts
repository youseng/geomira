/**
 * Guards of the transformation core and of derived-layer sync that documents built by the
 * edits rarely reach (Run 4): direct calls of compute with hand-built values, and
 * syncProblems / syncDerived on hand-broken documents.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { syncDerived, syncProblems } from '../src/derived';
import { call, ref } from '../src/expr';
import { applySimilarity, similarity, transformOf } from '../src/similarity';
import type { Value } from '../src/value';
import { REGISTRY, must } from './helpers/doc';
import { idOf, imaged } from './helpers/derived-fixture';

const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
const CTX = { scale: 1 };

function direct<T>(F: Field<T>, tool: string, args: readonly Value<T>[]): Value<T> {
  return must(REGISTRY.get(tool)).compute(F, args, CTX);
}

describe('transformation guards (direct calls)', () => {
  it('apply maps no number or transform; Undefined and Inexact pass through', () => {
    for (const F of FIELDS) {
      const s = similarity(false, { re: F.one, im: F.zero }, { re: F.one, im: F.one });
      const n: Value<unknown> = { kind: 'number', v: F.one };
      expect(applySimilarity(F, s, n)).toEqual({
        kind: 'undefined',
        reason: 'apply does not map a number',
      });
      expect(applySimilarity(F, s, transformOf(s))).toEqual({
        kind: 'undefined',
        reason: 'apply does not map a transform',
      });
      const u: Value<unknown> = { kind: 'undefined', reason: 'x' };
      const i: Value<unknown> = { kind: 'inexact', reason: 'y' };
      expect(applySimilarity(F, s, u)).toBe(u);
      expect(applySimilarity(F, s, i)).toBe(i);
      const bad = (tool: string) => ({
        kind: 'undefined',
        reason: `${tool} received arguments it does not accept`,
      });
      expect(direct(F, 'apply', [transformOf(s), n])).toEqual(bad('apply'));
      expect(direct(F, 'apply', [transformOf(s)])).toEqual(bad('apply'));
      expect(direct(F, 'compose', [transformOf(s)])).toEqual(bad('compose'));
      expect(direct(F, 'inverse', [])).toEqual(bad('inverse'));
      expect(direct(F, 'rotate', [n, n, n, n])).toEqual(bad('rotate'));
      expect(direct(F, 'compose', [n, transformOf(s)])).toEqual(bad('compose'));
      const zero = similarity(false, { re: F.zero, im: F.zero }, { re: F.zero, im: F.zero });
      const why = {
        kind: 'undefined',
        reason: 'compose: the map collapses the plane (scale factor 0)',
      };
      expect(direct(F, 'compose', [transformOf(s), transformOf(zero)])).toEqual(why);
      expect(direct(F, 'compose', [transformOf(zero), transformOf(s)])).toEqual(why);
    }
  });
});

/** Replaces the objects of a document (hand-broken: invariants may fail too). */
function withObjects(doc: Document, f: (o: Document['objects']) => Document['objects']): Document {
  return { ...doc, objects: f(doc.objects) };
}

describe('syncProblems and syncDerived on hand-broken documents', () => {
  it('names a missing image, a stale one, a wrong name and a wrong definition; sync repairs them', () => {
    const { doc, layer } = imaged();
    const a = idOf(doc, 'A*');
    const missing = withObjects(doc, (os) => os.filter((o) => o.id !== a));
    expect(syncProblems(missing, REGISTRY)).toEqual(['A has no image in layer img']);
    const named = withObjects(doc, (os) => os.map((o) => (o.id === a ? { ...o, name: 'Z*' } : o)));
    expect(syncProblems(named, REGISTRY)).toEqual(['Z* has the wrong name']);
    const redef = withObjects(doc, (os) =>
      os.map((o) =>
        o.id === a ? { ...o, def: call('apply', [ref(idOf(doc, 'B')), ref(idOf(doc, 'A'))]) } : o,
      ),
    );
    expect(syncProblems(redef, REGISTRY)).toEqual(['A* has the wrong definition']);
    const stale = {
      ...doc,
      layers: doc.layers.map((l) =>
        l.id === layer ? { ...l, rule: { ...must(l.rule), exclude: [idOf(doc, 'A')] } } : l,
      ),
    };
    expect(syncProblems(stale, REGISTRY)).toEqual([
      'A* should not exist: its source is not imaged',
    ]);
    for (const broken of [missing, named, redef, stale]) {
      const r = syncDerived(broken, REGISTRY);
      if (!r.ok) throw new Error(r.error);
      expect(syncProblems(r.doc, REGISTRY)).toEqual([]);
    }
    const noRule = {
      ...doc,
      layers: doc.layers.map((l) =>
        l.id === layer
          ? {
              id: l.id,
              name: l.name,
              visible: l.visible,
              locked: l.locked,
              opacity: l.opacity,
              order: l.order,
            }
          : l,
      ),
    };
    expect(syncProblems(noRule, REGISTRY)).toContain('A* should not exist: its layer has no rule');
    const orphan = withObjects(doc, (os) => os.filter((o) => o.id !== idOf(doc, 'B')));
    expect(syncProblems(orphan, REGISTRY)).toContain('B* should not exist: its source is gone');
  });

  it('a cycle of rules (built by hand, refused by the edits) never ends in syncDerived', () => {
    const { doc, layer } = imaged();
    const r = must(must(doc.layers.find((l) => l.id === layer)).rule);
    const cyclic: Document = {
      ...doc,
      nextId: doc.nextId + 2,
      layers: [
        ...doc.layers,
        {
          id: `L${String(doc.nextId)}`,
          name: 'p',
          visible: true,
          locked: false,
          opacity: 1,
          order: 5,
          rule: { ...r, source: `L${String(doc.nextId + 1)}` },
        },
        {
          id: `L${String(doc.nextId + 1)}`,
          name: 'q',
          visible: true,
          locked: false,
          opacity: 1,
          order: 6,
          rule: { ...r, source: `L${String(doc.nextId)}`, suffix: '**' },
        },
      ],
      objects: doc.objects.map((o) =>
        o.name === 'C' ? { ...o, layers: ['main', `L${String(doc.nextId)}`] } : o,
      ),
    };
    expect(syncDerived(cyclic, REGISTRY)).toEqual({
      ok: false,
      error: 'cycle: the derived layers image each other without end',
    });
  });
});
