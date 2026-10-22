/**
 * The verdict rungs for one figure (SPEC §10.5), first applicable first:
 *   1. EXACT OVER Q: the claim's closure over RationalField within the size budget, no
 *      Inexact; conditions tested for exact zero.
 *   2. EXACT MOD p: only when the static analysis allows it (a POLYNOMIAL KIND, no
 *      sign-based selector, no radical overload: L17) and a cryptographic source is given;
 *      every free input is replaced by a uniform value mod p (the rung tests the algebraic
 *      identity, independent of this figure and of the hypotheses).
 *   3. NUMERIC: floats with the noise floor (three perturbations of size FLOOR_DELTA·scale).
 *      A figure smaller than the evaluation scale (SPEC §3.1 clamps it to ≥ 1) has its claim
 *      arguments scaled up to that scale first, and its perturbations are FLOOR_DELTA times
 *      its own size: the claim is judged relative to the figure at every size (ADR-0027);
 *      the figure itself is still evaluated with the kernel's context.
 * Before any rung, the float figure decides: an Undefined argument or a degenerate (or
 * ambiguous) NDG item → the claim is not true or false in this figure.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField, P } from '@geomira/num/modp';
import { fromNumber, rational, toNumber } from '@geomira/num/rational';
import { uniformBigInt, type EntropySource, type Rng } from '@geomira/num/rng';
import { FLOOR_DELTA, FLOOR_SAMPLES } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import { figureDiameter } from '@geomira/kernel/figure-size';
import { applySimilarity, similarity } from '@geomira/kernel/similarity';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { EvalContext } from '@geomira/kernel/tool';
import { numOf, undef, type Inexact, type Undefined, type Value } from '@geomira/kernel/value';
import { budgetField } from './budget';
import { exactDecide, floatDecide, floatNdg, type Decision } from './decide';
import { readFree, writeFree, type Assignment, type FreeInput } from './free';
import { checkAssumption } from './hypotheses';
import { fitsParam, formatClaimMessage, paramAt } from './kind';
import { freeKey, type Prepared } from './prepare';
import { truncate, withoutProbes } from './probes';

export type RungName = 'exact over Q' | 'exact mod p' | 'numeric';

export const RUNG_NAMES: readonly RungName[] = Object.freeze([
  'exact over Q',
  'exact mod p',
  'numeric',
]);

export type SampleOutcome =
  | { readonly kind: 'true'; readonly rung: RungName }
  | { readonly kind: 'false'; readonly rung: RungName; readonly reason?: string }
  | { readonly kind: 'rejected'; readonly reason: string }
  | {
      readonly kind: 'degenerate' | 'undefined' | 'ambiguous' | 'ill-conditioned' | 'invalid';
      readonly reason: string;
    };

export interface LadderOptions {
  readonly budgetBits: number;
  /** Cryptographic randomness for the mod-p rung; without it the rung is not used. */
  readonly entropy?: EntropySource;
  /** The stream of the noise-floor perturbations. */
  readonly rng: Rng;
  /** Whether hypotheses are checked (they are for samples, not for the current figure). */
  readonly hypotheses: boolean;
}

/** The claim's arguments in an evaluation, or why they are not all available. */
export function claimArgs<T>(
  prep: Prepared,
  F: Field<T>,
  values: ReadonlyMap<number, Value<T>>,
): Value<T>[] | Undefined | Inexact {
  const out: Value<T>[] = [];
  for (const [i, a] of prep.args.entries()) {
    const text = prep.argText[i] ?? '?';
    let v: Value<T>;
    if ('lit' in a) {
      const x = F.fromRational(a.lit);
      v = isInexact(x) ? x : numOf(x, a.lit);
    } else {
      v = values.get(a.probe) ?? undef(`${text} is missing`);
    }
    if (v.kind === 'undefined') return undef(`${text} is undefined (${v.reason})`);
    if (v.kind === 'inexact') return v;
    const p = paramAt(prep.kind, i);
    if (p === undefined || !fitsParam(v, p))
      return undef(
        `invalid claim: ${prep.kind.name} needs ${p ?? 'nothing'} as argument ${String(i + 1)}, not ${v.kind}`,
      );
    out.push(v);
  }
  return out;
}

