/**
 * Run 16c audit (ADR-0042 decision 17: drag-through "needs no change"): the image of a glider
 * on a conic is dragged through its map like the image of a glider on a line or a circle. It
 * was refused with a false reason ("the object G glides on is undefined").
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { dragThrough } from '../src/drag';
import { contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';
import { T, ed, idOf, imaged, refOf } from './helpers/derived-fixture';

const values = (doc: Document) => evalDoc(doc, FloatField, contextOf(doc));

function xy(doc: Document, name: string): { x: number; y: number } {
  const v = valueOf(doc, values(doc), name);
  if (v.kind !== 'point') throw new Error(`${name} is ${v.kind}`);
  return v;
}

describe('drag-through a glider on a conic', () => {
  it('the image follows the cursor along the image conic', () => {
    const { doc } = imaged();
    const k = ed(doc, {
      kind: 'add',
      object: {
        name: 'kk',
        def: T('conic', pt(2, 0), pt(0, 1), pt(-2, 0), pt(0, -1), pt('6/5', '4/5')),
      },
    });
    const g = ed(k, {
      kind: 'add',
      object: { name: 'G', def: T('on', refOf(k, 'kk'), num(2), num(1)) },
    });
    const h = ed(g, {
      kind: 'add',
      object: { name: 'H', def: T('on', refOf(g, 'kk'), num(1), num(3)) },
    });
    const target = xy(h, 'H*');
    const r = dragThrough(h, idOf(h, 'G*'), target, values(h));
    expect(r.kind === 'edit' ? 'edit' : r.reason).toBe('edit');
    if (r.kind !== 'edit') return;
    const moved = xy(ed(h, r.edit), 'G*');
    expect(Math.hypot(moved.x - target.x, moved.y - target.y)).toBeLessThan(1e-9);
  });
});
