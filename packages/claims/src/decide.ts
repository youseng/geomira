/**
 * Deciding one claim in one figure (SPEC §10.2, §3.1), once its arguments are values.
 *   - exactDecide (Q, mod p): NDG items exactly non-zero, then every condition exactly 0
 *     and every order item of the right sign → true; a non-zero condition → false. An
 *     order item mod p (no order) → Inexact: the rung does not apply.
 *   - floatDecide: NDG items with the band, then the noise floor of SPEC §3.1 on the
 *     residual (floor = max |r(x + δ_k) − r(x)| over three perturbations, ≥ FLOOR_MIN;
 *     TRUE below 100·floor, FALSE above max(1e4·floor, FALSE_ABS), ILL-CONDITIONED when the
 *     floor exceeds FLOOR_MAX) and, for incidence and tangency, the kernel's banded gap
 *     (note B): a gap within EPS·scale is on (a gap within the band touches, for
 *     tangency), so a claim never contradicts a construction.
 */
import { assertNever } from '@geomira/num/assert';
import { inexact, type Field, type FieldSign, type Inexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import {
  classifyResidual,
  noiseFloor,
  sign3,
  type ResidualClass,
  type ToleranceContext,
} from '@geomira/num/tolerance';
import type { Undefined } from '@geomira/kernel/value';
import { signNormalized } from '@geomira/kernel/geom';
import type { Algebra, ClaimArgs, ClaimKindSpec, OrderItem } from './kind';
import { ndgFailure } from './ndg';

/** The outcome of deciding a claim in one figure. */
export type Decision =
  | { readonly kind: 'true' }
  | { readonly kind: 'false'; readonly reason?: string }
  | { readonly kind: 'degenerate'; readonly reason: string }
  | { readonly kind: 'ambiguous'; readonly reason: string }
  | { readonly kind: 'ill-conditioned'; readonly reason: string }
  | { readonly kind: 'invalid'; readonly reason: string };

const TRUE: Decision = { kind: 'true' };

type OrderStatus = 'ok' | 'violated' | 'ambiguous' | 'none';

function orderStatus<T>(F: Field<T>, o: OrderItem<T>, ctx: ToleranceContext): OrderStatus {
  const s: FieldSign =
    F.kind === 'float'
      ? signNormalized(F, o.value, o.norm, o.dim, ctx)
      : F.sign(o.value, o.dim, ctx);
  switch (s) {
    case 'none':
      return 'none';
    case 'ambiguous':
      return 'ambiguous';
    case 0:
      return o.strict ? 'violated' : 'ok';
    case 1:
      return 'ok';
    case -1:
      return 'violated';
    default:
      return assertNever(s, 'field sign');
  }
}

/** The first violated order item, else the first ambiguous one ('none': not evaluable). */
function orderFailure<T>(
  F: Field<T>,
  a: Algebra<T>,
  ctx: ToleranceContext,
): { status: OrderStatus; what: string } | undefined {
  let ambiguous: { status: OrderStatus; what: string } | undefined;
  for (const o of a.order) {
    const s = orderStatus(F, o, ctx);
    if (s === 'violated' || s === 'none') return { status: s, what: o.what };
    if (s === 'ambiguous') ambiguous ??= { status: s, what: o.what };
  }
  return ambiguous;
}

/** Exact decision over Q or mod p, or Inexact when this field cannot decide the claim. */
export function exactDecide<T>(
  F: Field<T>,
  kind: ClaimKindSpec,
  args: ClaimArgs<T>,
  ctx: ToleranceContext,
): Decision | Inexact {
  const a = kind.algebra(F, args, ctx);
  if ('kind' in a) return a.kind === 'inexact' ? a : { kind: 'invalid', reason: a.reason };
  const bad = ndgFailure(F, a.ndg, ctx);
  if (bad !== undefined) return { kind: 'degenerate', reason: `degenerate: ${bad.what}` };
  if (!a.conditions.every((c) => F.isZero(c, 'length', ctx))) return { kind: 'false' };
  const o = orderFailure(F, a, ctx);
  if (o === undefined) return TRUE;
  if (o.status === 'none')
    return inexact(`${kind.name}: deciding "${o.what}" needs an order, which ${F.name} lacks`);
  return { kind: 'false', reason: o.what };
}

/** The float NDG check alone (before any rung): a degenerate or ambiguous decision, or undefined. */
export function floatNdg(
  kind: ClaimKindSpec,
  args: ClaimArgs<number>,
  ctx: ToleranceContext,
): Decision | undefined {
  const a = kind.algebra(FloatField, args, ctx);
  if ('kind' in a) return { kind: 'invalid', reason: a.reason };
  const bad = ndgFailure(FloatField, a.ndg, ctx);
  if (bad === undefined) return undefined;
  return bad.status === 'degenerate'
    ? { kind: 'degenerate', reason: `degenerate: ${bad.what}` }
    : { kind: 'ambiguous', reason: `ambiguous: within the band of a degeneracy (${bad.what})` };
}

/** Residuals of the base figure and of its three perturbations (undefined: not evaluable there). */
export interface FloatEvidence {
  readonly args: ClaimArgs<number>;
  readonly perturbed: readonly (ClaimArgs<number> | Undefined)[];
}

function isArgs(p: ClaimArgs<number> | Undefined): p is ClaimArgs<number> {
  return Array.isArray(p);
}

function floorClass(
  kind: ClaimKindSpec,
  e: FloatEvidence,
  ctx: ToleranceContext,
): { cls: ResidualClass; reason: string } {
  const r0 = kind.residual(e.args, ctx);
  const rs: number[] = [];
  for (const p of e.perturbed) {
    if (!isArgs(p))
      return {
        cls: 'ill-conditioned',
        reason: `ill-conditioned: a perturbation of the figure is undefined (${p.reason})`,
      };
    rs.push(kind.residual(p, ctx));
  }
  const floor = noiseFloor(r0, rs);
  const cls = classifyResidual(r0, floor);
  return { cls, reason: `residual ${r0.toExponential(2)}, noise floor ${floor.toExponential(2)}` };
}

/** Banded verdict of the decisive gap for incidence and tangency (note B). */
function gapVerdict(
  kind: ClaimKindSpec,
  e: FloatEvidence,
  ctx: ToleranceContext,
): 'on' | 'band' | 'off' | undefined {
  if (kind.gap === undefined || kind.test === 'floor') return undefined;
  const g = kind.gap(e.args, ctx);
  if (!Number.isFinite(g)) return 'off';
  const s = sign3(g, 'length', ctx);
  if (s === 0) return 'on';
  if (s === 'ambiguous') return kind.test === 'tangency' ? 'on' : 'band';
  return 'off';
}

/** Float decision with the noise floor (NDG must already have passed). */
export function floatDecide(
  kind: ClaimKindSpec,
  e: FloatEvidence,
  ctx: ToleranceContext,
): Decision {
  const a = kind.algebra(FloatField, e.args, ctx);
  if ('kind' in a) return { kind: 'invalid', reason: a.reason };
  const { cls, reason } = floorClass(kind, e, ctx);
  if (cls === 'ill-conditioned')
    return {
      kind: 'ill-conditioned',
      reason: reason.startsWith('ill') ? reason : `ill-conditioned: ${reason}`,
    };
  const order = orderFailure(FloatField, a, ctx);
  if (order?.status === 'violated') return { kind: 'false', reason: order.what };
  const gap = gapVerdict(kind, e, ctx);
  const truth =
    gap === 'on'
      ? 'true'
      : gap === 'off' && cls === 'true'
        ? 'ambiguous'
        : gap === 'band' && cls === 'false'
          ? 'ambiguous'
          : cls;
  if (truth === 'true') {
    return order === undefined
      ? TRUE
      : { kind: 'ambiguous', reason: `ambiguous: within the band of "${order.what}"` };
  }
  if (truth === 'false') return { kind: 'false' };
  return { kind: 'ambiguous', reason: `ambiguous: ${reason}` };
}

/** Exhaustive helper for callers that switch on a decision. */
export function decisionIsValid(d: Decision): boolean {
  switch (d.kind) {
    case 'true':
    case 'false':
      return true;
    case 'degenerate':
    case 'ambiguous':
    case 'ill-conditioned':
    case 'invalid':
      return false;
    default:
      return assertNever(d, 'decision');
  }
}
