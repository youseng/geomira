/**
 * Bug (found by L1 in Run 13, when the larger registry reshuffled the fuzzer's draws):
 * ninepoint_circle threw "division by zero" in FloatField for a tiny triangle (sides about
 * 3·10⁻⁷) at distance 15 from the origin. It recomputed the medial triangle's cross product
 * from the rounded midpoints, which rounded to exactly 0 although the triangle itself had
 * passed the collinearity test. The medial triangle is ABC scaled by −1/2, so its sides and
 * cross product are now taken from ABC's (exact: −u/2, −v/2, cross/4).
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { numbersOf } from '../src/value';
import { evalCall, pt } from './helpers/doc';

const P2 = pt('-1973/128', '236575293267593320167286077163965/81129638414606681695789005144064');
const P3 = pt(
  '-74537832560778776774519147/4835703278458516698824704',
  '473150586535186615995680629945923/162259276829213363391578010288128',
);
const P4 = pt(
  '-74537833992146947198240023/4835703278458516698824704',
  '473150586535186583543825264103247/162259276829213363391578010288128',
);

describe('ninepoint_circle of a tiny triangle far from the origin', () => {
  it('never throws in FloatField and gives finite numbers (the figure is in the band: no oracle)', () => {
    for (const tool of ['ninepoint_circle', 'ninepoint_center'] as const) {
      const f = evalCall(FloatField, tool, [P2, P4, P3]);
      expect(['circle', 'point']).toContain(f.kind);
      expect(numbersOf(f).every((x) => Number.isFinite(x))).toBe(true);
      expect(evalCall(RationalField, tool, [P2, P4, P3]).kind).toBe(f.kind);
    }
  });

  it('the nine-point circle passes through the midpoint of BC (its anchor), exactly', () => {
    const v = evalCall(RationalField, 'ninepoint_circle', [P2, P4, P3]);
    const m = evalCall(RationalField, 'midpoint', [P4, P3]);
    expect(v.kind === 'circle' && m.kind === 'point').toBe(true);
    if (v.kind !== 'circle' || m.kind !== 'point') return;
    const F = RationalField;
    const [dx, dy] = [F.sub(m.x, v.c.x), F.sub(m.y, v.c.y)];
    expect(F.eq(F.add(F.mul(dx, dx), F.mul(dy, dy)), v.r2)).toBe(true);
  });
});
