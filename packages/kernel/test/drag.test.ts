/**
 * Drag-through (SPEC §8.4): dragThrough(doc, managedId, cursor, values) → edit |
 * not-draggable. The edit sets the free input X to T⁻¹(cursor) (gliders: the nearest
 * parameter), so after applying it the image is at the cursor (or its projection).
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { dragThrough } from '../src/drag';
import { call } from '../src/expr';
import { contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { T, ed, idOf, imaged, refOf } from './helpers/derived-fixture';

function values(doc: Document) {
  return evalDoc(doc, FloatField, contextOf(doc));
}

function dragTo(doc: Document, name: string, x: number, y: number): Document {
  const r = dragThrough(doc, idOf(doc, name), { x, y }, values(doc));
  if (r.kind !== 'edit') throw new Error(r.reason);
  return ed(doc, r.edit);
}

function near(doc: Document, name: string, x: number, y: number): void {
  const v = valueOf(doc, values(doc), name);
  if (v.kind !== 'point') throw new Error(`${name} is ${v.kind}`);
  expect(Math.hypot(v.x - x, v.y - y), name).toBeLessThan(1e-9);
}

describe('dragThrough', () => {
  it('a free point under a spiral similarity: the image follows the cursor', () => {
    const { doc } = imaged();
    const e = ed(doc, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    near(dragTo(e, 'E*', -3.25, 11.5), 'E*', -3.25, 11.5);
  });

  it('under an anti-similarity and through a chain of two derived layers', () => {
    const { doc, layer } = imaged();
    const r = ed(doc, {
      kind: 'add',
      object: { name: 'r', def: T('reflect', T('line', pt(-1, 0), pt(2, 5))) },
    });
    const two = ed(r, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(r, 'r'), source: layer },
    });
    const e = ed(two, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    const m = dragTo(e, 'E**', 4.5, -2);
    near(m, 'E**', 4.5, -2);
    expect(m.objects.find((o) => o.name === 'E')?.def.kind).toBe('call');
  });

  it('gliders move along their object: a line glider and a circle glider (both forms)', () => {
    const { doc } = imaged();
    const l = ed(doc, {
      kind: 'add',
      object: {
        name: 'G',
        def: call('on', [T('line', refOf(doc, 'A'), refOf(doc, 'B')), num('1/2')]),
      },
    });
    // G* lies on the image of AB, the line CD: dragging G* off it projects onto it.
    const g = dragTo(l, 'G*', 3, 2.5);
    const ev = values(g);
    const [G, Gs, C, D] = ['G', 'G*', 'C', 'D'].map((n) => valueOf(g, ev, n));
    if (G?.kind !== 'point' || Gs?.kind !== 'point' || C?.kind !== 'point' || D?.kind !== 'point')
      throw new Error('kinds');
    expect(Math.abs((Gs.x - C.x) * (D.y - C.y) - (Gs.y - C.y) * (D.x - C.x))).toBeLessThan(1e-9);
    expect(G.y).toBe(0);
    for (const params of [[num(1), num(1)], [num(30)]]) {
      const c = ed(doc, {
        kind: 'add',
        object: {
          name: 'K',
          def: call('on', [T('circle', refOf(doc, 'A'), refOf(doc, 'B')), ...params]),
        },
      });
      const k = dragTo(c, 'K*', 20, 20);
      const v = valueOf(k, values(k), 'K');
      if (v.kind !== 'point') throw new Error('K');
      expect(Math.abs(Math.hypot(v.x, v.y) - 4)).toBeLessThan(1e-9);
    }
  });

  it('not draggable: the map depends on the source (mirror, centre), a constructed source, a plain object', () => {
    const { doc, layer } = imaged();
    // s = spiral(A, B, C, D) depends on A: A* cannot be dragged.
    const no = (d: Document, name: string) =>
      dragThrough(d, idOf(d, name), { x: 1, y: 1 }, values(d));
    expect(no(doc, 'A*')).toEqual({
      kind: 'not-draggable',
      reason: 'A* cannot be dragged: s depends on A',
    });
    const rot = ed(doc, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    const centre = ed(rot, {
      kind: 'add',
      object: { name: 'q', def: T('rotate', refOf(rot, 'E'), num(90)) },
    });
    const two = ed(centre, {
      kind: 'addDerivedLayer',
      spec: { name: 'two', transform: idOf(centre, 'q'), source: 'main', suffix: '**' },
    });
    expect(no(two, 'E**')).toEqual({
      kind: 'not-draggable',
      reason: 'E** cannot be dragged: q depends on E',
    });
    const mid = ed(doc, {
      kind: 'add',
      object: { name: 'M', def: T('midpoint', refOf(doc, 'A'), pt(9, 9)) },
    });
    expect(no(mid, 'M*')).toEqual({
      kind: 'not-draggable',
      reason: 'M is not a free point or a glider',
    });
    expect(no(doc, 'B')).toEqual({
      kind: 'not-draggable',
      reason: `#${String(idOf(doc, 'B'))} is not a managed image`,
    });
    expect(layer.length).toBeGreaterThan(0);
  });

  it('not draggable: an undefined map, or a cursor at the centre of the glider circle', () => {
    const { doc } = imaged();
    const bad = ed(doc, {
      kind: 'redefine',
      id: idOf(doc, 's'),
      def: T('spiral', refOf(doc, 'A'), refOf(doc, 'A'), refOf(doc, 'C'), refOf(doc, 'D')),
    });
    const e = ed(bad, { kind: 'add', object: { name: 'E', def: pt(7, 7) } });
    expect(dragThrough(e, idOf(e, 'E*'), { x: 0, y: 0 }, values(e))).toEqual({
      kind: 'not-draggable',
      reason: 'the transformation s is undefined',
    });
    const c = ed(doc, {
      kind: 'add',
      object: { name: 'K', def: call('on', [T('circle', pt(-5, -5), pt(-5, -1)), num(1), num(1)]) },
    });
    // The image of the centre (−5, −5) under s.
    const O = ed(c, {
      kind: 'add',
      object: { name: 'O', def: T('apply', refOf(c, 's'), pt(-5, -5)) },
    });
    const o = valueOf(O, values(O), 'O');
    if (o.kind !== 'point') throw new Error('O');
    const r = dragThrough(O, idOf(O, 'K*'), { x: o.x, y: o.y }, values(O));
    expect(r.kind).toBe('not-draggable');
  });
});