function fromDecision(d: Decision, rung: RungName, prep: Prepared): SampleOutcome {
  const msg = (s: string) => formatClaimMessage(s, prep.argText);
  switch (d.kind) {
    case 'true':
      return { kind: 'true', rung };
    case 'false':
      return d.reason === undefined
        ? { kind: 'false', rung }
        : { kind: 'false', rung, reason: msg(d.reason) };
    case 'degenerate':
    case 'ambiguous':
    case 'ill-conditioned':
    case 'invalid':
      return { kind: d.kind, reason: msg(d.reason) };
    default:
      return assertNever(d, 'decision');
  }
}

function hypothesesOutcome(
  prep: Prepared,
  values: ReadonlyMap<number, Value<number>>,
  ctx: EvalContext,
): SampleOutcome | undefined {
  for (const h of prep.hypotheses) {
    const args = h.probes.map((id) => values.get(id) ?? undef('missing'));
    const s = checkAssumption(h.assumption.kind, args, h.dim, ctx);
    if (s !== 'holds')
      return {
        kind: 'rejected',
        reason: `assume ${h.assumption.kind}: ${s === 'fails' ? 'not satisfied' : 'within the band'}`,
      };
  }
  return undefined;
}

/** Exact over Q, or undefined when the rung does not apply (budget, Inexact). */
function exactRung(
  prep: Prepared,
  doc: Document,
  ctx: EvalContext,
  bits: number,
): SampleOutcome | undefined {
  const b = budgetField(bits);
  const values = evaluate(truncate(doc, prep.claimClosure), prep.registry, b.field, ctx).values;
  if (b.exceeded()) return undefined;
  const args = claimArgs(prep, b.field, values);
  if (!Array.isArray(args))
    return args.kind === 'undefined' ? { kind: 'undefined', reason: args.reason } : undefined;
  // The claim's own algebra counts against the budget too.
  const d = exactDecide(b.field, prep.kind, args, ctx);
  return isInexact(d) || b.exceeded() ? undefined : fromDecision(d, 'exact over Q', prep);
}

/** Uniform values mod p for every free input the mod-p rung varies. */
function modpAssignments(free: readonly FreeInput[], src: EntropySource): Assignment[] {
  const draw = () => rational(uniformBigInt(src, P));
  return free.flatMap((input): Assignment[] => {
    switch (input.kind) {
      case 'point':
        return [{ input, values: [draw(), draw()] }];
      case 'line-glider':
      case 'angle-glider':
        return [{ input, values: [draw()] }];
      case 'stereo':
        return [{ input, values: [draw(), draw()] }];
      case 'param':
        return [];
      case 'radius':
        return [];
      default:
        return [];
    }
  });
}

/** Exact mod p (identity test with cryptographic values), or undefined when it does not apply. */
function modpRung(prep: Prepared, doc: Document, src: EntropySource): SampleOutcome | undefined {
  const params = prep.free.filter((x) => x.kind === 'param');
  const paramValues = params.map((input) => ({
    input,
    values: [...(readFree(doc, input) ?? []).slice(0, 2), rational(uniformBigInt(src, P))],
  }));
  const sample = writeFree(doc, [...modpAssignments(prep.free, src), ...paramValues]);
  const ctx = { scale: 1 };
  const values = evaluate(
    truncate(sample, prep.claimClosure),
    prep.registry,
    ModPField,
    ctx,
  ).values;
  const args = claimArgs(prep, ModPField, values);
  if (!Array.isArray(args)) return undefined;
  const d = exactDecide(ModPField, prep.kind, args, ctx);
  return isInexact(d) ? undefined : fromDecision(d, 'exact mod p', prep);
}

