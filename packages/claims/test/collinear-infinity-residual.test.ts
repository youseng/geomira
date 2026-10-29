/**
 * Run 16c audit (ADR-0040 decision 4): collinear with a point at infinity, in floats. With the
 * first two points finite, a FINITE later point was measured by its position vector instead of
 * its offset from the first point, so an irrational figure (no exact rung) showed a false claim
 * true and a true one false. The residual of a finite later point is the sine between B − A and
 * P − A.
 */
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { evalClaim } from '../src/eval-claim';
import { claimKind } from '../src/kinds';
import { along, c, Figure, n, REGISTRY } from './helpers/build';

const pt = (x: number, y: number): Value<number> => ({ kind: 'point', x, y });
const toward = (x: number, y: number): Value<number> => ({
  kind: 'ideal_point',
  d: { x, y },
  chiral: false,
});

describe('collinear(A, B, P, X∞) in floats measures P from A', () => {
  const residual = (args: Value<number>[]) =>
    claimKind('collinear')?.residual(args, { scale: 10 }) ?? Number.NaN;

  it('a finite P on AB (X∞ along AB): residual about 0', () => {
    expect(residual([pt(0, 1), pt(1, 1), pt(Math.SQRT2, 1), toward(1, 0)])).toBeLessThan(1e-12);
    expect(residual([pt(0, 1), pt(1, 1), toward(1, 0), pt(Math.SQRT2, 1)])).toBeLessThan(1e-12);
  });

  it('a finite P off AB: residual far from 0', () => {
    expect(residual([pt(0, 1), pt(1, 1), pt(Math.SQRT2, 0), toward(1, 0)])).toBeGreaterThan(0.1);
    expect(residual([pt(0, 1), pt(1, 1), toward(1, 0), pt(Math.SQRT2, 0)])).toBeGreaterThan(0.1);
  });

  it('in a figure with an irrational point: the false claim is false, the true one true', () => {
    const base = () =>
      new Figure()
        .point('O', 0, 0)
        .point('E', 1, 0)
        .point('P', 1, 1)
        .def('k', 'circle', 'O', 'P')
        .def('x', 'line', 'O', 'E')
        .point('A', 0, 1)
        .point('B', 1, 1)
        .def('l', 'line', 'A', 'B')
        .def('m', 'line', c('point', n(0), n(2)), c('point', n(1), n(2)))
        .def('X', 'intersect', 'l', 'm');
    const off = base().add('C', c('intersect', 'x', 'k', along(1)));
    const offClaim = off.claim('collinear', 'A', 'B', 'C', 'X');
    expect(evalClaim(off.doc, offClaim, REGISTRY).value).toBe('false');
    const on = base().add(
      'C',
      c('intersect', 'l', c('circle', 'A', c('point', n(1), n(2))), along(1)),
    );
    const onClaim = on.claim('collinear', 'A', 'B', 'X', 'C');
    expect(evalClaim(on.doc, onClaim, REGISTRY).value).toBe('true');
  });
});
