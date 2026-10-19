/**
 * AMBIGUITY (Run 3b, SPEC §3.1 and §7): every deciding quantity of selection, placed at the
 * band edges. The figures pin the scale to 100 (two far free points), so EPS·scale = 10⁻⁷
 * and BAND·scale = 10⁻⁵; a quantity q is placed at ±0.5·EPS·scale (a zero), ±0.5 and ±0.9
 * BAND·scale (inside the band) and ±1.1, ±2 BAND·scale (decided). Within the band → Undefined
 * ("ambiguous: …"), never a silent choice; a zero reference is meaningless (Undefined); a
 * decided quantity selects. Tangency itself is decided on the discriminant (as a length):
 * within the band → ONE double point (SPEC §6.3), clearly negative → Undefined, clearly
 * positive → two candidates (the maintainer's note on ADR-0005; ADR-0006 item 6).
 */
import { FloatField } from '@geomira/num/float-field';
import { BAND, EPS } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import type { Value } from '../src/value';
import { Builder, contextOf, evalDoc, num, pt, valueOf } from './helpers/doc';

const SCALE = 100;
const STEPS = [
  0.5 * EPS,
  -0.5 * EPS,
  0.5 * BAND,
  -0.5 * BAND,
  0.9 * BAND,
  -0.9 * BAND,
  1.1 * BAND,
  -1.1 * BAND,
  2 * BAND,
  -2 * BAND,
].map((k) => k * SCALE);

type Zone = 'zero' | 'band' | 'out';
const zone = (q: number): Zone =>
  Math.abs(q) <= EPS * SCALE ? 'zero' : Math.abs(q) < BAND * SCALE ? 'band' : 'out';

/** tool(args, selectors) in a figure whose scale is exactly 100. */
function value(
  tool: string,
  args: (b: Builder) => Expr[],
  sels: (b: Builder) => Selector[] = () => [],
): Value<number> {
  const b = new Builder();
  b.point('S_1', -30, -40);
  b.point('S_2', 30, 40);
  b.add('X', call(tool, args(b), sels(b)));
  const ctx = contextOf(b.doc);
  expect(ctx.scale).toBe(SCALE);
  return valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'X');
}

const C5 = (): Expr => call('circle', [pt(0, 0), pt(5, 0)]);
const DIAG = (): Expr => call('line', [pt(-4, -3), pt(4, 3)]);
const xAxis = (y = 0): Expr => call('line', [pt(-1, y), pt(1, y)]);
const at = (v: Value<number>): unknown =>
  v.kind === 'point' ? [v.x, v.y] : v.kind === 'undefined' ? v.reason : v.kind;
const near = (v: Value<number>, p: readonly [number, number]): boolean =>
  v.kind === 'point' && Math.hypot(v.x - p[0], v.y - p[1]) < 1e-12 * SCALE;
const reasonOf = (v: Value<number>): string => (v.kind === 'undefined' ? v.reason : v.kind);

