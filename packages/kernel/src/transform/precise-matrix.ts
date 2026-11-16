/** Rounded-once products for cancellation-prone local conic frames (ADR-0072).
 * Float inputs are exact binary rationals; only each final entry is rounded to the field.
 * Non-float fields already have exact arithmetic. No tolerance or geometric decision changes.
 */
import { inexact, isInexact, type Field, type Inexact } from '@geomira/num/field';
import { add, fromNumber, mul, rational } from '@geomira/num/rational';
import { mul3, type Mat3 } from './projective';

export function preciseMul3<T>(F: Field<T>, a: Mat3<T>, b: Mat3<T>): Mat3<T> | Inexact {
  if (F.kind !== 'float') return mul3(F, a, b);
  const entry = (row: number, col: number) => {
    let sum = rational(0n);
    for (let i = 0; i < 3; i++) {
      const av = a[row * 3 + i] ?? F.zero;
      const bv = b[i * 3 + col] ?? F.zero;
      const x = F.toNumber(av),
        y = F.toNumber(bv);
      if (!Number.isFinite(x) || !Number.isFinite(y))
        return inexact('matrix outside the double range');
      sum = add(sum, mul(fromNumber(x), fromNumber(y)));
    }
    return F.fromRational(sum);
  };
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = [
    entry(0, 0),
    entry(0, 1),
    entry(0, 2),
    entry(1, 0),
    entry(1, 1),
    entry(1, 2),
    entry(2, 0),
    entry(2, 1),
    entry(2, 2),
  ];
  if (isInexact(a0)) return a0;
  if (isInexact(a1)) return a1;
  if (isInexact(a2)) return a2;
  if (isInexact(a3)) return a3;
  if (isInexact(a4)) return a4;
  if (isInexact(a5)) return a5;
  if (isInexact(a6)) return a6;
  if (isInexact(a7)) return a7;
  if (isInexact(a8)) return a8;
  return [a0, a1, a2, a3, a4, a5, a6, a7, a8];
}
