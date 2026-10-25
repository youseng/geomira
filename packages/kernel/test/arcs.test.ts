/**
 * arc(A, B, C) and the tools that honour arcs (Run 13, ADR-0031): the arc is
 * reflection-equivariant (no orientation choice leaks into the figure, law L16's premise),
 * continuous when B crosses line AC, its gliders stay on it and move continuously except at
 * the one point where the nearer end changes (Undefined there), and images keep it.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import type { Circle, Value } from '../src/value';
import { Builder, evalCall, evalDoc, num, pt, valueOf } from './helpers/doc';

type R = Parameters<typeof RationalField.toNumber>[0];

function asCircle<T>(v: Value<T>): Circle<T> {
  if (v.kind !== 'circle') throw new Error(`expected a circle, got ${v.kind}`);
  return v;
}

const plain = (c: Circle<R>) => {
  const n = (x: R) => RationalField.toNumber(x);
  if (c.arc === null) throw new Error('expected an arc');
  return {
    c: [n(c.c.x), n(c.c.y)],
    r2: n(c.r2),
    from: [n(c.arc.from.x), n(c.arc.from.y)],
    to: [n(c.arc.to.x), n(c.arc.to.y)],
  };
};

describe('arc(A, B, C)', () => {
  const [A, B, C] = [pt(3, -1), pt('1/2', 5), pt(-6, 2)];

  it('passes through B whichever way A, B, C turn, and arc(C, B, A) is the same arc', () => {
    for (const args of [
      [A, B, C],
      [C, B, A],
    ]) {
      const v = plain(asCircle(evalCall(RationalField, 'arc', args)));
      const w = plain(asCircle(evalCall(RationalField, 'arc', [...args].reverse())));
      expect(v).toEqual(w);
    }
  });

  it('is reflection-equivariant: the mirror image of arc(A, B, C) is arc(A′, B′, C′), exactly', () => {
    const l = call('line', [pt(-2, 7), pt(5, '3/4')]);
    const m = (P: Expr) => call('reflect', [P, l]);
    const image = asCircle(
      evalCall(RationalField, 'apply', [call('reflect', [l]), call('arc', [A, B, C])]),
    );
    const direct = asCircle(evalCall(RationalField, 'arc', [m(A), m(B), m(C)]));
    expect(plain(image)).toEqual(plain(direct));
  });

  it('is continuous when B crosses line AC: both arcs hug the segment AC', () => {
    for (const eps of ['0.001', '-0.001']) {
      const a = asCircle(evalCall(FloatField, 'arc', [pt(-4, 0), pt(0, eps), pt(4, 0)]));
      // The arc's middle point (on the perpendicular bisector of AC, on B's side) is near (0, 0).
      const h = Math.sqrt(a.r2) - Math.abs(a.c.y);
      expect(h).toBeLessThan(0.002);
      expect(Math.sign(a.c.y)).toBe(-Math.sign(Number(eps)));
    }
  });

  it('gliders on an arc stay on it and move continuously, except where the nearer end changes', () => {
    const b = new Builder();
    const a = b.add('a', call('arc', [pt(5, 0), pt(0, 5), pt(-5, 0)]));
    const ws: string[] = [];
    for (let k = -400; k <= 400; k += 1) ws.push(String(k / 40));
    ws.forEach((w, i) => b.add(`X_${String(i)}`, call('on', [a, num(1), num(w)])));
    const ev = evalDoc(b.doc, FloatField);
    let prev: { x: number; y: number } | undefined;
    let jumps = 0;
    ws.forEach((_, i) => {
      const v = valueOf(b.doc, ev, `X_${String(i)}`);
      if (v.kind !== 'point') {
        // Only the tie at (0, −5), the parameter (1 : −1), is undefined.
        expect(ws[i]).toBe('-1');
        prev = undefined;
        return;
      }
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(5, 12);
      if (prev !== undefined && Math.hypot(v.x - prev.x, v.y - prev.y) > 1) jumps += 1;
      prev = v;
    });
    expect(jumps).toBe(0);
  });

  it('an intersection on the carrier but off the arc is not a point of the figure', () => {
    // The x-axis meets the lower half arc((−5, 0), (0, −5), (5, 0)) only at its ends;
    // the line y = 3 meets its circle at (±4, 3), both off the arc.
    const lower = call('arc', [pt(-5, 0), pt(0, -5), pt(5, 0)]);
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const b = new Builder();
      b.add(
        'x',
        call(
          'intersect',
          [call('line', [pt(-9, 3), pt(9, 3)]), lower],
          [{ kind: 'along', sign: 1 }],
        ),
      );
      const v = valueOf(b.doc, evalDoc(b.doc, F), 'x');
      expect(v.kind === 'undefined' && v.reason).toBe('no intersection: it lies outside the arc');
    }
  });
});
