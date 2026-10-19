/**
 * cline switching circle ↔ line (Run 3a, item 3): as C crosses the line AB (offsets from
 * ±1 down to ±1e-17 and exactly 0), cline(A, B, C) is a circle or the line, never NaN,
 * never garbage: every number finite, and the curve stays within |h| of the midpoint of
 * AB, so nothing jumps visibly at the switch. Tools that need a circle become Undefined
 * with a reason when it turns into a line (a genuine change of kind).
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call } from '../src/expr';
import { numbersOf, type Value } from '../src/value';
import { Builder, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';

const OFFSETS = [1, 1e-3, 1e-6, 3e-7, 1e-7, 3e-8, 1e-8, 3e-9, 1e-9, 5e-10, 1e-12, 1e-15, 1e-17, 0];

function figure(h: number): Builder {
  const b = new Builder();
  const [A, B, C] = [b.add('A', pt(0, 0)), b.add('B', pt(4, 0)), b.add('C', pt(2, h))];
  const k = b.call('k', 'cline', A, B, C);
  b.call('X', 'on', k, num(1), num(1));
  b.call('Y', 'on', k, num('1/2'));
  return b;
}

/** The distance from M = (2, 0) to a circle or a line through A = (0, 0). */
function distanceToMidpoint(v: Value<number>): number {
  if (v.kind === 'circle') return Math.abs(Math.hypot(2 - v.c.x, -v.c.y) - Math.sqrt(v.r2));
  if (v.kind === 'line') return Math.abs(2 * v.d.y - 0 * v.d.x) / Math.hypot(v.d.x, v.d.y);
  throw new Error(`expected a circle or a line, got ${v.kind}`);
}

describe('cline: circle ↔ line without NaN', () => {
  it('FloatField: finite values on both sides of the switch, kind decided by the EPS test', () => {
    for (const h of [...OFFSETS, ...OFFSETS.map((x) => -x)]) {
      const b = figure(h);
      const ev = evalDoc(b.doc, FloatField);
      const k = valueOf(b.doc, ev, 'k');
      expect(numbersOf(k).every(Number.isFinite), `h = ${String(h)}`).toBe(true);
      expect(k.kind, `h = ${String(h)}`).toBe(Math.abs(h) <= 1e-9 * 2 ? 'line' : 'circle');
      expect(distanceToMidpoint(k)).toBeLessThanOrEqual(Math.abs(h) + 1e-9 * 4);
      const [X, Y] = [valueOf(b.doc, ev, 'X'), valueOf(b.doc, ev, 'Y')];
      if (k.kind === 'circle') {
        // On a circle, on(k, 1/2) is the angle form: both gliders are defined.
        expect([X.kind, Y.kind]).toEqual(['point', 'point']);
      } else {
        expect([X.kind, Y.kind]).toEqual(['undefined', 'point']);
        expect(X.kind === 'undefined' && X.reason).toBe(
          'on does not accept (line, number, number); signatures: on(linear, number) · on(round, number, number) · on(round, number)',
        );
      }
      for (const v of [X, Y]) expect(numbersOf(v).every(Number.isFinite)).toBe(true);
    }
  });

  it('RationalField: the line only when exactly collinear', () => {
    for (const h of [...OFFSETS, ...OFFSETS.map((x) => -x)]) {
      const b = figure(h);
      const k = valueOf(b.doc, evalDoc(b.doc, RationalField), 'k');
      expect(k.kind, `h = ${String(h)}`).toBe(h === 0 ? 'line' : 'circle');
    }
  });

  it('a long sweep across the line: never Undefined, never non-finite', () => {
    for (let i = -2000; i <= 2000; i += 1) {
      const h = Math.sign(i) * 10 ** (-17 + (Math.abs(i) / 2000) * 17);
      const b = new Builder();
      b.add('k', call('cline', [pt(-3, 1), pt(5, 1), pt(1, 1 + h)]));
      const k = valueOf(b.doc, evalDoc(b.doc, FloatField, contextOf(b.doc)), 'k');
      expect(['circle', 'line']).toContain(k.kind);
      expect(numbersOf(k).every(Number.isFinite)).toBe(true);
    }
  });
});
