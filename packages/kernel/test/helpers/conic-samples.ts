/**
 * The construction-key sample of the conic tool (ADR-0042), read by construction-key.test.ts
 * (frozen at 400 lines, so its sample table could not grow by a line): the five fixture points
 * A, B, C, D, P, and the 'figure' comparison of two conics, whose normal form is unique, so the
 * same point set has exactly the same coefficients.
 */
import type { Rational } from '@geomira/num/rational';
import * as Q from '@geomira/num/rational';
import type { Value } from '../../src/value';

const eq = (x: Rational, y: Rational): boolean => Q.isZero(Q.sub(x, y));

export const CONIC = {
  samples: {
    conic: ['A', 'B', 'C', 'D', 'P'],
    exsimilicenter: ['c', 'd'],
    insimilicenter: ['c', 'd'],
  } as Readonly<Record<string, readonly string[]>>,
  sameFigure(a: Value<Rational>, b: Value<Rational>): boolean {
    if (a.kind !== 'conic' || b.kind !== 'conic') return false;
    const pairs: readonly [Rational, Rational][] = [
      [a.a, b.a],
      [a.b, b.b],
      [a.c, b.c],
      [a.d, b.d],
      [a.e, b.e],
      [a.f, b.f],
    ];
    return pairs.every(([x, y]) => eq(x, y));
  },
};
