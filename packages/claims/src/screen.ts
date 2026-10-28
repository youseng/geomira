/**
 * The finder's screen (ADR-0035 decision 5): the CURRENT figure and its FLOOR_SAMPLES
 * perturbations are evaluated once, and then any number of candidate claims about the figure's
 * objects are decided by the numeric rung on those value maps: NDG first (degenerate or
 * ambiguous: never true or false), then the noise floor of SPEC §3.1 and, for incidence and
 * tangency, the kernel's banded gap; a small figure is judged at size 1 (ADR-0027). It is the
 * numeric rung of rungs.ts without evaluating the figure per candidate, sharing its code
 * (perturb.ts, decide.ts). A screen never confirms a fact: the finder runs the LOCAL test on
 * the candidates the screen calls true.
 */
import { isInexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import type { Rational } from '@geomira/num/rational';
import { createRng, type Seed } from '@geomira/num/rng';
import { FLOOR_SAMPLES } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import type { EvalContext } from '@geomira/kernel/tool';
import { numOf, undef, type Undefined, type Value } from '@geomira/kernel/value';
import { floatDecide, floatNdg, type Decision } from './decide';
import { findFree, type FreeInput } from './free';
import { argMismatch, paramAt, type ClaimKindSpec } from './kind';
import { judgingFactor, perturbFree, scaledArgs } from './perturb';
import { freeKey, gliderExprs } from './prepare';
import { addProbes } from './probes';

/** A candidate's argument: an object of the figure, or an exact literal. */
export type ScreenArg = { readonly id: number } | { readonly lit: Rational };

/** A screen's decision: the numeric rung's, or undefined objects. */
export type ScreenDecision = Decision | { readonly kind: 'undefined'; readonly reason: string };

export interface Screen {
  readonly seed: Seed;
  readonly ctx: EvalContext;
  /** The float values of the figure's objects (probes excluded from use, not from the map). */
  readonly values: ReadonlyMap<number, Value<number>>;
  /** The figure's free inputs (findFree), in construction order. */
  readonly free: readonly FreeInput[];
  /** Decides kind(args) in the current figure by the numeric rung. */
  decide(kind: ClaimKindSpec, args: readonly ScreenArg[]): ScreenDecision;
  /** The arguments' values in the current figure, or why they are not all available. */
  argValues(kind: ClaimKindSpec, args: readonly ScreenArg[]): Value<number>[] | Undefined;
}

function valuesOf(
  kind: ClaimKindSpec,
  args: readonly ScreenArg[],
  values: ReadonlyMap<number, Value<number>>,
): Value<number>[] | Undefined {
  const out: Value<number>[] = [];
  for (const [i, a] of args.entries()) {
    let v: Value<number>;
    if ('lit' in a) {
      const x = FloatField.fromRational(a.lit);
      v = isInexact(x) ? undef('a literal beyond the double range') : numOf(x, a.lit);
    } else v = values.get(a.id) ?? undef(`object #${String(a.id)} is missing`);
    if (v.kind === 'undefined') return v;
    if (v.kind === 'inexact') return undef(v.reason);
    const p = paramAt(kind, i);
    const bad = argMismatch(kind, v, p, i, `#${String(i + 1)}`);
    if (bad !== undefined)
      return undef(
        bad.invalid
          ? `invalid claim: ${kind.name} needs ${p ?? 'nothing'} as argument ${String(i + 1)}`
          : bad.reason,
      );
    out.push(v);
  }
  return out;
}

/**
 * The screen of `doc` with the perturbations drawn from `seed`, or the reason the figure has
 * no evaluation context (a coordinate beyond the double range).
 */
export function screenFigure(
  doc: Document,
  registry: Registry,
  seed: Seed,
): Screen | { readonly reason: string } {
  const g = screenSteps(doc, registry, seed);
  for (;;) {
    const r = g.next();
    if (r.done === true) return r.value;
  }
}

/**
 * screenFigure in bounded steps: it yields after each evaluation (the figure's, then each
 * perturbation's), so a job on a large figure keeps its steps short (SPEC §16).
 */
export function* screenSteps(
  doc: Document,
  registry: Registry,
  seed: Seed,
): Generator<undefined, Screen | { readonly reason: string }, unknown> {
  const c = evalContextFor(doc);
  if (!c.ok) return { reason: c.reason };
  const ctx = c.ctx;
  const gl = gliderExprs(doc);
  const probed = addProbes(
    doc,
    gl.map((g) => g.expr),
  );
  const base = evaluate(probed.doc, registry, FloatField, ctx).values;
  const gliderValue = new Map<string, Value<number>>();
  gl.forEach((g, i) => {
    const v = base.get(probed.ids[i] ?? -1);
    if (v !== undefined) gliderValue.set(g.key, v);
  });
  const free = findFree(doc, (id, path) => {
    const v = gliderValue.get(freeKey(id, path));
    return v?.kind === 'line' || v?.kind === 'circle' ? v.kind : undefined;
  });
  const k = judgingFactor(doc, ctx);
  const rng = createRng(seed);
  const glider = (input: FreeInput) => gliderValue.get(freeKey(input.id, input.path));
  yield undefined;
  const perturbedValues: ReadonlyMap<number, Value<number>>[] = [];
  for (let i = 0; i < FLOOR_SAMPLES; i++) {
    const p = perturbFree(free, glider, doc, rng, ctx.scale / k);
    perturbedValues.push(evaluate(p, registry, FloatField, ctx).values);
    yield undefined;
  }
  const decide = (kind: ClaimKindSpec, args: readonly ScreenArg[]): ScreenDecision => {
    const a = valuesOf(kind, args, base);
    if (!Array.isArray(a))
      return a.reason.startsWith('invalid claim')
        ? { kind: 'invalid', reason: a.reason }
        : { kind: 'undefined', reason: a.reason };
    const ndg = floatNdg(kind, a, ctx);
    if (ndg !== undefined) return ndg;
    const others = perturbedValues.map((vs) => {
      const p = valuesOf(kind, args, vs);
      return Array.isArray(p) ? scaledArgs(p, k) : p;
    });
    return floatDecide(kind, { args: scaledArgs(a, k), perturbed: others }, ctx);
  };
  return {
    seed,
    ctx,
    values: base,
    free,
    decide,
    argValues: (kind, args) => valuesOf(kind, args, base),
  };
}
