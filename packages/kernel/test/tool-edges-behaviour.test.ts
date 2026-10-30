/**
 * ADR-0054 (mutation shards kernel-a, kernel-b, kernel-d: tools/poles.ts, conic-lines.ts,
 * harmonic.ts): tools called on hand-built values at the edges the earlier tests left open.
 * The pole of a line through the centre (of a circle, of a conic) is the point at infinity with
 * the line's flag toggled; a parabola's centre is an achiral point at infinity; a valid first
 * argument never hides an invalid second or third one; the harmonic conjugate of three
 * concurrent lines is chiral exactly when an even number of them are; two of them the same
 * line (any pair) is refused; extra arguments are refused.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { conicCentre, conicPole } from '../src/tools/conic-lines';
import type { Circle, Conic, Line, Value } from '../src/value';
import { REGISTRY, must } from './helpers/doc';

const F = FloatField;
const CTX = { scale: 4 };
const run = (tool: string, args: readonly Value<number>[]) =>
  must(REGISTRY.get(tool)).compute(F, args, CTX);
const why = (v: Value<number>) =>
  v.kind === 'undefined' || v.kind === 'inexact' ? `${v.kind}: ${v.reason}` : v.kind;

const line = (px: number, py: number, dx: number, dy: number, chiral = false): Line<number> => ({
  kind: 'line',
  p: { x: px, y: py },
  d: { x: dx, y: dy },
  lo: null,
  hi: null,
  chiral,
});
const circle = (x: number, y: number, r2: number): Circle<number> => ({
  kind: 'circle',
  c: { x, y },
  r2,
  arc: null,
});
// x² + 4y² = 4 and y = x², as normalized-free conic values.
const ELL: Conic<number> = { kind: 'conic', a: 1, b: 0, c: 4, d: 0, e: 0, f: -4 };
const PAR: Conic<number> = { kind: 'conic', a: 1, b: 0, c: 0, d: 0, e: -0.5, f: 0 };
const NOT_A_CIRCLE = circle(0, 0, 0);
const NO_DIRECTION = line(0, 0, 0, 0);

describe('poles through the centre', () => {
  it('a circle or a conic: the point at infinity, flag toggled', () => {
    for (const chiral of [false, true]) {
      const l = line(0, 0, 1, 1, chiral);
      for (const v of [run('pole', [l, circle(0, 0, 4)]), conicPole(F, l, ELL, CTX)]) {
        expect(v.kind).toBe('ideal_point');
        if (v.kind === 'ideal_point') expect(v.chiral).toBe(!chiral);
      }
    }
  });

  it("a parabola's centre: an achiral point at infinity along its axis", () => {
    const c = conicCentre(F, PAR, CTX);
    expect(c.kind === 'ideal_point' ? [c.chiral, Math.abs(c.d.x)] : why(c)).toEqual([false, 0]);
  });
});

describe('invalid later arguments', () => {
  it('pole(l, c) and pole(l, k) with a valid line', () => {
    expect(why(run('pole', [line(0, 1, 1, 0), NOT_A_CIRCLE]))).toMatch(/^undefined: /u);
    expect(why(run('pole', [NO_DIRECTION, circle(0, 0, 4)]))).toMatch(/^undefined: /u);
    const bad: Conic<number> = { kind: 'conic', a: 0, b: 0.5, c: 0, d: 0, e: 0, f: 0 };
    expect(why(conicPole(F, line(0, 1, 1, 0), bad, CTX))).toBe(
      'undefined: degenerate conic: a pair of lines, a double line or a point',
    );
    expect(why(run('pole', [line(0, 1, 1, 0), circle(0, 0, 4), circle(0, 0, 4)]))).toMatch(
      /^undefined: /u,
    );
    expect(why(run('pole', [line(0, 1, 1, 0), ELL, ELL]))).toMatch(/^undefined: /u);
  });

  it('radical_center with an invalid second or third circle, or four circles', () => {
    const [a, b, c] = [circle(0, 0, 1), circle(4, 0, 1), circle(0, 4, 1)];
    expect(run('radical_center', [a, b, c]).kind).toBe('point');
    for (const args of [
      [a, NOT_A_CIRCLE, c],
      [a, b, NOT_A_CIRCLE],
      [a, b, c, a],
    ])
      expect(why(run('radical_center', args))).toMatch(/^undefined: /u);
  });

  it('harmonic_conjugate with a line without direction second or third', () => {
    const [a, b, c] = [line(0, 0, 1, 0), line(0, 0, 0, 1), line(0, 0, 1, 1)];
    expect(run('harmonic_conjugate', [a, b, c]).kind).toBe('line');
    for (const args of [
      [a, NO_DIRECTION, c],
      [a, b, NO_DIRECTION],
    ])
      expect(why(run('harmonic_conjugate', args))).toMatch(/^undefined: /u);
  });
});

describe('the harmonic conjugate of three lines', () => {
  it('chiral exactly when an even number of a, b, c are', () => {
    for (const ca of [false, true])
      for (const cb of [false, true])
        for (const cc of [false, true]) {
          const v = run('harmonic_conjugate', [
            line(0, 0, 1, 0, ca),
            line(0, 0, 0, 1, cb),
            line(0, 0, 1, 1, cc),
          ]);
          const odd = [ca, cb, cc].filter(Boolean).length % 2 === 1;
          expect(v.kind === 'line' ? v.chiral : why(v), String([ca, cb, cc])).toBe(!odd);
        }
  });

  it('two of them the same line, any pair: refused', () => {
    const [a, b] = [line(0, 0, 1, 0), line(0, 0, 0, 1)];
    for (const args of [
      [a, a, b],
      [a, b, a],
      [a, b, b],
      [a, b, line(3, 0, 2, 0)],
    ])
      expect(why(run('harmonic_conjugate', args))).toBe(
        'undefined: harmonic_conjugate: two of a, b, c are the same line',
      );
  });
});

describe('a line and a conic: which curve P is not on', () => {
  const l = line(-2, 0, 1, 0);
  const point = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });

  it('other(a, b, P): off the line, or on it but off the conic', () => {
    expect(why(run('other', [l, ELL, point(0, 1)]))).toBe(
      'undefined: other(a, b, P) needs P on the line',
    );
    expect(why(run('other', [l, ELL, point(1, 0)]))).toBe(
      'undefined: other(a, b, P) needs P on the conic',
    );
    const X = run('other', [l, ELL, point(2, 0)]);
    expect(X.kind === 'point' ? [X.x, X.y] : why(X)).toEqual([-2, 0]);
  });
});
