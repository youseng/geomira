/**
 * Evaluation (SPEC §9): evaluate(doc, registry, F, ctx) over any field, in construction
 * order, pure and TOTAL (it never throws: every degenerate case is a Value). The float run
 * draws the figure, the Rational run is the exact oracle, the ModP run serves the tester.
 * evaluateFrom re-evaluates only what an edit can have changed and equals a full evaluate
 * (law L2).
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, isInexact, type Field } from '@geomira/num/field';
import { contextProblem } from './context';
import type { Document } from './document';
import { refsOf, type CallExpr, type Expr } from './expr';
import type { Registry } from './registry';
import type { EvalContext } from './tool';
import { isKnownKind, isUnavailable, numbersOf, numOf, undef, type Value } from './value';

export interface Evaluation<T> {
  readonly field: Field<T>;
  readonly ctx: EvalContext;
  readonly registry: Registry;
  /** Object id → value, for every object of the document. */
  readonly values: ReadonlyMap<number, Value<T>>;
}

interface Env<T> {
  readonly F: Field<T>;
  readonly ctx: EvalContext;
  readonly registry: Registry;
  readonly values: ReadonlyMap<number, Value<T>>;
  readonly names: ReadonlyMap<number, string>;
}

/**
 * Every object's value. Degenerate cases: an invalid ctx → every object Undefined with
 * the reason; an unknown tool, a reference to a missing or later object, arguments no
 * signature accepts, selectors on a tool that takes none → Undefined for that object;
 * an Undefined argument → Undefined ("A is undefined"); an Inexact argument → that
 * Inexact; FloatField arguments beyond 2^200 or a non-finite FloatField result → Inexact.
 */
export function evaluate<T>(
  doc: Document,
  registry: Registry,
  F: Field<T>,
  ctx: EvalContext,
): Evaluation<T> {
  return run(doc, registry, F, ctx, undefined, new Set());
}

/**
 * Incremental evaluation after an edit: `changed` lists the objects whose definition
 * changed (or that were moved by a drag); objects that are new, changed, or depend on a
 * re-evaluated object are evaluated again, the rest keep their previous value. A
 * different field, registry or scale falls back to a full evaluate.
 */
export function evaluateFrom<T>(
  prev: Evaluation<T>,
  doc: Document,
  registry: Registry,
  F: Field<T>,
  ctx: EvalContext,
  changed: Iterable<number>,
): Evaluation<T> {
  const same = prev.field === F && prev.registry === registry && prev.ctx.scale === ctx.scale;
  return same
    ? run(doc, registry, F, ctx, prev, new Set(changed))
    : evaluate(doc, registry, F, ctx);
}

function run<T>(
  doc: Document,
  registry: Registry,
  F: Field<T>,
  ctx: EvalContext,
  prev: Evaluation<T> | undefined,
  changed: ReadonlySet<number>,
): Evaluation<T> {
  const problem = contextProblem(ctx);
  const values = new Map<number, Value<T>>();
  const env: Env<T> = {
    F,
    ctx,
    registry,
    values,
    names: new Map(doc.objects.map((o) => [o.id, o.name])),
  };
  const redone = new Set<number>();
  for (const o of doc.objects) {
    if (problem !== undefined) {
      values.set(o.id, undef(problem));
      continue;
    }
    const old = prev?.values.get(o.id);
    const clean =
      old !== undefined &&
      !changed.has(o.id) &&
      refsOf(o.def).every((id) => values.has(id) && !redone.has(id));
    if (clean) {
      values.set(o.id, old);
      continue;
    }
    redone.add(o.id);
    values.set(o.id, evalExpr(o.def, env));
  }
  return { field: F, ctx, registry, values };
}

function evalExpr<T>(e: Expr, env: Env<T>): Value<T> {
  switch (e.kind) {
    case 'ref':
      return (
        env.values.get(e.id) ?? undef(`refers to #${String(e.id)}, which is not an earlier object`)
      );
    case 'lit': {
      const v = env.F.fromRational(e.value);
      return isInexact(v) ? v : numOf(v, e.value);
    }
    case 'call':
      return evalCall(e, env);
    default:
      return assertNever(e, 'expression');
  }
}

function evalCall<T>(e: CallExpr, env: Env<T>): Value<T> {
  if (env.registry.get(e.tool) === undefined) return undef(`unknown tool "${e.tool}"`);
  if (e.selectors.length > 0) return undef(`${e.tool} takes no selectors`);
  const args = e.args.map((a) => evalExpr(a, env));
  for (const [i, a] of args.entries()) {
    if (!isUnavailable(a)) continue;
    const src = e.args[i];
    const name = src?.kind === 'ref' ? env.names.get(src.id) : undefined;
    return a.kind === 'undefined' && name !== undefined ? undef(`${name} is undefined`) : a;
  }
  const r = env.registry.resolve(e.tool, args);
  if (!r.ok) return undef(r.reason);
  if (!args.every((a) => inFloatRange(env.F, a, FLOAT_ARG_LIMIT))) {
    return inexact(`${e.tool}: an argument is too large for double-precision geometry`);
  }
  const out = r.tool.compute(env.F, args, env.ctx);
  return inFloatRange(env.F, out, Infinity)
    ? out
    : inexact(`${e.tool}: the result is beyond the double range`);
}

/**
 * The largest magnitude of a FloatField argument a tool computes with (2^200 ≈ 1.6e60).
 * Every v1 formula is a polynomial of degree ≤ 4 in its arguments whose divisors are at
 * least (EPS·scale)², so with arguments below this bound no intermediate overflows and
 * no NaN or ±Infinity reaches a zero test, a square root or atan2 (law L1). Beyond it the
 * numbers are not representable for geometry in this field: Inexact (ADR-0003).
 */
const FLOAT_ARG_LIMIT = 2 ** 200;

/**
 * Whether every number of a value is finite and below `limit` in magnitude (FloatField
 * only). A value of a kind outside the union (a future kind, E2) has no numbers the kernel
 * knows of; the tools reject it by capability.
 */
function inFloatRange<T>(F: Field<T>, v: Value<T>, limit: number): boolean {
  return (
    F.kind !== 'float' ||
    !isKnownKind(v) ||
    numbersOf(v).every((x) => {
      const n = F.toNumber(x);
      return Number.isFinite(n) && Math.abs(n) <= limit;
    })
  );
}
