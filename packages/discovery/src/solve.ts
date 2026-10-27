/**
 * Moving one free input so that a claim holds (ADR-0035 decision 13): Gauss–Newton on the
 * claim kind's own float CONDITIONS (`algebra` over FloatField: every condition 0 ⇔ the claim
 * holds), with finite differences of step √EPS in the input's natural unit, the minimum-norm
 * step when the input has more freedom than the claim has conditions, at most MAX_ITERATIONS
 * steps and a move of at most half the figure's size. A degenerate or undefined figure on the
 * way ends the search (no position). The solution is only a candidate: the hunt job rounds it
 * and asks the claim tester whether the claim holds there.
 */
import { assertNever } from '@geomira/num/assert';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber } from '@geomira/num/rational';
import { EPS } from '@geomira/num/tolerance';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { refsOf } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value } from '@geomira/kernel/value';
import { readFree, writeFree } from '@geomira/claims/free';
import type { ClaimKindSpec } from '@geomira/claims/kind';
import type { ScreenArg } from '@geomira/claims/screen';
import type { Screen } from '@geomira/claims/screen';

export type FreeInput = Screen['free'][number];

export const MAX_ITERATIONS = 16;

/** The slots of an input the search moves (a param moves its value, not its bounds). */
export function movedSlots(input: FreeInput): number[] {
  switch (input.kind) {
    case 'point':
    case 'stereo':
      return [0, 1];
    case 'line-glider':
    case 'angle-glider':
      return [0];
    case 'param':
      return [2];
    case 'radius':
      return [];
    default:
      return assertNever(input.kind, 'free input');
  }
}

export interface Problem {
  readonly doc: Document;
  readonly registry: Registry;
  readonly ctx: EvalContext;
  readonly kind: ClaimKindSpec;
  readonly args: readonly ScreenArg[];
  readonly input: FreeInput;
  /** The natural unit of each moved slot (finite differences and the move limit). */
  readonly units: readonly number[];
  /** The figure's size (the move limit is half of it, in the units' measure). */
  readonly size: number;
}

/** The objects the claim depends on (truncated evaluation). */
export function closureIds(doc: Document, roots: readonly number[]): Set<number> {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const seen = new Set<number>();
  const stack = [...roots];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    const o = byId.get(id);
    if (o === undefined || seen.has(id)) continue;
    seen.add(id);
    stack.push(...refsOf(o.def));
  }
  return seen;
}

/** The document with the input's moved slots set to `x`. */
export function placed(p: Problem, x: readonly number[]): Document | undefined {
  const now = readFree(p.doc, p.input);
  if (now === undefined) return undefined;
  const slots = movedSlots(p.input);
  const values = now.map((v, i) => {
    const k = slots.indexOf(i);
    const xi = k < 0 ? undefined : x[k];
    return xi === undefined ? v : fromNumber(xi);
  });
  return writeFree(p.doc, [{ input: p.input, values }]);
}

function argValues(
  p: Problem,
  values: ReadonlyMap<number, Value<number>>,
): Value<number>[] | undefined {
  const out: Value<number>[] = [];
  for (const a of p.args) {
    if ('lit' in a) {
      out.push({ kind: 'number', v: toNumber(a.lit), exact: a.lit });
      continue;
    }
    const v = values.get(a.id);
    if (v === undefined || v.kind === 'undefined' || v.kind === 'inexact') return undefined;
    out.push(v);
  }
  return out;
}

/** The claim's conditions with the input at x (undefined: the figure is undefined there). */
export function conditionsAt(
  p: Problem,
  x: readonly number[],
  keep: ReadonlySet<number>,
): number[] | undefined {
  const d = placed(p, x);
  if (d === undefined) return undefined;
  const values = evaluate(
    { ...d, objects: d.objects.filter((o) => keep.has(o.id)) },
    p.registry,
    FloatField,
    p.ctx,
  ).values;
  const args = argValues(p, values);
  if (args === undefined) return undefined;
  const a = p.kind.algebra(FloatField, args, p.ctx);
  if ('kind' in a) return undefined;
  return a.conditions.every((c) => Number.isFinite(c)) ? [...a.conditions] : undefined;
}

