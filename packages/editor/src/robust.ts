/**
 * How firmly a step-2 selector decides (choice.ts, ADR-0012): its deciding distances (of
 * the two candidates and of the witness from the deciding line) against how much each moves
 * when the figure moves as the claim tester's LOCAL regime moves it (noise of LOCAL_SIGMA ×
 * scale on every free input). Each free input is moved by one such deviation, one at a time
 * (a free point's x and y; a glider's parameter by the same arc or length), and the figure
 * re-evaluated; a distance's deviation is the root sum of squares of its responses. The
 * score of a selector is the smallest |distance| / deviation of its deciding distances (a
 * margin counted in standard deviations of the local noise, to first order); a distance
 * that no input moves counts as infinitely firm.
 */
import { LOCAL_SIGMA } from '@geomira/claims/constants';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { call, lit, type Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber } from '@geomira/num/rational';

type V = Vec<number>;
export type Values = ReadonlyMap<number, Value<number>>;

function num(e: Expr | undefined): number | undefined {
  return e?.kind === 'lit' ? toNumber(e.value) : undefined;
}

function litOf(x: number): Expr | undefined {
  return Number.isFinite(x) ? lit(fromNumber(x)) : undefined;
}

/** The definitions one local deviation away from `d` (none for a constructed object). */
function moved(d: Expr, values: Values, h: number): Expr[] {
  if (d.kind !== 'call' || d.selectors.length > 0) return [];
  const [p, ...params] = d.args;
  const [x, y] = [num(d.args[0]), num(d.args[1])];
  if (d.tool === 'point' && d.args.length === 2 && x !== undefined && y !== undefined) {
    const out: Expr[] = [];
    for (const [nx, ny] of [
      [x + h, y],
      [x, y + h],
    ] as const) {
      const [ex, ey] = [litOf(nx), litOf(ny)];
      if (ex !== undefined && ey !== undefined) out.push(call('point', [ex, ey]));
    }
    return out;
  }
  if (d.tool !== 'on' || p?.kind !== 'ref') return [];
  const obj = values.get(p.id);
  const ps = params.map(num);
  if (ps.some((v) => v === undefined)) return [];
  const [a = 0, b = 0] = ps.map((v) => v ?? 0);
  if (obj?.kind === 'line' && ps.length === 1) {
    const e = litOf(a + h / Math.hypot(obj.d.x, obj.d.y));
    return e === undefined ? [] : [call('on', [p, e])];
  }
  if (obj?.kind !== 'circle') return [];
  const r = Math.sqrt(obj.r2);
  if (ps.length === 1) {
    const e = litOf(a + ((h / r) * 180) / Math.PI);
    return e === undefined ? [] : [call('on', [p, e])];
  }
  // (u : v) = (cos φ/2, sin φ/2) up to a factor: turning (u, v) by β moves the point by 2rβ.
  const beta = h / (2 * r);
  const [u, v] = [
    litOf(a * Math.cos(beta) - b * Math.sin(beta)),
    litOf(a * Math.sin(beta) + b * Math.cos(beta)),
  ];
  return u === undefined || v === undefined ? [] : [call('on', [p, u, v])];
}

/**
 * The figure's values with each free input moved by one local deviation, one at a time
 * (evaluated in the figure's own context, so every decision is taken at the same scale).
 */
export function localResponses(
  doc: Document,
  values: Values,
  registry: Registry,
  ctx: EvalContext,
): Values[] {
  const h = LOCAL_SIGMA * ctx.scale;
  const out: Values[] = [];
  for (const o of doc.objects)
    for (const def of moved(o.def, values, h)) {
      const objects = doc.objects.map((x) => (x.id === o.id ? { ...x, def } : x));
      out.push(evaluate({ ...doc, objects }, registry, FloatField, ctx).values);
    }
  return out;
}

/**
 * The score of deciding distances: min over them of |q| / deviation, where `q(values)` gives
 * each distance in a figure (undefined when it has none: the decision is then fragile).
 */
export function firmness(
  base: Values,
  responses: readonly Values[],
  q: (values: Values) => readonly number[] | undefined,
): number {
  const q0 = q(base);
  if (q0 === undefined) return 0;
  const sq = q0.map(() => 0);
  for (const r of responses) {
    const qr = q(r);
    if (qr === undefined || qr.length !== q0.length) return 0;
    for (const [i, x] of qr.entries()) sq[i] = (sq[i] ?? 0) + (x - (q0[i] ?? 0)) ** 2;
  }
  return Math.min(
    ...q0.map((x, i) => {
      const dev = Math.sqrt(sq[i] ?? 0);
      return dev > 0 ? Math.abs(x) / dev : Number.POSITIVE_INFINITY;
    }),
  );
}

/** The two candidates in a figure, in the order of `ref` (nearest first), or undefined. */
export function matched(
  cands: readonly V[] | undefined,
  ref: readonly [V, V | undefined],
): [V, V | undefined] | undefined {
  const [p, q] = cands ?? [];
  if (p === undefined) return undefined;
  if (q === undefined || ref[1] === undefined) return [p, undefined];
  const d = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
  return d(p, ref[0]) + d(q, ref[1]) <= d(q, ref[0]) + d(p, ref[1]) ? [p, q] : [q, p];
}
