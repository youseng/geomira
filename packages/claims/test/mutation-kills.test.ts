/**
 * Claims behaviour the tests did not pin, found by the nightly's surviving mutants (Run 13,
 * SPEC §17 L15): an exact decision needs EVERY condition, ranges and arcs include their ends,
 * residuals and gaps do not depend on how a line is parametrised, the static argument check,
 * the parameter fit, the hypotheses' band and edge cases, and the NDG height of a triple.
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { toleranceContext } from '@geomira/num/tolerance';
import type { Expr } from '@geomira/kernel/expr';
import type { Circle, Line, Value } from '@geomira/kernel/value';
import { describe, expect, it } from 'vitest';
import { argProblem } from '../src/check';
import { exactDecide } from '../src/decide';
import { assumptionProblem, checkAssumption } from '../src/hypotheses';
import { fitsParam, formatClaimMessage, pairs, type ClaimKindSpec } from '../src/kind';
import { claimKind } from '../src/kinds';
import { ndgStatus } from '../src/ndg';
import { circle, line, lit, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}

const Q = RationalField;
const Fl = FloatField;
const S10 = toleranceContext(10);
const ref = (id: number): Expr => ({ kind: 'ref', id });

describe('an exact decision needs every condition', () => {
  it('equal points: equal x is not enough', () => {
    const d = exactDecide(Q, kind('equal'), [pt(Q, [1, 2]), pt(Q, [1, 5])], S10);
    expect(d).toEqual({ kind: 'false' });
    expect(exactDecide(Q, kind('equal'), [pt(Q, [1, 2]), pt(Q, [1, 2])], S10)).toEqual({
      kind: 'true',
    });
  });

  it('collinear: one point on the line and one off it is false', () => {
    const args = [
      [0, 0],
      [1, 1],
      [3, 3],
      [2, 5],
    ].map((p) => pt(Q, p as unknown as Xy));
    expect(exactDecide(Q, kind('collinear'), args, S10)).toEqual({ kind: 'false' });
  });

  it('concyclic: four points on the circle and one off it is false', () => {
    const args = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [2, 0],
    ].map((p) => pt(Q, p as unknown as Xy));
    expect(exactDecide(Q, kind('concyclic'), args, S10)).toEqual({ kind: 'false' });
  });
});

describe('on(): a segment and an arc include their ends', () => {
  const seg = <T>(F: import('@geomira/num/field').Field<T>): Line<T> =>
    line(F, [1, 1], [5, 3], 'segment');
  /** The quarter of the unit circle from (1, 0) counter-clockwise to (0, 1). */
  const arc = <T>(F: import('@geomira/num/field').Field<T>): Circle<T> => ({
    ...circle(F, [0, 0], 1),
    arc: { from: pt(F, [1, 0]), to: pt(F, [0, 1]) },
  });

  it('exactly at an end: true over Q, and in floats', () => {
    for (const end of [
      [1, 1],
      [5, 3],
    ] as const) {
      expect(exactDecide(Q, kind('on'), [pt(Q, end), seg(Q)], S10)).toEqual({ kind: 'true' });
    }
    for (const end of [
      [1, 0],
      [0, 1],
    ] as const) {
      expect(exactDecide(Q, kind('on'), [pt(Q, end), arc(Q)], S10)).toEqual({ kind: 'true' });
    }
    // Just beyond an end: false, by the range's order item.
    expect(exactDecide(Q, kind('on'), [pt(Q, [-3, -1]), seg(Q)], S10)).toMatchObject({
      kind: 'false',
    });
    expect(exactDecide(Q, kind('on'), [pt(Q, ['3/5', '-4/5']), arc(Q)], S10)).toMatchObject({
      kind: 'false',
    });
  });
});

describe('residuals and gaps do not depend on how a line is parametrised', () => {
  it('concurrent: scaling one direction keeps the residual', () => {
    const k = kind('concurrent');
    const l1 = line(Fl, [0, 0], [2, 2]);
    const l2 = line(Fl, [1, 0], [1, 5]);
    // A third line missing the common point (1, 1) by 1/2.
    const base: Line<number> = line(Fl, [0, '3/2'], [1, '3/2']);
    const r = k.residual([l1, l2, base], { scale: 10 });
    expect(r).toBeGreaterThan(1e-3);
    for (const s of [1e-4, 1e-2, 100, 1e4]) {
      const scaled: Line<number> = { ...base, d: { x: base.d.x * s, y: base.d.y * s } };
      expect(k.residual([l1, l2, scaled], { scale: 10 }) / r).toBeCloseTo(1, 9);
    }
  });

  it("on: the gap to a line is the point's distance, whatever |d|", () => {
    const on = kind('on');
    expect(typeof on.gap).toBe('function');
    for (const s of [1e-4, 1, 1e4]) {
      const l: Line<number> = { ...line(Fl, [0, 0], [1, 0]), d: { x: s, y: 0 } };
      expect(Math.abs(on.gap?.([pt(Fl, [3, 2]), l], S10) ?? Number.NaN)).toBeCloseTo(2, 9);
    }
  });
});

