/**
 * The decision of one figure (decide.ts, ADR-0008 decisions 4–6) in each branch: the kernel's
 * banded gap against the noise floor (incidence and tangency disagreeing with the floor both
 * ways), order items decided on the normalised quantity at the band's edge, ill-conditioned
 * figures with their reasons, and order items mod p. Run 10, note A: the mutation survivors of
 * decide.ts.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { exactDecide, floatDecide } from '../src/decide';
import type { ClaimKindSpec } from '../src/kind';
import { claimKind } from '../src/kinds';
import { circle, line, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}
const Fl = FloatField;
const same = (args: Value<number>[]) => ({ args, perturbed: [args, args, args] });
const onCircle = (x: Xy[0]) => [pt(Fl, [x, 0]), circle(Fl, [0, 0], 1)];

describe('float decisions', () => {
  it('a point just inside a long segment’s end: the order item is ambiguous (normalised, scale 1000)', () => {
    const seg = line(Fl, [0, 0], [1000, 0], 'segment');
    expect(floatDecide(kind('on'), same([pt(Fl, ['999.99999', 0]), seg]), { scale: 1000 })).toEqual(
      {
        kind: 'ambiguous',
        reason: 'ambiguous: within the band of "{0} lies outside the range of {1}"',
      },
    );
    expect(floatDecide(kind('on'), same([pt(Fl, [1001, 0]), seg]), { scale: 1000 })).toEqual({
      kind: 'false',
      reason: '{0} lies outside the range of {1}',
    });
    expect(floatDecide(kind('on'), same([pt(Fl, [500, 0]), seg]), { scale: 1000 })).toEqual({
      kind: 'true',
    });
  });

  it('an undefined perturbation, and a noise floor above FLOOR_MAX, are ill-conditioned', () => {
    const base = onCircle(1);
    expect(
      floatDecide(
        kind('on'),
        {
          args: base,
          perturbed: [base, { kind: 'undefined', reason: 'X is undefined (q)' }, base],
        },
        { scale: 1 },
      ),
    ).toEqual({
      kind: 'ill-conditioned',
      reason: 'ill-conditioned: a perturbation of the figure is undefined (X is undefined (q))',
    });
    const far = onCircle('1.001');
    expect(
      floatDecide(kind('on'), { args: base, perturbed: [far, base, base] }, { scale: 1 }),
    ).toEqual({
      kind: 'ill-conditioned',
      reason: 'ill-conditioned: residual 0.00e+0, noise floor 1.00e-3',
    });
  });

  it('incidence: a gap inside the band that the floor calls false is ambiguous, never false', () => {
    expect(floatDecide(kind('on'), same(onCircle('1.00000005')), { scale: 1 })).toEqual({
      kind: 'ambiguous',
      reason: 'ambiguous: residual 5.00e-8, noise floor 1.00e-14',
    });
  });

  it('incidence: a gap beyond the band that the floor calls true is ambiguous, never true', () => {
    const base = onCircle('1.0000002');
    const moved = onCircle('1.00000021');
    expect(
      floatDecide(kind('on'), { args: base, perturbed: [moved, base, base] }, { scale: 1 }),
    ).toEqual({
      kind: 'ambiguous',
      reason: 'ambiguous: residual 2.00e-7, noise floor 1.00e-8',
    });
  });

  it('tangency: a gap inside the band is a touch (true) although the floor calls it false', () => {
    const l = line(Fl, [-5, '1.00000005'], [5, '1.00000005']);
    const c = circle(Fl, [0, 0], 1);
    expect(floatDecide(kind('tangent'), same([l, c]), { scale: 1 })).toEqual({ kind: 'true' });
    const off = line(Fl, [-5, '1.001'], [5, '1.001']);
    expect(floatDecide(kind('tangent'), same([off, c]), { scale: 1 })).toEqual({ kind: 'false' });
  });
});

describe('exact decisions', () => {
  it('an endpoint is on its segment over Q; beyond is false with the reason', () => {
    const Q = RationalField;
    const seg = line(Q, [0, 0], [10, 0], 'segment');
    expect(exactDecide(Q, kind('on'), [pt(Q, [10, 0]), seg], { scale: 1 })).toEqual({
      kind: 'true',
    });
    expect(exactDecide(Q, kind('on'), [pt(Q, [11, 0]), seg], { scale: 1 })).toEqual({
      kind: 'false',
      reason: '{0} lies outside the range of {1}',
    });
  });

  it('mod p, an order item cannot be decided: Inexact with the reason', () => {
    const M = ModPField;
    expect(
      exactDecide(M, kind('on'), [pt(M, [5, 0]), line(M, [0, 0], [10, 0], 'segment')], {
        scale: 1,
      }),
    ).toEqual({
      kind: 'inexact',
      reason:
        'on: deciding "{0} lies outside the range of {1}" needs an order, which ModPField lacks',
    });
  });
});
