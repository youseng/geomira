/**
 * ADR-0054 (mutation shards kernel-c and kernel-d: tools/pairs.ts, range.ts, tangent-from.ts):
 * line ∩ circle, circle ∩ circle and the tangents from a point with rays and arcs. A ray, an
 * arc or a segment that holds one of the two candidates needs no selector (either argument);
 * candidates off every arc leave "no intersection: it lies outside the arc"; other(P) whose
 * other point is off an arc or a ray says so, naming the ray; a touch point off the arc is no
 * touch point.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import { plain, reason } from './helpers/degenerate';
import { choose } from './helpers/degenerate-branch';
import { pt } from './helpers/doc';

const FIELDS = [FloatField, RationalField] as Field<unknown>[];
const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
// The unit circle, and its upper half as an arc from (1, 0) through (0, 1) to (−1, 0).
const CIRCLE = T('circle', pt(0, 0), pt(1, 0));
const UPPER = T('arc', pt(1, 0), pt(0, 1), pt(-1, 0));
const LOWER = T('arc', pt(-1, 0), pt(0, -1), pt(1, 0));
const other = (p: Expr): Selector => ({ kind: 'other', p });

describe('one candidate on a ray, a segment or an arc: no selector needed', () => {
  it('line ∩ circle', () => {
    for (const F of FIELDS) {
      expect(plain(F, choose(F, 'intersect', [T('ray', pt(0, 0), pt(2, 0)), CIRCLE]))).toEqual([
        1, 0,
      ]);
      expect(plain(F, choose(F, 'intersect', [CIRCLE, T('ray', pt(0, 0), pt(-2, 0))]))).toEqual([
        -1, 0,
      ]);
      // The y-axis meets the upper arc at (0, 1) only, the lower arc at (0, −1) only.
      expect(plain(F, choose(F, 'intersect', [T('line', pt(0, 0), pt(0, 1)), UPPER]))).toEqual([
        0, 1,
      ]);
      expect(plain(F, choose(F, 'intersect', [LOWER, T('line', pt(0, 0), pt(0, 1))]))).toEqual([
        0, -1,
      ]);
      expect(reason(choose(F, 'intersect', [T('line', pt(0, 0), pt(0, 1)), CIRCLE]))).toMatch(
        /^undefined: ambiguous: add a selector/u,
      );
    }
  });

  it('circle ∩ circle', () => {
    // The circle about (0, 1) of radius 1 meets the unit circle at (±√3/2, 1/2): both on UPPER,
    // neither on LOWER; about (1, 0): (1/2, ±√3/2), one on each.
    const above = T('circle', pt(0, 1), pt(0, 0));
    const right = T('circle', pt(1, 0), pt(0, 0));
    expect(plain(FloatField, choose(FloatField, 'intersect', [UPPER, right]))).toEqual([
      expect.closeTo(0.5, 14),
      expect.closeTo(Math.sqrt(3) / 2, 14),
    ]);
    expect(plain(FloatField, choose(FloatField, 'intersect', [right, LOWER]))).toEqual([
      expect.closeTo(0.5, 14),
      expect.closeTo(-Math.sqrt(3) / 2, 14),
    ]);
    for (const args of [
      [LOWER, above],
      [above, LOWER],
    ])
      expect(reason(choose(FloatField, 'intersect', args))).toBe(
        'undefined: no intersection: it lies outside the arc',
      );
  });

  it('line ∩ arc: both candidates off the arc', () => {
    for (const F of FIELDS)
      expect(
        reason(choose(F, 'intersect', [T('line', pt(-2, '-3/5'), pt(2, '-3/5')), UPPER])),
      ).toBe('undefined: no intersection: it lies outside the arc');
  });
});

describe('other(P) off a range', () => {
  it('the other point off an arc or a ray', () => {
    for (const F of FIELDS) {
      // The x-axis: other((1, 0)) is (−1, 0), the end of UPPER (on it) but off a ray from 0.
      const xAxis = T('line', pt(-3, 0), pt(3, 0));
      expect(plain(F, choose(F, 'intersect', [xAxis, UPPER], [other(pt(1, 0))]))).toEqual([-1, 0]);
      expect(
        reason(choose(F, 'intersect', [T('ray', pt(0, 0), pt(3, 0)), CIRCLE], [other(pt(1, 0))])),
      ).toBe('undefined: no other intersection: it lies outside the ray');
      // The line y = x + 1 meets the circle at (0, 1) and (−1, 0); with the lower arc only
      // (−1, 0) is on both.
      const diag = T('line', pt(0, 1), pt(-1, 0));
      expect(reason(choose(F, 'intersect', [diag, LOWER], [other(pt(-1, 0))]))).toBe(
        'undefined: no other intersection: it lies outside the arc',
      );
    }
  });

  it('circle ∩ circle: the other point off an arc', () => {
    const right = T('circle', pt(1, 0), pt(0, 0));
    const at = (y: string) => pt('1/2', y);
    // (1/2, −√3/2) is the other point; it is off UPPER.
    expect(
      reason(
        choose(FloatField, 'intersect', [UPPER, right], [other(at(String(Math.sqrt(3) / 2)))]),
      ),
    ).toBe('undefined: no other intersection: it lies outside the arc');
  });

  it('a touch point off the arc is no touch point', () => {
    // From (0, 5/3) the touch points on the unit circle are (±4/5, 3/5): off LOWER.
    for (const F of FIELDS)
      expect(
        reason(choose(F, 'tangent_point', [pt(0, '5/3'), LOWER], [{ kind: 'orient', sign: 1 }])),
      ).toBe('undefined: no touch point: it lies outside the arc');
  });
});