describe('tangent: two lines are never tangent; a point is no curve', () => {
  it('names the cause', () => {
    const k = kind('tangent');
    const two = k.algebra(Fl, [line(Fl, [0, 0], [1, 0]), line(Fl, [0, 1], [1, 1])], S10);
    expect('kind' in two && two.reason).toMatch(/two lines are never tangent/u);
    for (const args of [
      [pt(Fl, [0, 0]), circle(Fl, [0, 0], 1)],
      [line(Fl, [0, 0], [1, 0]), pt(Fl, [0, 0])],
    ] as Value<number>[][]) {
      const bad = k.algebra(Fl, args, S10);
      expect('kind' in bad && bad.reason).not.toMatch(/two lines/u);
      expect('kind' in bad && bad.kind).toBe('undefined');
    }
  });
});

describe('the static argument check and the parameter fit', () => {
  const on = kind('on');
  const kindsOf =
    (table: Record<number, readonly string[]>) =>
    (e: Expr): readonly never[] | undefined =>
      e.kind === 'ref' ? (table[e.id] as readonly never[] | undefined) : undefined;

  it('refuses an object none of whose kinds fits; accepts unknown, undefined and mixed kinds', () => {
    expect(argProblem(on, [ref(1), ref(2)], kindsOf({ 1: ['point'], 2: ['point'] }))).toMatch(
      /needs curve as argument 2, not point/u,
    );
    for (const second of [[], ['undefined'], ['inexact'], ['point', 'line'], ['circle']])
      expect(argProblem(on, [ref(1), ref(2)], kindsOf({ 1: ['point'], 2: second }))).toBe(
        undefined,
      );
  });

  it('fitsParam: curves, integers and numbers', () => {
    const P = pt(Fl, [0, 0]);
    expect(fitsParam(P, 'curve')).toBe(false);
    expect(fitsParam(line(Fl, [0, 0], [1, 0]), 'curve')).toBe(true);
    expect(fitsParam(lit(Fl, '1/2'), 'integer')).toBe(false);
    expect(fitsParam(lit(Fl, 3), 'integer')).toBe(true);
    expect(fitsParam(P, 'integer')).toBe(false);
    expect(fitsParam({ kind: 'number', v: 3 }, 'integer')).toBe(false);
    expect(fitsParam({ kind: 'number', v: 3 }, 'number')).toBe(false);
    expect(fitsParam(P, 'number')).toBe(false);
    expect(fitsParam(lit(Fl, '1/2'), 'number')).toBe(true);
  });

  it('pairs and the {i} placeholders of messages beyond 9', () => {
    expect(pairs(3)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    const names = Array.from({ length: 12 }, (_, i) => `P${String(i)}`);
    expect(formatClaimMessage('{10} and {11} coincide', names)).toBe('P10 and P11 coincide');
  });
});

describe('hypotheses', () => {
  it('every equality word is refused as an assumption ("construct it")', () => {
    for (const k of ['equal', 'eq', 'equals', 'right', 'isosceles', 'equilateral'])
      expect(assumptionProblem({ id: 1, kind: k, args: [] }), k).toMatch(/construct it/u);
  });

  const P = (...xs: Xy[]) => xs.map((x) => pt(Fl, x));

  it('convex: a turn whose height (twice the area over the LONGEST side) is in the band', () => {
    // At (5, 0) the turn's height is 7.5e-7 (inside BAND·10 = 1e-6), though the cross product
    // over the shorter side would be 1.5e-6.
    const quad = P([0, 0], [5, 0], [10, 1.5e-6], [5, 5]);
    expect(checkAssumption('convex', quad, 'number', S10)).toBe('ambiguous');
    expect(checkAssumption('convex', P([0, 0], [5, -1], [10, 0], [5, 5]), 'number', S10)).toBe(
      'holds',
    );
  });

  it('inside: crossings of slanted edges', () => {
    const tri: Value<number> = { kind: 'polygon', pts: P([0, 0], [4, 0], [0, 4]) };
    expect(checkAssumption('inside', [pt(Fl, [1, 1]), tri], 'number', S10)).toBe('holds');
    expect(checkAssumption('inside', [pt(Fl, [3, 3]), tri], 'number', S10)).toBe('fails');
    const slanted: Value<number> = { kind: 'polygon', pts: P([0, 0], [6, 1], [2, 5]) };
    expect(checkAssumption('inside', [pt(Fl, [3, 2]), slanted], 'number', S10)).toBe('holds');
    expect(checkAssumption('inside', [pt(Fl, [5, 3]), slanted], 'number', S10)).toBe('fails');
  });

  it('in_order on something that is not a curve fails', () => {
    const args = [...P([1, 0], [0, 1], [-1, 0]), pt(Fl, [0, 0])];
    expect(checkAssumption('in_order', args, 'number', S10)).toBe('fails');
    const c = circle(Fl, [0, 0], 1);
    expect(checkAssumption('in_order', [...P([1, 0], [0, 1], [-1, 0]), c], 'number', S10)).toBe(
      'holds',
    );
  });
});

describe('NDG: the height of a triple is twice its area over its LONGEST side', () => {
  it('a middle point 7.5e-7 off the line is ambiguous at scale 10, 1.5e-5 is fine', () => {
    const item = (h: number) => ({
      kind: 'noncollinear' as const,
      a: { x: 0, y: 0 },
      b: { x: 5, y: 0 },
      c: { x: 10, y: h },
      what: 'collinear',
    });
    // The distance from b to line ac is h / 2.
    expect(ndgStatus(Fl, item(1.5e-6), S10)).toBe('ambiguous');
    expect(ndgStatus(Fl, item(3e-5), S10)).toBe('ok');
    expect(ndgStatus(Fl, item(1e-9), S10)).toBe('degenerate');
  });
});
