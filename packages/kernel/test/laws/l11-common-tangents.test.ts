/**
 * Law L11 (SPEC §17) for the common tangents of two circles (ADR-0045): a selected common tangent
 * moves continuously under a drag until its pair merges; there it is the double tangent within
 * the band, then Undefined: never a jump to another tangent. c1 = circle((0, 0), 2) and
 * c2 = circle((s, 0), 1), the touch points on c1 against closed forms:
 *   - along(−), orient(+): the upper external tangent, T = (2/s, 2√(s² − 1)/s), merging into the
 *     double tangent at (2, 0) at the internal tangency s = 1, nothing for s < 1;
 *   - along(+), orient(+): the upper internal tangent, T = (6/s, 2√(s² − 9)/s), born as the double
 *     tangent at (2, 0) at the external tangency s = 3, nothing for s < 3 (the external tangents
 *     that remain never replace it: the labels are structural).
 * Near each tangency the selected point is within ADR-0006's band-edge bound of the exact branch.
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { BAND } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type Selector } from '../../src/expr';
import type { Value } from '../../src/value';
import { Builder, contextOf, evalDoc, valueOf } from '../helpers/doc';
import { lawCount } from '../helpers/laws';

const STEPS = lawCount(400);
const n = (x: number): Expr => lit(fromNumber(x));
const P = (x: number, y: number): Expr => call('point', [n(x), n(y)]);
const C1 = call('circle', [P(0, 0), n(2)]);
const c2 = (s: number): Expr => call('circle', [P(s, 0), n(1)]);

function touchPoint(s: number, sels: readonly Selector[]): { v: Value<number>; scale: number } {
  const b = new Builder();
  b.add('X', call('tangent_point', [C1, c2(s)], [...sels]));
  const ctx = contextOf(b.doc);
  return { v: valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'X'), scale: ctx.scale };
}

interface Sweep {
  readonly name: string;
  readonly sels: readonly Selector[];
  readonly exact: (s: number) => [number, number] | undefined;
  readonly from: number;
  readonly to: number;
  readonly merge: number;
}

const SWEEPS: readonly Sweep[] = [
  {
    name: 'the upper external tangent, through the internal tangency at s = 1',
    sels: [
      { kind: 'along', sign: -1 },
      { kind: 'orient', sign: 1 },
    ],
    exact: (s) => (s < 1 ? undefined : [2 / s, (2 * Math.sqrt(s * s - 1)) / s]),
    from: 0.6,
    to: 4,
    merge: 1,
  },
  {
    name: 'the upper internal tangent, through the external tangency at s = 3',
    sels: [
      { kind: 'along', sign: 1 },
      { kind: 'orient', sign: 1 },
    ],
    exact: (s) => (s < 3 ? undefined : [6 / s, (2 * Math.sqrt(s * s - 9)) / s]),
    from: 2,
    to: 6,
    merge: 3,
  },
];

/** Within this parameter distance of the merge, the double tangent or Undefined is allowed. */
const NEAR_MERGE = 1e-5;

describe('L11: common tangents of two circles through tangencies', () => {
  for (const w of SWEEPS) {
    it(w.name, () => {
      let prev: [number, number] | undefined;
      for (let i = 0; i <= STEPS; i++) {
        const s = w.from + ((w.to - w.from) * i) / STEPS;
        const { v, scale } = touchPoint(s, w.sels);
        const e = w.exact(s);
        const near = Math.abs(s - w.merge) < NEAR_MERGE;
        if (v.kind !== 'point') {
          expect(e === undefined || near, `s = ${String(s)}: ${v.kind}`).toBe(true);
          prev = undefined;
          continue;
        }
        expect(e !== undefined || near, `s = ${String(s)}: a tangent where there is none`).toBe(
          true,
        );
        if (e === undefined || near) continue;
        expect(Math.hypot(v.x - e[0], v.y - e[1]), `s = ${String(s)}`).toBeLessThan(1e-9 * scale);
        if (prev !== undefined) {
          const e2 = w.exact(s - (w.to - w.from) / STEPS);
          const step = e2 === undefined ? Infinity : Math.hypot(e[0] - e2[0], e[1] - e2[1]);
          expect(Math.hypot(v.x - prev[0], v.y - prev[1])).toBeLessThan(step * 1.5 + BAND * scale);
        }
        prev = [v.x, v.y];
      }
    });

    it(`${w.name}: near the tangency, the double tangent within the band, then nothing`, () => {
      for (const k of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        for (const sign of [-1, 1]) {
          const s = w.merge + sign * 10 ** -k;
          const { v, scale } = touchPoint(s, w.sels);
          const e = w.exact(s);
          // ADR-0006's band-edge bound for two circles, √(2r₁r₂g/|r₁ ∓ r₂|) with g = BAND·scale,
          // r₁ = 2, r₂ = 1 (|r₁ ∓ r₂| ≥ 1), with a margin of 2 for the touch point on c1.
          const bound = 2 * Math.sqrt(2 * 2 * 1 * BAND * scale);
          if (v.kind !== 'point') {
            expect(e === undefined || Math.abs(s - w.merge) < 1e-6, `s = ${String(s)}`).toBe(true);
            continue;
          }
          const target = e ?? [2, 0];
          expect(Math.hypot(v.x - target[0], v.y - target[1]), `s = ${String(s)}`).toBeLessThan(
            e === undefined ? bound : Math.max(bound, 1e-9 * scale),
          );
        }
    });
  }
});
