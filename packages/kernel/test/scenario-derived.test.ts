/**
 * Run 4 acceptance scenario (item 7): triangle ABC, its circumcircle, the orthocentre H;
 * the derived layer ref = image(reflect(line(A, B)), main). Every step goes through
 * applyDocEdit and is checked against invariants I1–I8 (L7) and the rules (L13 sync).
 * The scene run (Run 7) checks that A*, B* and l* are not drawn while their sources are.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { applyDocEdit, type DocEdit } from '../src/doc-edit';
import { syncProblems } from '../src/derived';
import { dragThrough } from '../src/drag';
import { call, type Expr } from '../src/expr';
import type { Value } from '../src/value';
import { assertInvariants } from '../src/invariants';
import { Builder, REGISTRY, contextOf, evalDoc, must, pt, valueOf } from './helpers/doc';
import { fq } from './helpers/degenerate-transforms';
import { sameValues } from './helpers/similarity-gen';

function apply(doc: Document, e: DocEdit): Document {
  const r = applyDocEdit(doc, REGISTRY, e);
  if (!r.ok) throw new Error(r.error);
  assertInvariants(r.doc);
  expect(syncProblems(r.doc, REGISTRY)).toEqual([]);
  return r.doc;
}

function id(doc: Document, name: string): number {
  return must(
    doc.objects.find((o) => o.name === name),
    name,
  ).id;
}

/** The figure, and the document with the layer ref. */
function scenario(): { doc: Document; layer: string } {
  const b = new Builder();
  const [A, B, C] = [b.point('A', 0, 0), b.point('B', 8, 0), b.point('C', 3, 6)];
  b.call('l', 'line', A, B);
  b.call('ω', 'circumcircle', A, B, C);
  b.call('H', 'orthocenter', A, B, C);
  b.add('t', call('reflect', [b.ref('l')]));
  const r = applyDocEdit(b.doc, REGISTRY, {
    kind: 'addDerivedLayer',
    spec: { name: 'ref', transform: b.id('t'), source: 'main' },
  });
  if (!r.ok) throw new Error(r.error);
  assertInvariants(r.doc);
  return { doc: r.doc, layer: must(r.layerId) };
}

const ref = (doc: Document, name: string): Expr => ({ kind: 'ref', id: id(doc, name) });

describe('scenario: triangle, circumcircle, orthocentre, reflected in AB', () => {
  it('ref = image(reflect(line(A, B)), main): images of every geometric object, not of t', () => {
    const { doc, layer } = scenario();
    expect(syncProblems(doc, REGISTRY)).toEqual([]);
    expect(doc.objects.map((o) => o.name)).toEqual([
      'A',
      'B',
      'C',
      'l',
      'ω',
      'H',
      't',
      'A*',
      'B*',
      'C*',
      'l*',
      'ω*',
      'H*',
    ]);
    for (const o of doc.objects.filter((x) => x.name.endsWith('*'))) {
      expect(o.managedBy).toBe(layer);
      expect(o.layers).toEqual([layer]);
    }
  });

  it('A*, B* and the image of line AB exist and coincide with their sources (exactly over Q)', () => {
    const { doc } = scenario();
    const check = <X>(F: Field<X>): void => {
      const ev = evalDoc(doc, F, contextOf(doc));
      for (const n of ['A', 'B', 'l']) {
        expect(sameValues(F, valueOf(doc, ev, `${n}*`), valueOf(doc, ev, n)), n).toBe(true);
      }
      // C = (3, 6) → C* = (3, −6); H = (3, 5/2) → H* = (3, −5/2).
      const P = (x: number, y: number): Value<X> => ({ kind: 'point', x: fq(F, x), y: fq(F, y) });
      expect(sameValues(F, valueOf(doc, ev, 'C*'), P(3, -6))).toBe(true);
      const H = valueOf(doc, ev, 'H*');
      expect(H.kind === 'point' && F.toNumber(H.y)).toBe(-5 / 2);
      expect(valueOf(doc, ev, 'ω*').kind).toBe('circle');
    };
    check(RationalField);
    check(FloatField);
  });

  it('adding a point to main appends its image; midpoint(C*, H*) is built in ref', () => {
    const { doc, layer } = scenario();
    const withD = apply(doc, { kind: 'add', object: { name: 'D', def: pt(5, 5) } });
    expect(withD.objects.slice(-2).map((o) => o.name)).toEqual(['D', 'D*']);
    const withM = apply(withD, {
      kind: 'add',
      object: {
        name: 'M',
        def: call('midpoint', [ref(withD, 'C*'), ref(withD, 'H*')]),
        layers: [layer],
      },
    });
    const ev = evalDoc(withM, RationalField, contextOf(withM));
    expect(valueOf(withM, ev, 'M')).toEqual({
      kind: 'point',
      x: { num: 3n, den: 1n },
      y: { num: -17n, den: 4n },
    });
    // M is in ref, not in main: it has no image.
    expect(withM.objects.some((o) => o.name === 'M*')).toBe(false);
  });

  it('dragging C* moves C so that C* follows the cursor; A* (t depends on A) is not draggable', () => {
    const { doc } = scenario();
    const ctx = contextOf(doc);
    const values = evalDoc(doc, FloatField, ctx);
    const cursor = { x: 2.5, y: -7.25 };
    const r = dragThrough(doc, id(doc, 'C*'), cursor, values);
    if (r.kind !== 'edit') throw new Error(r.reason);
    expect(r.edit).toMatchObject({ kind: 'redefine', id: id(doc, 'C') });
    const moved = apply(doc, r.edit);
    const ev = evalDoc(moved, FloatField, contextOf(moved));
    expect(valueOf(moved, ev, 'C*')).toEqual({ kind: 'point', ...cursor });
    expect(valueOf(moved, ev, 'C')).toEqual({ kind: 'point', x: 2.5, y: 7.25 });
    expect(dragThrough(doc, id(doc, 'A*'), cursor, values)).toEqual({
      kind: 'not-draggable',
      reason: 'A* cannot be dragged: t depends on A',
    });
  });

  it('a user object named C* is rejected with the reserved-name message', () => {
    const { doc } = scenario();
    const add = applyDocEdit(doc, REGISTRY, { kind: 'add', object: { name: 'C*', def: pt(1, 1) } });
    expect(add).toEqual({ ok: false, error: 'C* is the image of C in layer ref' });
    const rename = applyDocEdit(doc, REGISTRY, { kind: 'rename', id: id(doc, 'H'), name: 'C*' });
    expect(rename).toEqual({ ok: false, error: 'C* is the image of C in layer ref' });
    const free = applyDocEdit(doc, REGISTRY, {
      kind: 'add',
      object: { name: 'Q*', def: pt(1, 1) },
    });
    expect(free).toEqual({ ok: false, error: '"Q*": names ending in * are reserved for images' });
  });
});