describe('band edges of the selectors (scale 100: EPS·scale = 1e-7, BAND·scale = 1e-5)', () => {
  it('same_side / opposite_side: the reference point near the line', () => {
    for (const q of STEPS) {
      for (const kind of ['same_side', 'opposite_side'] as const) {
        const v = value(
          'intersect',
          () => [DIAG(), C5()],
          () => [{ kind, q: pt(0, q), l: xAxis() }],
        );
        const z = zone(q);
        if (z === 'zero') expect(reasonOf(v)).toMatch(/: the reference point lies on the line$/);
        else if (z === 'band')
          expect(reasonOf(v)).toMatch(
            /^ambiguous: .*: the reference point is within the band of the line$/,
          );
        else expect(at(v)).toEqual(q > 0 === (kind === 'same_side') ? [4, 3] : [-4, -3]);
      }
    }
  });

  it('same_side: a candidate near the line', () => {
    for (const q of STEPS) {
      const v = value(
        'intersect',
        () => [DIAG(), C5()],
        () => [{ kind: 'same_side', q: pt(0, 20), l: xAxis(3 + q) }],
      );
      const z = zone(q);
      if (z !== 'out')
        expect(reasonOf(v)).toMatch(/^ambiguous: .*: a candidate is within the band of the line$/);
      else if (q > 0) expect(reasonOf(v)).toMatch(/^no intersection satisfies same_side/);
      else expect(at(v)).toEqual([4, 3]);
    }
  });

  it('on_arc(B, C, [not] A): A near the line BC', () => {
    for (const q of STEPS) {
      for (const not of [false, true]) {
        const v = value(
          'intersect',
          () => [DIAG(), C5()],
          (b) => [
            { kind: 'on_arc', b: b.point('B', -5, 0), c: b.point('C', 5, 0), a: pt(0, q), not },
          ],
        );
        const z = zone(q);
        if (z === 'zero') expect(reasonOf(v)).toMatch(/: the reference point lies on the line$/);
        else if (z === 'band') expect(reasonOf(v)).toMatch(/^ambiguous: on_arc/);
        else expect(at(v)).toEqual(q > 0 !== not ? [4, 3] : [-4, -3]);
      }
    }
  });

  it('between(A, B): a candidate near an end', () => {
    for (const q of STEPS) {
      const v = value(
        'intersect',
        () => [DIAG(), C5()],
        () => [{ kind: 'between', a: pt(0, 0), b: pt(4 + 0.8 * q, 3 + 0.6 * q) }],
      );
      const z = zone(q);
      if (z !== 'out')
        expect(reasonOf(v)).toMatch(
          /^ambiguous: between.*: a candidate is within the band of an end$/,
        );
      else if (q > 0) expect(at(v)).toEqual([4, 3]);
      else expect(reasonOf(v)).toMatch(/^no intersection satisfies between/);
    }
  });

  it('inside(c) / outside(c): a candidate near the circle', () => {
    for (const q of STEPS) {
      for (const kind of ['inside', 'outside'] as const) {
        const c = call('circle', [pt(4.8, 3.6), num(1 - q)]);
        const v = value(
          'intersect',
          () => [DIAG(), C5()],
          () => [{ kind, c }],
        );
        const z = zone(q);
        if (z !== 'out')
          expect(reasonOf(v)).toMatch(/: a candidate is within the band of the circle$/);
        else if (kind === 'inside') {
          if (q < 0) expect(at(v)).toEqual([4, 3]);
          else expect(reasonOf(v)).toMatch(/^no intersection satisfies inside/);
        } else if (q < 0) expect(at(v)).toEqual([-4, -3]);
        else expect(reasonOf(v)).toMatch(/^ambiguous: add a selector: both intersections satisfy/);
      }
    }
  });

  it('near(P) / far_from(P): a tie between the candidates', () => {
    for (const q of STEPS) {
      for (const kind of ['near', 'far_from'] as const) {
        const v = value(
          'intersect',
          () => [DIAG(), C5()],
          () => [{ kind, p: pt(0.4 * q, 0.3 * q) }],
        );
        const z = zone(q);
        if (z !== 'out')
          expect(reasonOf(v)).toMatch(/: the candidates are equally far from the point$/);
        else expect(at(v)).toEqual(q > 0 === (kind === 'near') ? [4, 3] : [-4, -3]);
      }
    }
  });

  it('other(P): P near the circle (the banded incidence of ADR-0004 item 1)', () => {
    for (const q of STEPS) {
      const v = value(
        'intersect',
        () => [xAxis(), C5()],
        () => [{ kind: 'other', p: pt(5 + q, 0) }],
      );
      const z = zone(q);
      if (z === 'zero') expect(at(v)).toEqual([-5 - q, 0]);
      else if (z === 'band')
        expect(reasonOf(v)).toMatch(
          /^ambiguous: within the band of incidence \(other\(.*\) needs the point on the circle\)$/,
        );
      else expect(reasonOf(v)).toMatch(/^other\(.*\) needs the point on the circle$/);
    }
  });

  it('a candidate near the end of a segment (the range is decided on t, dimensionless)', () => {
    for (const k of [0.5 * EPS, -0.5 * EPS, 0.5 * BAND, -0.5 * BAND, 2 * BAND, -2 * BAND]) {
      // segment from (−4, −3) to (4, 3)·(1 + 2k): the candidate (4, 3) is at t = 1/(1 + k).
      const v = value(
        'intersect',
        () => [call('segment', [pt(-4, -3), pt(4 * (1 + 2 * k), 3 * (1 + 2 * k))]), C5()],
        () => [{ kind: 'along', sign: 1 }],
      );
      if (Math.abs(k) < BAND && Math.abs(k) > EPS) {
        expect(reasonOf(v)).toBe(
          'ambiguous: the intersection is within the band of an end of the segment',
        );
      } else if (Math.abs(k) <= EPS || k > 0) expect(near(v, [4, 3])).toBe(true);
      // along(+) names the further intersection of the carrier line: off the segment, it
      // is not replaced by the other one (no silent change of branch).
      else expect(reasonOf(v)).toBe('no intersection satisfies along(+)');
    }
  });
});

