/**
 * Found in the pre-beta review (bug-fix round, ADR-0028): dragging the image of a glider whose
 * parameter is an expression (X = on(l, s) with s = param(0, 1, 1/3), Y = on(c, 2 * angle(A,
 * O, B))) replaced the expression with a number, silently cutting the glider loose from what
 * defined it. SPEC §5 and the claims' free inputs (claims/src/free.ts) make only
 * on(obj, <literal parameters>) a free glider: drag-through now refuses the others with
 * "X is not draggable: its parameter is computed".
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { emptyDocument, type Document } from '../src/document';
import { dragThrough } from '../src/drag';
import type { Expr } from '../src/expr';
import { contextOf, evalDoc, num, pt } from './helpers/doc';
import { T, ed, idOf, refOf } from './helpers/derived-fixture';

function figure(): Document {
  let doc = emptyDocument();
  const add = (name: string, def: (d: Document) => Expr): void => {
    doc = ed(doc, { kind: 'add', object: { name, def: def(doc) } });
  };
  add('O', () => pt(0, 0));
  add('A', () => pt(5, 0));
  add('B', () => pt(0, 3));
  add('c', (d) => T('circle', refOf(d, 'O'), refOf(d, 'A')));
  add('l', (d) => T('line', refOf(d, 'O'), refOf(d, 'B')));
  add('s', () => T('param', num(0), num(1), num('1/3')));
  add('X', (d) => T('on', refOf(d, 'l'), refOf(d, 's')));
  add('Y', (d) =>
    T(
      'on',
      refOf(d, 'c'),
      T('mul', num(2), T('angle', refOf(d, 'A'), refOf(d, 'O'), refOf(d, 'B'))),
    ),
  );
  add('Z', (d) => T('on', refOf(d, 'c'), num(1), refOf(d, 's')));
  add('U', (d) => T('on', refOf(d, 'l'), num('1/2')));
  add('V', (d) => T('on', refOf(d, 'c'), num(1), num(2)));
  add('t', (d) => T('rotate', refOf(d, 'O'), num(90)));
  return ed(doc, {
    kind: 'addDerivedLayer',
    spec: { name: 'img', transform: idOf(doc, 't'), source: 'main' },
  });
}

describe('drag-through of a glider whose parameter is computed', () => {
  it('is refused: the definition is never replaced by a number', () => {
    const doc = figure();
    const values = evalDoc(doc, FloatField, contextOf(doc));
    for (const n of ['X', 'Y', 'Z']) {
      expect(dragThrough(doc, idOf(doc, `${n}*`), { x: 1, y: 2 }, values)).toEqual({
        kind: 'not-draggable',
        reason: `${n} is not draggable: its parameter is computed`,
      });
    }
  });

  it('gliders with literal parameters are still dragged through', () => {
    const doc = figure();
    const values = evalDoc(doc, FloatField, contextOf(doc));
    for (const n of ['U', 'V']) {
      const r = dragThrough(doc, idOf(doc, `${n}*`), { x: 1, y: 2 }, values);
      expect(r.kind, n).toBe('edit');
    }
  });
});
