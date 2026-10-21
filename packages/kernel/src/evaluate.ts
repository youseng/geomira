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
import { exprDepth, FLOAT_ARG_LIMIT, MAX_EXPR_DEPTH } from './limits';
import type { Document } from './document';
import { refsOf, selectorExprs, type CallExpr, type Expr } from './expr';
import type { Registry } from './registry';
import { bareIndexProblem } from './selector-check';
import { formatExpr, formatSelector, type EvaluatedSelector } from './selector';
import type { EvalContext } from './tool';
import {
  isKnownKind,
  isUnavailable,
  numbersOf,
  numOf,
  undef,
  type Inexact,
  type Undefined,
  type Value,
} from './value';

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
 * signature accepts (a bare index on a branchable tool: with a hint), selectors on a tool
 * that takes none → Undefined for that object; an Undefined argument or selector
 * argument → Undefined ("A is undefined"); an Inexact one → that Inexact; FloatField
 * arguments beyond 2^200 or a non-finite FloatField result → Inexact.
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
    if (exprDepth(o.def) > MAX_EXPR_DEPTH) {
      values.set(
        o.id,
        undef(`${o.name} is nested more than ${String(MAX_EXPR_DEPTH)} levels deep`),
      );
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
    case 'str':
      return { kind: 'string', s: e.value };
    case 'call':
      return evalCall(e, env);
    default:
      return assertNever(e, 'expression');
  }
}

/** The values of `exprs`, or the first unavailable one ("A is undefined" for a named A). */
function evalAll<T>(exprs: readonly Expr[], env: Env<T>): Value<T>[] | Undefined | Inexact {
  const values = exprs.map((a) => evalExpr(a, env));
  for (const [i, a] of values.entries()) {
    if (!isUnavailable(a)) continue;
    const src = exprs[i];
    const name = src?.kind === 'ref' ? env.names.get(src.id) : undefined;
    return a.kind === 'undefined' && name !== undefined ? undef(`${name} is undefined`) : a;
  }
  return values;
}

/** The evaluated selectors of a call, or the first unavailable selector argument. */
function evalSelectors<T>(e: CallExpr, env: Env<T>): EvaluatedSelector<T>[] | Undefined | Inexact {
  const out: EvaluatedSelector<T>[] = [];
  const show = (x: Expr) => formatExpr(x, (id) => env.names.get(id));
  for (const selector of e.selectors) {
    const args = evalAll(selectorExprs(selector), env);
    if (!Array.isArray(args)) return args;
    out.push({ selector, args, text: formatSelector(selector, show) });
  }
  return out;
}

function evalCall<T>(e: CallExpr, env: Env<T>): Value<T> {
  const tool = env.registry.get(e.tool);
  if (tool === undefined) return undef(`unknown tool "${e.tool}"`);
  if (e.selectors.length > 0 && tool.candidates === undefined) {
    return undef(`${e.tool} takes no selectors`);
  }
  const args = evalAll(e.args, env);
  if (!Array.isArray(args)) return args;
  const r = env.registry.resolve(e.tool, args);
  if (!r.ok) return undef(bareIndexProblem(e, args, env.registry) ?? r.reason);
  const selectors = evalSelectors(e, env);
  if (!Array.isArray(selectors)) return selectors;
  const inputs = [...args, ...selectors.flatMap((s) => s.args)];
  if (!inputs.every((a) => inFloatRange(env.F, a, FLOAT_ARG_LIMIT))) {
    return inexact(`${e.tool}: an argument is too large for double-precision geometry`);
  }
  const out = r.tool.compute(env.F, args, env.ctx, selectors);
  return inFloatRange(env.F, out, Infinity)
    ? out
    : inexact(`${e.tool}: the result is beyond the double range`);
}

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
