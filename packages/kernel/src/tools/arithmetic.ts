/**
 * Arithmetic on numbers (SPEC §6.2): add, sub, mul, div, neg (the language's `+ − × ÷` and
 * unary minus). Results of exact operands carry their exact value (ADR-0003). Numbers are
 * dimensionless here.
 */
import type { Field } from '@geomira/num/field';
import * as Q from '@geomira/num/rational';
import type { EvalContext, ToolSpec } from '../tool';
import { numOf, undef, type Value } from '../value';
import { badArgs, numAt } from './args';

type Binary = 'add' | 'sub' | 'mul' | 'div';

/** The exact value can be 0 where rounding made the float value large (1e17 + 1 − 1e17 − 1). */
function isExactZero(r: Q.Rational | undefined): boolean {
  return r !== undefined && Q.isZero(r);
}

function binary<T>(F: Field<T>, args: readonly Value<T>[], ctx: EvalContext, op: Binary): Value<T> {
  const [a, b] = [numAt(args, 0), numAt(args, 1)];
  if (a === undefined || b === undefined || args.length !== 2) return badArgs(op);
  if (op === 'div' && (F.isZero(b.v, 'dimensionless', ctx) || isExactZero(b.exact))) {
    return undef('division by zero');
  }
  const exact =
    a.exact !== undefined && b.exact !== undefined ? Q[op](a.exact, b.exact) : undefined;
  return numOf(F[op](a.v, b.v), exact);
}

function neg<T>(F: Field<T>, args: readonly Value<T>[]): Value<T> {
  const a = numAt(args, 0);
  if (a === undefined || args.length !== 1) return badArgs('neg');
  return numOf(F.neg(a.v), a.exact === undefined ? undefined : Q.neg(a.exact));
}

function spec(
  op: Binary,
  symbol: string,
  compute: ToolSpec['compute'],
  extra: readonly string[],
): ToolSpec {
  return {
    id: op,
    name: op,
    family: 'arithmetic',
    signatures: [{ params: ['number', 'number'] }],
    outputKinds: ['number'],
    compute,
    degenerate: extra,
    export: 'numeric',
    doc: `a ${symbol} b on numbers (exact when both are exact).`,
    examples: [{ args: ['2/3', '3/4'] }],
  };
}

export const ARITHMETIC_TOOLS: readonly ToolSpec[] = [
  spec('add', '+', (F, args, ctx) => binary(F, args, ctx, 'add'), []),
  spec('sub', '−', (F, args, ctx) => binary(F, args, ctx, 'sub'), []),
  spec('mul', '×', (F, args, ctx) => binary(F, args, ctx, 'mul'), []),
  spec('div', '÷', (F, args, ctx) => binary(F, args, ctx, 'div'), [
    'b = 0 → Undefined (division by zero)',
  ]),
  {
    id: 'neg',
    name: 'neg',
    family: 'arithmetic',
    signatures: [{ params: ['number'] }],
    outputKinds: ['number'],
    compute: neg,
    degenerate: [],
    export: 'numeric',
    doc: '−a (exact when a is exact).',
    examples: [{ args: ['2/3'] }],
  },
];
