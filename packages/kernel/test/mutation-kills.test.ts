/**
 * Kernel behaviour the tests did not pin, found by the nightly's surviving mutants (Run 13,
 * SPEC §17 L15): |x| without overflow, the inverse of a map whose |a|² is subnormal (Smith's
 * division), a segment's single crossing of a circle needs no selector, an explicit mark count
 * of 1, and direct calls of the display tools with arguments no signature takes (Undefined,
 * never a throw: tools/args.ts).
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { toleranceContext } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call } from '../src/expr';
import { abs } from '../src/geom';
import { inverseSimilarity, mapPoint, similarity } from '../src/similarity';
import type { Value } from '../src/value';
import { A, B, C, ORDERED, at, plain, reason, seg } from './helpers/degenerate';
import { REGISTRY, must, num, pt } from './helpers/doc';

const CTX = toleranceContext(1);
const F = FloatField;

describe('abs', () => {
  it('|x| of a clearly negative double is −x, also where x² would overflow or underflow', () => {
    for (const x of [-1e170, -3.5, -1e-150]) expect(abs(F, x, 'dimensionless', CTX)).toBe(-x);
    expect(abs(F, -1e170, 'length', CTX)).toBe(1e170);
  });
});

describe('the inverse of a map whose |a|² is subnormal (Smith division)', () => {
  const zero = { re: 0, im: 0 };
  for (const a of [
    { re: 1e-154, im: 0 },
    { re: 0, im: 1e-154 },
    { re: -1e-154, im: 0 },
    { re: 0, im: -1e-154 },
  ]) {
    it(`a = ${String(a.re)} + ${String(a.im)}i`, () => {
      const s = similarity(false, a, zero);
      const inv = inverseSimilarity(F, s);
      // a·a⁻¹ = 1: a pure real or imaginary a has a pure reciprocal of magnitude 1e154.
      expect(Math.hypot(inv.a.re, inv.a.im)).toBeCloseTo(1e154, -140);
      const p = { x: 3, y: -2 };
      const back = mapPoint(F, inv, mapPoint(F, s, p));
      expect(back.x).toBeCloseTo(3, 9);
      expect(back.y).toBeCloseTo(-2, 9);
    });
  }
});

describe('a segment that crosses a circle once', () => {
  it('needs no selector: the other crossing lies off the segment', () => {
    const circle = call('circle', [pt(0, 0), pt(5, 0)]);
    for (const Fd of ORDERED) {
      // From the centre outwards: only (5, 0) is on the segment.
      expect(plain(Fd, at(Fd, 'intersect', seg(pt(0, 0), pt(9, 0)), circle))).toEqual([5, 0]);
      expect(plain(Fd, at(Fd, 'intersect', circle, seg(pt(-9, 0), pt(1, 0))))).toEqual([-5, 0]);
    }
    // A full line still has two crossings and asks for one.
    expect(reason(at(F, 'intersect', call('line', [pt(0, 0), pt(9, 0)]), circle))).toMatch(
      /ambiguous: add a selector/u,
    );
  });
});

describe('marks and texts', () => {
  it('an explicit count of 1 is one arc or tick, as the default', () => {
    for (const Fd of ORDERED) {
      const m = at(Fd, 'mark_angle', A, B, C, num(1));
      expect(m.kind === 'angle_mark' && m.arcs).toBe(1);
      const s = at(Fd, 'mark_segment', A, B, num(1));
      expect(s.kind === 'segment_mark' && s.ticks).toBe(1);
    }
    expect(at(RationalField, 'mark_angle', A, B, C, num(0)).kind).toBe('undefined');
  });

  it('a direct call with arguments no signature takes is Undefined, never a throw', () => {
    const p: Value<number> = { kind: 'point', x: 0, y: 0 };
    const q: Value<number> = { kind: 'point', x: 4, y: 0 };
    const r: Value<number> = { kind: 'point', x: 0, y: 3 };
    const n: Value<number> = { kind: 'number', v: 2, exact: { num: 2n, den: 1n } };
    const str: Value<number> = { kind: 'string', s: 'P' };
    const compute = (tool: string, args: readonly Value<number>[]) =>
      must(REGISTRY.get(tool)).compute(F, args, CTX);
    expect(compute('mark_angle', [q, p, r, p]).kind).toBe('undefined');
    expect(compute('mark_angle', [q, p, r, n]).kind).toBe('angle_mark');
    expect(compute('text', [p, n]).kind).toBe('undefined');
    expect(compute('text', [p, str, str]).kind).toBe('undefined');
    expect(compute('text', [n, str]).kind).toBe('undefined');
    expect(compute('text', [p, str]).kind).toBe('text');
  });
});
