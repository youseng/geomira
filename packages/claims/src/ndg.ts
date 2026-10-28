/**
 * Non-degeneracy data (SPEC §10.1, ADR-0008). A claim kind lists NDG items, each a small
 * geometric predicate that must hold for the claim to mean anything ("A ≠ B", "A, B, C not
 * collinear"). Every item is a polynomial that must be non-zero; `any` holds when one of
 * its items holds (concyclic needs SOME non-collinear triple).
 *
 * Decisions, generic over Field<T>:
 *   - exact fields (Q, mod p): the polynomial is tested for exact zero;
 *   - FloatField: the quantity is measured as a LENGTH or as a dimensionless sine and
 *     decided with num's banded sign (ADR-0002): within EPS → degenerate, inside the band
 *     → ambiguous, beyond → non-degenerate. Short but valid segments are therefore never
 *     called degenerate, and no decision flips silently.
 */
import { assertNever } from '@geomira/num/assert';
import { isInexact, type Field, type FieldSign } from '@geomira/num/field';
import type { Dim, ToleranceContext } from '@geomira/num/tolerance';
import { vCross, vDot, vSub } from '@geomira/kernel/geom';
import type { Vec } from '@geomira/kernel/value';

export type Ndg<T> =
  | { readonly kind: 'distinct'; readonly a: Vec<T>; readonly b: Vec<T>; readonly what: string }
  | {
      readonly kind: 'noncollinear';
      readonly a: Vec<T>;
      readonly b: Vec<T>;
      readonly c: Vec<T>;
      readonly what: string;
    }
  | { readonly kind: 'nonparallel'; readonly u: Vec<T>; readonly v: Vec<T>; readonly what: string }
  | {
      readonly kind: 'off_line';
      readonly p: Vec<T>;
      readonly q: Vec<T>;
      readonly d: Vec<T>;
      readonly what: string;
    }
  | { readonly kind: 'distinct_radii'; readonly r2a: T; readonly r2b: T; readonly what: string }
  /**
   * `value` ≠ 0, measured in FloatField as value/√norm of dimension `dim` (norm > 0); exact
   * fields test value (ADR-0042: a line not in an asymptotic direction of a conic).
   */
  | {
      readonly kind: 'nonzero';
      readonly value: T;
      readonly norm: T;
      readonly dim: Dim;
      readonly what: string;
    }
  | { readonly kind: 'any'; readonly items: readonly Ndg<T>[]; readonly what: string };

export type NdgStatus = 'ok' | 'degenerate' | 'ambiguous';

/** The first failing item and how it fails, or undefined when every item holds. */
export interface NdgFailure {
  readonly status: 'degenerate' | 'ambiguous';
  readonly what: string;
}

function fromSign(s: FieldSign, zero: boolean): NdgStatus {
  switch (s) {
    case 0:
      return 'degenerate';
    case 'ambiguous':
      return 'ambiguous';
    case 1:
    case -1:
      return 'ok';
    case 'none':
      return zero ? 'degenerate' : 'ok';
    default:
      return assertNever(s, 'field sign');
  }
}

/** √x in F, or undefined when it is not representable (exact fields). */
function root<T>(F: Field<T>, x: T): T | undefined {
  const r = F.sqrt(x);
  return isInexact(r) ? undefined : r;
}

/**
 * Decides x / den as a quantity of dimension `dim` in FloatField (den > 0 expected; a zero
 * den is degenerate); exact fields test x itself. `den` is computed lazily (it needs
 * square roots, which exact fields do not have).
 */
function decide<T>(
  F: Field<T>,
  x: T,
  den: () => T | undefined,
  dim: Dim,
  ctx: ToleranceContext,
): NdgStatus {
  if (F.kind !== 'float') return fromSign(F.sign(x, dim, ctx), F.isZero(x, dim, ctx));
  const d = den();
  if (d === undefined || F.toNumber(d) <= 0) return 'degenerate';
  const q = F.div(x, d);
  const a = F.toNumber(q) < 0 ? F.neg(q) : q;
  return fromSign(F.sign(a, dim, ctx), false);
}

function len<T>(F: Field<T>, v: Vec<T>): T | undefined {
  return root(F, vDot(F, v, v));
}

function longest<T>(F: Field<T>, a: Vec<T>, b: Vec<T>, c: Vec<T>): T | undefined {
  const sides = [vSub(F, b, a), vSub(F, c, a), vSub(F, c, b)].map((v) => len(F, v));
  let best: T | undefined;
  for (const s of sides) {
    if (s === undefined) return undefined;
    if (best === undefined || F.toNumber(s) > F.toNumber(best)) best = s;
  }
  return best;
}

/** The status of one NDG item (see the module comment for the decisions). */
export function ndgStatus<T>(F: Field<T>, item: Ndg<T>, ctx: ToleranceContext): NdgStatus {
  switch (item.kind) {
    case 'distinct': {
      const w = vSub(F, item.b, item.a);
      if (F.kind !== 'float') {
        const zero = F.isZero(w.x, 'length', ctx) && F.isZero(w.y, 'length', ctx);
        return zero ? 'degenerate' : 'ok';
      }
      return decide(F, vDot(F, w, w), () => len(F, w), 'length', ctx);
    }
    case 'noncollinear': {
      const { a, b, c } = item;
      const cross = vCross(F, vSub(F, b, a), vSub(F, c, a));
      // The smallest height: twice the area over the longest side.
      return decide(F, cross, () => longest(F, a, b, c), 'length', ctx);
    }
    case 'nonparallel': {
      const cross = vCross(F, item.u, item.v);
      return decide(
        F,
        cross,
        () => root(F, F.mul(vDot(F, item.u, item.u), vDot(F, item.v, item.v))),
        'dimensionless',
        ctx,
      );
    }
    case 'off_line': {
      const cross = vCross(F, item.d, vSub(F, item.p, item.q));
      return decide(F, cross, () => len(F, item.d), 'length', ctx);
    }
    case 'distinct_radii':
      return radiiStatus(F, item.r2a, item.r2b, ctx);
    case 'nonzero':
      return decide(F, item.value, () => root(F, item.norm), item.dim, ctx);
    case 'any':
      return anyStatus(item.items.map((x) => ndgStatus(F, x, ctx)));
    default:
      return assertNever(item, 'NDG item');
  }
}

/** |√a − √b| as a length in FloatField; a ≠ b exactly in exact fields. */
function radiiStatus<T>(F: Field<T>, a: T, b: T, ctx: ToleranceContext): NdgStatus {
  const diff = F.sub(a, b);
  if (F.kind !== 'float') return fromSign(F.sign(diff, 'area', ctx), F.isZero(diff, 'area', ctx));
  const [ra, rb] = [root(F, a), root(F, b)];
  if (ra === undefined || rb === undefined) return 'degenerate';
  const sum = F.add(ra, rb);
  return decide(F, diff, () => sum, 'length', ctx);
}

function anyStatus(all: readonly NdgStatus[]): NdgStatus {
  if (all.includes('ok')) return 'ok';
  return all.includes('ambiguous') ? 'ambiguous' : 'degenerate';
}

/** The first item that does not hold (degenerate before ambiguous), or undefined. */
export function ndgFailure<T>(
  F: Field<T>,
  items: readonly Ndg<T>[],
  ctx: ToleranceContext,
): NdgFailure | undefined {
  let ambiguous: NdgFailure | undefined;
  for (const item of items) {
    const s = ndgStatus(F, item, ctx);
    if (s === 'degenerate') return { status: s, what: item.what };
    if (s === 'ambiguous') ambiguous ??= { status: s, what: item.what };
  }
  return ambiguous;
}
