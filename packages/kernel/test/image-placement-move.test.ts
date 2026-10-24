/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): after `move` of a rule's
 * transformation to before its sources, the images kept their old places (O t A B O* A* B*),
 * while parsing the printed text places each image right after the later of its source and
 * its transformation (ADR-0007 decision 10: O t O* A A* B B*). Print → parse then gave a
 * different construction order (law P1). syncDerived now leaves every document in that text
 * order: user objects keep their order, and each image sits right after the later of its
 * source and its transformation, after only other images.
 */
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { emptyDocument } from '../src/document';
import type { Expr } from '../src/expr';
import { sourceOf } from '../src/derived';
import { num, pt } from './helpers/doc';
import { T, ed, idOf, names, refOf } from './helpers/derived-fixture';

/** O, A, B; t = rotate(O, 90); layer img = image(t, main); M = midpoint(A, B). */
function figure(): Document {
  let doc = emptyDocument();
  const add = (name: string, def: (d: Document) => Expr): void => {
    doc = ed(doc, { kind: 'add', object: { name, def: def(doc) } });
  };
  add('O', () => pt(0, 0));
  add('A', () => pt(1, 2));
  add('B', () => pt(3, 1));
  add('t', (d) => T('rotate', refOf(d, 'O'), num(90)));
  doc = ed(doc, {
    kind: 'addDerivedLayer',
    spec: { name: 'img', transform: idOf(doc, 't'), source: 'main' },
  });
  add('M', (d) => T('midpoint', refOf(d, 'A'), refOf(d, 'B')));
  return doc;
}

/** Whether only images lie between each image and the later of its source and transform. */
function inTextOrder(doc: Document): boolean {
  const at = new Map(doc.objects.map((o, i) => [o.id, i]));
  return doc.objects.every((o, i) => {
    if (o.managedBy === undefined) return true;
    const t = doc.layers.find((l) => l.id === o.managedBy)?.rule?.transform.id ?? -1;
    const anchor = Math.max(at.get(sourceOf(o) ?? -1) ?? -1, at.get(t) ?? -1);
    return doc.objects.slice(anchor + 1, i).every((x) => x.managedBy !== undefined);
  });
}

describe('images stay in text order after a move', () => {
  it('moving the map before its sources moves their images to right after them', () => {
    const doc = figure();
    expect(names(doc)).toEqual(['O', 'A', 'B', 't', 'O*', 'A*', 'B*', 'M', 'M*']);
    const m = ed(doc, { kind: 'move', id: idOf(doc, 't'), index: 1 });
    expect(names(m)).toEqual(['O', 't', 'O*', 'A', 'A*', 'B', 'B*', 'M', 'M*']);
    expect(inTextOrder(m)).toBe(true);
  });

  it('every move of every object leaves the document in text order', () => {
    const doc = figure();
    for (const o of doc.objects) {
      if (o.managedBy !== undefined) continue;
      for (let index = 0; index < doc.objects.length; index++) {
        const m = ed(doc, { kind: 'move', id: o.id, index });
        expect(inTextOrder(m), `${o.name} → ${String(index)}`).toBe(true);
      }
    }
  });

  it('a chain of layers: images of images follow their sources', () => {
    let doc = figure();
    doc = ed(doc, {
      kind: 'add',
      object: { name: 'h', def: T('homothety', refOf(doc, 'A'), num(2)) },
    });
    const img = doc.layers.find((l) => l.name === 'img')?.id ?? '';
    doc = ed(doc, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(doc, 'h'), source: img },
    });
    const m = ed(doc, { kind: 'move', id: idOf(doc, 'h'), index: 0 });
    expect(inTextOrder(m)).toBe(true);
    expect(names(m).slice(0, 3)).toEqual(['O', 'A', 'h']);
  });
});