describe('band edges of the discriminant: tangency is decided on it as a length (ADR-0006 item 6)', () => {
  it('line ∩ circle at distance 5 + q from the centre: double point / misses / two', () => {
    for (const q of STEPS) {
      const v = value(
        'intersect',
        () => [call('line', [pt(5 + q, -1), pt(5 + q, 1)]), C5()],
        () => [{ kind: 'along', sign: 1 }],
      );
      const z = zone(q);
      if (z !== 'out') expect(at(v)).toEqual([5 + q, 0]);
      else if (q > 0) expect(reasonOf(v)).toBe('no intersection: the line misses the circle');
      else {
        expect(v.kind === 'point' && v.x === 5 + q && v.y > 0).toBe(true);
        // Clearly two: no selector → ambiguous (no root of a rounding residue decides it).
        expect(
          reasonOf(value('intersect', () => [call('line', [pt(5 + q, -1), pt(5 + q, 1)]), C5()])),
        ).toMatch(/^ambiguous: add a selector/);
      }
    }
  });

  it('circle ∩ circle, external and internal tangency at (5, 0)', () => {
    for (const q of STEPS) {
      const ext = value(
        'intersect',
        () => [C5(), call('circle', [pt(8 + q, 0), num(3)])],
        () => [{ kind: 'orient', sign: 1 }],
      );
      const int = value(
        'intersect',
        () => [C5(), call('circle', [pt(2 + q, 0), num(3)])],
        () => [{ kind: 'orient', sign: 1 }],
      );
      const z = zone(q);
      if (z !== 'out') {
        for (const v of [ext, int])
          expect(v.kind === 'point' && Math.abs(v.x - 5) < 1e-4 && v.y === 0).toBe(true);
      } else {
        expect(reasonOf(q > 0 ? ext : int)).toBe(
          q > 0
            ? 'no intersection: the circles are apart'
            : 'no intersection: one circle lies inside the other',
        );
        const two = q > 0 ? int : ext;
        expect(two.kind === 'point' && two.y > 0).toBe(true);
      }
    }
  });

  it('tangent_point / tangent_from with |OP| = 5 + q: inside / double point / two', () => {
    for (const q of STEPS) {
      for (const tool of ['tangent_point', 'tangent_from']) {
        const v = value(
          tool,
          () => [pt(5 + q, 0), C5()],
          () => [{ kind: 'orient', sign: 1 }],
        );
        const z = zone(q);
        if (z !== 'out') {
          const p = v.kind === 'point' ? v : v.kind === 'line' ? v.p : undefined;
          expect(
            p !== undefined && Math.abs(p.x - 25 / (5 + q)) < 1e-12 && p.y === 0,
            JSON.stringify(v),
          ).toBe(true);
        } else if (q < 0) expect(reasonOf(v)).toBe(`${tool}(P, c): P lies inside the circle`);
        else {
          const p = v.kind === 'point' ? v : v.kind === 'line' ? v.p : undefined;
          expect(p !== undefined && p.y < 0).toBe(true);
        }
      }
    }
  });
});