/** Solves A·y = b (n ≤ 3) by elimination with partial pivoting; undefined when singular. */
export function solveSmall(a: number[][], b: number[]): number[] | undefined {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  const scale = Math.max(...m.flat().map(Math.abs));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[piv]?.[col] ?? 0)) piv = r;
    const pr = m[piv];
    if (pr === undefined || !(Math.abs(pr[col] ?? 0) > EPS * scale)) return undefined;
    [m[col], m[piv]] = [pr, m[col] ?? pr];
    for (let r = 0; r < n; r++) {
      const row = m[r];
      if (r === col || row === undefined) continue;
      const f = (row[col] ?? 0) / (pr[col] ?? 1);
      for (let k = col; k <= n; k++) row[k] = (row[k] ?? 0) - f * (pr[k] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/** One Gauss–Newton step (minimum norm when underdetermined), or undefined. */
function step(f: readonly number[], jac: readonly number[][]): number[] | undefined {
  const [m, n] = [f.length, jac[0]?.length ?? 0];
  const jt = (i: number, j: number) => jac[j]?.[i] ?? 0;
  if (m <= n) {
    // δ = −Jᵀ (J Jᵀ)⁻¹ f
    const jjt = Array.from({ length: m }, (_, i) =>
      Array.from({ length: m }, (_, k) =>
        (jac[i] ?? []).reduce((s, x, j) => s + x * (jac[k]?.[j] ?? 0), 0),
      ),
    );
    const y = solveSmall(
      jjt,
      f.map((x) => -x),
    );
    return y === undefined
      ? undefined
      : Array.from({ length: n }, (_, j) => y.reduce((s, yi, i) => s + jt(j, i) * yi, 0));
  }
  // (JᵀJ) δ = −Jᵀ f
  const jtj = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, k) =>
      jac.reduce((s, row) => s + (row[i] ?? 0) * (row[k] ?? 0), 0),
    ),
  );
  const rhs = Array.from(
    { length: n },
    (_, i) => -jac.reduce((s, row, r) => s + (row[i] ?? 0) * (f[r] ?? 0), 0),
  );
  return solveSmall(jtj, rhs);
}

/** The input's moved values at a solution near the current figure, or undefined. */
export function solve(p: Problem): number[] | undefined {
  const keep = closureIds(
    p.doc,
    p.args.flatMap((a) => ('id' in a ? [a.id] : [])),
  );
  const start = (readFree(p.doc, p.input) ?? [])
    .filter((_, i) => movedSlots(p.input).includes(i))
    .map(toNumber);
  let x = [...start];
  const h = p.units.map((u) => Math.sqrt(EPS) * u);
  for (let it = 0; it < MAX_ITERATIONS; it++) {
    const f = conditionsAt(p, x, keep);
    if (f === undefined) return undefined;
    const cols = x.map((_, j) => {
      const xj = x.map((v, k) => (k === j ? v + (h[k] ?? 0) : v));
      const fj = conditionsAt(p, xj, keep);
      return fj?.map((v, i) => (v - (f[i] ?? 0)) / (h[j] ?? 1));
    });
    if (cols.some((c) => c === undefined)) return undefined;
    const jac = f.map((_, i) => cols.map((c) => c?.[i] ?? 0));
    const d = step(f, jac);
    if (d === undefined) return undefined;
    x = x.map((v, j) => v + (d[j] ?? 0));
    const moved = Math.hypot(...x.map((v, j) => (v - (start[j] ?? 0)) / (p.units[j] ?? 1)));
    if (!(moved * 2 <= 1) && p.input.kind !== 'stereo') return undefined;
    const small = d.every((v, j) => Math.abs(v) <= EPS * (p.units[j] ?? 1));
    if (small) return x;
  }
  return x;
}