/** The free inputs moved by FLOOR_DELTA in their natural units (lengths: scale). */
function perturbed(prep: Prepared, doc: Document, rng: Rng, scale: number): Document {
  const jitter = (x: { num: bigint; den: bigint }, unit: number) =>
    fromNumber(toNumber(x) + FLOOR_DELTA * unit * rng.gaussian());
  const out: Assignment[] = [];
  for (const input of prep.free) {
    const v = readFree(doc, input);
    if (v === undefined || input.kind === 'radius') continue;
    const glider = prep.gliderObjects.get(freeKey(input.id, input.path));
    const unit =
      input.kind === 'point'
        ? scale
        : input.kind === 'line-glider' && glider?.kind === 'line'
          ? scale / Math.hypot(glider.d.x, glider.d.y)
          : input.kind === 'angle-glider'
            ? 180 / Math.PI
            : 1;
    if (input.kind === 'param') {
      const [lo, hi, x] = v;
      if (lo !== undefined && hi !== undefined && x !== undefined)
        out.push({ input, values: [lo, hi, jitter(x, toNumber(hi) - toNumber(lo))] });
      continue;
    }
    out.push({ input, values: v.map((x) => jitter(x, unit)) });
  }
  return writeFree(doc, out);
}

/**
 * The factor the numeric rung scales a figure's claim arguments by before judging them: the
 * evaluation scale over the figure's size (probes excluded) when the size is below it (SPEC
 * §3.1's clamp to ≥ 1), so a small figure is judged as the same figure at size 1; else 1.
 * Degenerate cases: no size (a single point, no free point) or a non-finite one → 1.
 */
function judgingFactor(doc: Document, ctx: EvalContext): number {
  const d = figureDiameter(withoutProbes(doc));
  return d !== undefined && Number.isFinite(d) && d > 0 && d < ctx.scale ? ctx.scale / d : 1;
}

/** The claim's arguments scaled by k about the origin (numbers are dimensionless: kept). */
function scaledArgs(args: readonly Value<number>[], k: number): Value<number>[] {
  if (k === 1) return [...args];
  const s = similarity(false, { re: k, im: 0 }, { re: 0, im: 0 });
  return args.map((v) => (v.kind === 'number' ? v : applySimilarity(FloatField, s, v)));
}

function numericRung(
  prep: Prepared,
  doc: Document,
  ctx: EvalContext,
  args: Value<number>[],
  rng: Rng,
): SampleOutcome {
  const k = judgingFactor(doc, ctx);
  const others: (Value<number>[] | Undefined)[] = [];
  for (let i = 0; i < FLOOR_SAMPLES; i++) {
    const p = perturbed(prep, doc, rng, ctx.scale / k);
    const values = evaluate(truncate(p, prep.claimClosure), prep.registry, FloatField, ctx).values;
    const a = claimArgs(prep, FloatField, values);
    others.push(Array.isArray(a) ? scaledArgs(a, k) : a.kind === 'undefined' ? a : undef(a.reason));
  }
  const e = { args: scaledArgs(args, k), perturbed: others };
  return fromDecision(floatDecide(prep.kind, e, ctx), 'numeric', prep);
}

/** The outcome of the claim in one figure (a sample or the current figure). */
export function decideSample(prep: Prepared, doc: Document, opts: LadderOptions): SampleOutcome {
  const c = evalContextFor(doc);
  if (!c.ok) return { kind: 'undefined', reason: c.reason };
  const ctx = c.ctx;
  const values = evaluate(truncate(doc, prep.floatKeep), prep.registry, FloatField, ctx).values;
  if (opts.hypotheses) {
    const h = hypothesesOutcome(prep, values, ctx);
    if (h !== undefined) return h;
  }
  const args = claimArgs(prep, FloatField, values);
  if (!Array.isArray(args)) {
    return args.reason.startsWith('invalid claim')
      ? { kind: 'invalid', reason: args.reason }
      : { kind: 'undefined', reason: args.reason };
  }
  const ndg = floatNdg(prep.kind, args, ctx);
  if (ndg !== undefined) return fromDecision(ndg, 'numeric', prep);
  const exact = exactRung(prep, doc, ctx, opts.budgetBits);
  if (exact !== undefined) return exact;
  if (opts.entropy !== undefined && prep.analysis.modpExclusions.length === 0) {
    const m = modpRung(prep, doc, opts.entropy);
    if (m !== undefined) return m;
  }
  return numericRung(prep, doc, ctx, args, opts.rng);
}

/** The float values of a figure (for the orientation test's chirality). */
export function floatValues(
  prep: Prepared,
  doc: Document,
): ReadonlyMap<number, Value<number>> | undefined {
  const c = evalContextFor(doc);
  return c.ok
    ? evaluate(truncate(doc, prep.floatKeep), prep.registry, FloatField, c.ctx).values
    : undefined;
}
