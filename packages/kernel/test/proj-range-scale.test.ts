/**
 * Run 16c audit (ADR-0040 decision 9): the range of a projective image is decided as a
 * dimensionless parameter, so the image line's direction must have a length of the figure's
 * scale, as line(A, B)'s has. It was the raw P × D direction (|N| about 10⁴ at figure size 5, so
 * the band at each end was thousands of times wider than for a segment; at figure size 50 the
 * whole image segment was one band wide). Every figure below is decided the same at any
 * similarity scale, and an intersection well inside the image segment is defined.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import { Builder, evalDoc, pt, valueOf } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const FIELDS: readonly Field<unknown>[] = [FloatField, RationalField];

/** The ray image intersected with a vertical line, every coordinate times s. */
function figure(s: number): Builder {
  const P = (x: number, y: number) => pt(String(x * s), String(y * s));
  const b = new Builder();
  b.add('f', T('send_to_infinity', T('line', P(-50, 10), P(50, 10))));
  b.add('r1', T('apply', b.ref('f'), T('ray', P(30, 20), P(30, 70))));
  b.add('Q', T('intersect', b.ref('r1'), T('line', P(76, 0), P(76, 200))));
  return b;
}

describe('the range of a projective image is decided at the figure scale', () => {
  for (const s of [1 / 100, 1 / 10, 1, 10, 100])
    it(`a crossing well inside the image of a ray is defined (scale ${String(s)})`, () => {
      const b = figure(s);
      for (const F of FIELDS) {
        const v = valueOf(b.doc, evalDoc(b.doc, F), 'Q');
        const xy = v.kind === 'point' ? [F.toNumber(v.x), F.toNumber(v.y)] : v;
        expect(xy, `${F.name} at scale ${String(s)}`).toEqual([
          expect.closeTo(76 * s, 9),
          expect.closeTo(167.5 * s, 9),
        ]);
      }
    });

  it('the image of an image of a segment still meets the x-axis at (1, 0)', () => {
    const b = new Builder();
    b.add('f', T('send_to_infinity', T('line', pt(-5, 1), pt(5, 1))));
    const s = T('segment', pt(1, 3), pt(1, -2));
    b.add(
      'Q',
      T(
        'intersect',
        T('apply', b.ref('f'), T('apply', b.ref('f'), s)),
        T('line', pt(0, 0), pt(1, 0)),
      ),
    );
    const v = valueOf(b.doc, evalDoc(b.doc, FloatField), 'Q');
    expect(v.kind === 'point' ? [v.x, v.y] : v).toEqual([
      expect.closeTo(1, 9),
      expect.closeTo(0, 9),
    ]);
  });
});
