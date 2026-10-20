/**
 * The size budget of the exact rung (SPEC §10.5: "within a size budget (BigInt bits per
 * value; exceeding it falls through)"). `budgetField` wraps RationalField: as soon as an
 * arithmetic result exceeds the budget, the wrapper records it and from then on answers
 * every operation with 1, so the rest of the evaluation is cheap; the caller then discards
 * the whole run and falls through to the next rung. Answering 1 keeps the kernel's
 * preconditions true (it tests a divisor or a radicand on the very value it then divides
 * by or takes the root of), so nothing throws; the discarded values are never used.
 */
import type { Field } from '@geomira/num/field';
import { add, bitSize, div, mul, neg, ONE, sub, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';

export interface BudgetField {
  readonly field: Field<Rational>;
  /** Whether some result exceeded the budget (the run must be discarded). */
  exceeded(): boolean;
}

/** RationalField with a budget of `bits` (numerator plus denominator) per value. */
export function budgetField(bits: number): BudgetField {
  let over = false;
  const guard =
    (op: (a: Rational, b: Rational) => Rational) =>
    (a: Rational, b: Rational): Rational => {
      if (over) return ONE;
      const r = op(a, b);
      if (bitSize(r) > bits) over = true;
      return over ? ONE : r;
    };
  const field: Field<Rational> = {
    ...RationalField,
    name: 'RationalField',
    add: guard(add),
    sub: guard(sub),
    mul: guard(mul),
    div: guard(div),
    neg: (a) => (over ? ONE : neg(a)),
  };
  return { field, exceeded: () => over };
}
