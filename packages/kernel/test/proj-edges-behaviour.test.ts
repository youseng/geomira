/**
 * ADR-0054 (mutation shards kernel-a and kernel-b: transform/proj-side.ts, proj-apply.ts):
 * projective images at the edges the Run 16c tests left open, through applyProjective on
 * hand-built values. M sends y = 1 to infinity (W = 1 − y); NEG is the identity written with
 * m₃₃ = −1 (an affine map whose W is negative everywhere). A text anchored on ℓ, an arc and a
 * string have no image (each with its reason); a polygon with a vertex on ℓ and the others on
 * one side has no image (a side passes through infinity); an affine map needs no order, so a
 * polygon's image exists mod p while an angle mark's needs one; under NEG an angle mark keeps
 * its arms (W < 0 and det < 0 cancel); every direction is parallel to the (absent) ℓ of an
 * affine map, in every field.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { EvalContext } from '../src/tool';
import { applyProjective } from '../src/transform/proj-apply';
import { directionSide, positionSide } from '../src/transform/proj-side';
import type { Mat3 } from '../src/transform/projective';
import type { Projective, Value, Vec } from '../src/value';
import { evalCall, pt, q } from './helpers/doc';

const CTX: EvalContext = { scale: 4 };
const FIELDS: readonly Field<unknown>[] = [FloatField, RationalField, ModPField];

function mat<T>(F: Field<T>, xs: readonly number[]): Mat3<T> {
  const e = xs.map((x) => {
    const v = F.fromRational(q(x));
    if (typeof v === 'object' && v !== null && 'kind' in v) throw new Error('inexact');
    return v;
  });
  return [e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8]] as unknown as Mat3<T>;
}
const proj = <T>(F: Field<T>, xs: readonly number[]): Projective<T> => ({
  type: 'projective',
  m: mat(F, xs),
});
const vec = <T>(F: Field<T>, x: number, y: number): Vec<T> => {
  const [a, b] = mat(F, [x, y, 0, 0, 0, 0, 0, 0, 0]);
  return { x: a, y: b };
};
const why = <T>(v: Value<T>): string =>
  v.kind === 'undefined' || v.kind === 'inexact' ? `${v.kind}: ${v.reason}` : v.kind;

const M = [1, 0, 0, 0, 1, 0, 0, -1, 1];
const NEG = [-1, 0, 0, 0, -1, 0, 0, 0, -1];
const SHIFT = [1, 0, 2, 0, 1, 3, 0, 0, 1];

describe('values with no image', () => {
  it('a text anchored on ℓ: its anchor is sent to infinity; off ℓ it moves', () => {
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const text = (x: number, y: number): Value<unknown> => ({
        kind: 'text',
        at: vec(F, x, y),
        text: 'A',
      });
      expect(why(applyProjective(F, proj(F, M), text(3, 1), CTX))).toBe(
        "undefined: apply: the text's anchor is sent to infinity",
      );
      const moved = applyProjective(F, proj(F, M), text(3, 0.5), CTX);
      expect(
        moved.kind === 'text' ? [F.toNumber(moved.at.x), F.toNumber(moved.at.y)] : moved,
      ).toEqual([6, 1]);
    }
  });

  it('an arc and a string have no image', () => {
    const arc = evalCall(FloatField, 'arc', [pt(1, 0), pt(0, 1), pt(-1, 0)]);
    expect(why(applyProjective(FloatField, proj(FloatField, M), arc, CTX))).toBe(
      'undefined: apply: a projective map sends an arc to an arc of a conic, which is not an object',
    );
    expect(
      why(applyProjective(FloatField, proj(FloatField, M), { kind: 'string', s: 'A' }, CTX)),
    ).toBe('undefined: apply does not map a string');
  });

  it('a polygon with a vertex on ℓ and the others on one side: a side passes through infinity', () => {
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const poly: Value<unknown> = {
        kind: 'polygon',
        pts: [vec(F, 0, 0), vec(F, 2, 1), vec(F, -1, -1)],
      };
      expect(why(applyProjective(F, proj(F, M), poly, CTX))).toBe(
        'undefined: apply: a side of the polygon passes through infinity, so it has no image',
      );
    }
  });
});

describe('affine maps', () => {
  it("a polygon's image needs no order: it exists in every field", () => {
    for (const F of FIELDS) {
      const poly: Value<unknown> = {
        kind: 'polygon',
        pts: [vec(F, 0, 0), vec(F, 2, 1), vec(F, -1, 1)],
      };
      for (const m of [SHIFT, NEG]) {
        const img = applyProjective(F, proj(F, m), poly, CTX);
        expect(img.kind, `${F.name} ${String(m)}`).toBe('polygon');
      }
      const img = applyProjective(F, proj(F, SHIFT), poly, CTX);
      expect(img).toEqual({
        kind: 'polygon',
        pts: [vec(F, 2, 3), vec(F, 4, 4), vec(F, 1, 4)],
      });
    }
  });

  it('an angle mark needs an order (mod p: Inexact)', () => {
    const F = ModPField;
    const mark: Value<bigint> = {
      kind: 'angle_mark',
      b: vec(F, 0, 0),
      from: vec(F, 1, 0),
      to: vec(F, 0, 1),
      arcs: 1,
      right: false,
    };
    expect(why(applyProjective(F, proj(F, SHIFT), mark, CTX))).toBe(
      `inexact: apply: an angle mark through a projective map needs an order, which ${F.name} lacks`,
    );
  });

  it('the identity written with m₃₃ = −1 keeps an angle mark as it is', () => {
    for (const F of [FloatField, RationalField] as Field<unknown>[]) {
      const mark: Value<unknown> = {
        kind: 'angle_mark',
        b: vec(F, 1, 1),
        from: vec(F, 3, 1),
        to: vec(F, 1, 2),
        arcs: 2,
        right: false,
      };
      const img = applyProjective(F, proj(F, NEG), mark, CTX);
      if (img.kind !== 'angle_mark') throw new Error(why(img));
      const xy = (v: Vec<unknown>) => [F.toNumber(v.x), F.toNumber(v.y)];
      expect([xy(img.b), xy(img.from), xy(img.to), img.arcs]).toEqual([[1, 1], [3, 1], [1, 2], 2]);
      // W is −1 everywhere: every position is on its negative side.
      expect(positionSide(F, mat(F, NEG), vec(F, 5, -7), CTX)).toBe(-1);
      expect(positionSide(F, mat(F, SHIFT), vec(F, 5, -7), CTX)).toBe(1);
    }
  });

  it('every direction is parallel to the line an affine map sends to infinity (none)', () => {
    for (const F of FIELDS)
      for (const m of [SHIFT, NEG])
        for (const [x, y] of [
          [1, 0],
          [0, 1],
          [3, -2],
        ] as const)
          expect(directionSide(F, mat(F, m), vec(F, x, y), CTX)).toBe('parallel');
  });
});

describe('lines near ℓ (W = 1 − y)', () => {
  const F = FloatField;
  const lineOf = (
    p: Vec<number>,
    d: Vec<number>,
    lo: number | null,
    hi: number | null,
  ): Value<number> => ({ kind: 'line', p, d, lo, hi, chiral: false });

  it('a line parallel to ℓ and off it has an image (a line parallel to it)', () => {
    const img = applyProjective(
      F,
      proj(F, M),
      lineOf({ x: 0, y: 0 }, { x: 1, y: 0 }, null, null),
      CTX,
    );
    expect(img.kind).toBe('line');
    if (img.kind === 'line') expect(Math.abs(img.d.y / img.d.x)).toBeLessThan(1e-12);
  });

  it('a direction within the band of parallel to ℓ: a full line or a segment has an image', () => {
    // The sine of the direction (1, 10⁻⁸) with ℓ is 10⁻⁸: inside the band. Only an end at ∞
    // (a ray) needs that decision; a full line or a segment does not.
    const d = { x: 1, y: 1e-8 };
    expect(applyProjective(F, proj(F, M), lineOf({ x: 0, y: 0 }, d, null, null), CTX).kind).toBe(
      'line',
    );
    const seg = applyProjective(F, proj(F, M), lineOf({ x: 0, y: 0 }, d, 0, 1), CTX);
    expect(seg.kind === 'line' ? [seg.lo !== null, seg.hi !== null] : why(seg)).toEqual([
      true,
      true,
    ]);
    expect(why(applyProjective(F, proj(F, M), lineOf({ x: 0, y: 0 }, d, 0, null), CTX))).toBe(
      'undefined: ambiguous: within the band of the line sent to infinity',
    );
  });

  it('mod p a range has no image (it needs an order); a full line has one', () => {
    const P = ModPField;
    const l = (lo: bigint | null, hi: bigint | null): Value<bigint> => ({
      kind: 'line',
      p: vec(P, 0, 0),
      d: vec(P, 1, 2),
      lo,
      hi,
      chiral: false,
    });
    for (const [lo, hi] of [
      [0n, 1n],
      [0n, null],
    ] as const)
      expect(why(applyProjective(P, proj(P, M), l(lo, hi), CTX))).toBe(
        `inexact: apply: a range through a projective map needs an order, which ${P.name} lacks`,
      );
    expect(applyProjective(P, proj(P, M), l(null, null), CTX).kind).toBe('line');
  });
});
