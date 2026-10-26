/**
 * The finder's candidates (ADR-0035 decisions 8–9): per searched claim kind, tuples of the
 * figure's objects whose current values fit the kind's parameters, distinct objects per tuple,
 * canonical under the kind's symmetries (increasing on the positions of transposition
 * generators; any other generator by the claim key), in construction order. MEASURE kinds pair
 * argument groups whose float measures satisfy the kind's relation within the screening window
 * instead (sorting, not enumerating every tuple). Nothing here decides a claim: the screen does.
 */
import { assertNever } from '@geomira/num/assert';
import { TRUE_FACTOR, FLOOR_MAX } from '@geomira/num/tolerance';
import type { Rational } from '@geomira/num/rational';
import type { Value, Vec } from '@geomira/kernel/value';
import {
  isLiteralParam,
  paramAt,
  type ClaimKindSpec,
  type ClaimParam,
  type MeasureHint,
} from '@geomira/claims/kind';
import type { ScreenArg } from '@geomira/claims/screen';
import { claimKey, transposition } from '@geomira/claims/symmetry';
import { objectKey } from './terms';

/** A candidate fact: a kind, its arguments, its claim key and the objects it names. */
export interface Candidate {
  readonly kind: ClaimKindSpec;
  readonly args: readonly ScreenArg[];
  readonly key: string;
  readonly objects: readonly number[];
}

/** The figure's objects by what they can be an argument of, in construction order. */
export interface Pools {
  readonly order: ReadonlyMap<number, number>;
  readonly point: readonly number[];
  readonly line: readonly number[];
  readonly circle: readonly number[];
  readonly curve: readonly number[];
  readonly values: ReadonlyMap<number, Value<number>>;
  /** The figure's scale (lengths are screened relative to it). */
  readonly scale: number;
}

/** Relative window of the measure pairing: TRUE_FACTOR·FLOOR_MAX (num's constants). */
export const WINDOW = TRUE_FACTOR * FLOOR_MAX;

/** The pools of a figure: objects with a defined value, in construction order. */
export function poolsOf(
  ids: readonly number[],
  values: ReadonlyMap<number, Value<number>>,
  scale: number,
): Pools {
  const order = new Map(ids.map((id, i) => [id, i]));
  const of = (k: string) => ids.filter((id) => values.get(id)?.kind === k);
  const line = of('line');
  const circle = of('circle');
  const curve = ids.filter((id) => line.includes(id) || circle.includes(id));
  return { order, point: of('point'), line, circle, curve, values, scale };
}

function pool(p: Pools, param: ClaimParam): readonly number[] {
  switch (param) {
    case 'point':
      return p.point;
    case 'line':
      return p.line;
    case 'circle':
      return p.circle;
    case 'curve':
      return p.curve;
    case 'integer':
    case 'number':
      return [];
    default:
      return assertNever(param, 'claim parameter');
  }
}

/** The searched arity of a kind and the parameter of each position. */
export function shapeOf(kind: ClaimKindSpec): ClaimParam[] {
  const arity = kind.finder?.arity ?? kind.params.length;
  return Array.from({ length: arity }, (_, i) => paramAt(kind, i) ?? 'point');
}

/** The generators that apply to these literals, split into transpositions and the rest. */
function constraints(kind: ClaimKindSpec, arity: number, lits: readonly Rational[]) {
  const gens = (kind.symmetry ?? []).filter(
    (s) => s.perm.length === arity && (s.when === undefined || s.when(lits)),
  );
  const pairs = gens.flatMap((s) => {
    const t = transposition(s.perm);
    return t === undefined ? [] : [t];
  });
  return { pairs, exact: pairs.length === gens.length };
}

function makeCandidate(kind: ClaimKindSpec, args: ScreenArg[]): Candidate {
  const objects = [...new Set(args.flatMap((a) => ('id' in a ? [a.id] : [])))];
  const key = claimKey(
    kind,
    args.map((a) => ('id' in a ? { key: objectKey(a.id) } : { lit: a.lit })),
  );
  return { kind, args, key, objects };
}

/** Tuples of distinct objects by position, increasing where a transposition says so. */
function* tuples(
  shape: readonly ClaimParam[],
  p: Pools,
  pairs: readonly (readonly [number, number])[],
): Generator<number[]> {
  const out: number[] = [];
  function* fill(pos: number): Generator<number[]> {
    if (pos === shape.length) {
      yield [...out];
      return;
    }
    const param = shape[pos] ?? 'point';
    if (isLiteralParam(param)) {
      out.push(-1);
      yield* fill(pos + 1);
      out.pop();
      return;
    }
    const lower = pairs.filter(([, j]) => j === pos).map(([i]) => p.order.get(out[i] ?? -1) ?? -1);
    const floor = Math.max(-1, ...lower);
    for (const id of pool(p, param)) {
      if (out.includes(id) || (p.order.get(id) ?? -1) <= floor) continue;
      out.push(id);
      yield* fill(pos + 1);
      out.pop();
    }
  }
  yield* fill(0);
}

/** Literal assignments of a kind: none when it has no literal parameter. */
function literalSets(kind: ClaimKindSpec, shape: readonly ClaimParam[]): (readonly Rational[])[] {
  const n = shape.filter((x) => isLiteralParam(x)).length;
  return n === 0 ? [[]] : [...(kind.finder?.literals ?? [])];
}

function withLits(
  shape: readonly ClaimParam[],
  ids: readonly number[],
  lits: readonly Rational[],
): ScreenArg[] {
  let k = 0;
  return shape.map((param, i) => {
    if (isLiteralParam(param)) {
      const lit = lits[k++];
      return lit === undefined ? { id: -1 } : { lit };
    }
    return { id: ids[i] ?? -1 };
  });
}

/** Plain enumeration of a kind (no measure hint), deduplicated by claim key. */
export function* plainCandidates(kind: ClaimKindSpec, p: Pools): Generator<Candidate> {
  const shape = shapeOf(kind);
  const seen = new Set<string>();
  for (const lits of literalSets(kind, shape)) {
    const { pairs } = constraints(kind, shape.length, lits);
    for (const ids of tuples(shape, p, pairs)) {
      const c = makeCandidate(kind, withLits(shape, ids, lits));
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      yield c;
    }
  }
}

/** Work between two yields of the incremental steps (counting, measuring). */
export const TICK = 512;

/** A computation that yields between bounded chunks of work (the job's steps stay short). */
export type Ticking<T> = Generator<undefined, T, unknown>;

export interface Count {
  readonly total: number;
  readonly more: boolean;
  readonly exact: boolean;
}

/** How many candidates plain enumeration has, counted up to `limit` (exact when it says so). */
export function* countPlain(kind: ClaimKindSpec, p: Pools, limit: number): Ticking<Count> {
  const shape = shapeOf(kind);
  let total = 0;
  let exact = true;
  for (const lits of literalSets(kind, shape)) {
    const c = constraints(kind, shape.length, lits);
    exact &&= c.exact;
    const it = tuples(shape, p, c.pairs);
    for (let r = it.next(); r.done !== true; r = it.next()) {
      if (++total > limit) return { total: limit, more: true, exact };
      if (total % TICK === 0) yield undefined;
    }
  }
  return { total, more: false, exact };
}

/** The measured group tuples (distinct points, canonical under the group's transpositions). */
function* measuredGroups(
  size: number,
  m: MeasureHint,
  p: Pools,
  limit: number,
): Ticking<{ list: { ids: number[]; x: number }[]; cut: boolean }> {
  const pairs = (m.groupSymmetry ?? []).flatMap((g) => {
    const t = transposition(g);
    return t === undefined ? [] : [t];
  });
  const out: { ids: number[]; x: number }[] = [];
  let k = 0;
  for (const ids of tuples(Array<ClaimParam>(size).fill('point'), p, pairs)) {
    const x = measureOf(m, ids, p);
    if (x !== undefined) out.push({ ids, x });
    if (++k % TICK === 0) yield undefined;
    if (k >= limit) return { list: out, cut: true };
  }
  return { list: out, cut: false };
}

function measureOf(m: MeasureHint, ids: readonly number[], p: Pools): number | undefined {
  const pts: Vec<number>[] = [];
  for (const id of ids) {
    const v = p.values.get(id);
    if (v?.kind !== 'point') return undefined;
    pts.push(v);
  }
  const x = m.measure(pts);
  if (x === undefined || !Number.isFinite(x)) return undefined;
  const unit = m.unit === 'length' ? p.scale : 1;
  return m.trivialAt.some((t) => Math.abs(x - t) <= WINDOW * unit) ? undefined : x;
}

/** The sorted measures' indices within [lo, hi]. */
function within(sorted: readonly { m: number; i: number }[], lo: number, hi: number): number[] {
  let a = 0;
  let b = sorted.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if ((sorted[mid]?.m ?? Infinity) < lo) a = mid + 1;
    else b = mid;
  }
  const out: number[] = [];
  for (let k = a; k < sorted.length && (sorted[k]?.m ?? Infinity) <= hi; k++)
    out.push(sorted[k]?.i ?? -1);
  return out;
}

/** Intervals of the window around t (wrapped into [0, period) when periodic). */
function windows(t: number, w: number, period: number | undefined): [number, number][] {
  if (period === undefined) return [[t - w, t + w]];
  const x = ((t % period) + period) % period;
  const out: [number, number][] = [[x - w, x + w]];
  if (x - w < 0) out.push([x - w + period, period]);
  if (x + w >= period) out.push([0, x + w - period]);
  return out;
}

/** What measure pairing found: candidates in order, and the matches it counted. */
export interface Paired {
  readonly list: readonly Candidate[];
  /** Matching pairs counted (each symmetric pair possibly twice: an upper bound). */
  readonly total: number;
  /** The count stopped at `countLimit`, or the group tuples were cut there. */
  readonly more: boolean;
}

/**
 * The candidates of a measure kind: the first `limit` distinct ones, in construction order of
 * the second group (and the measure order of the first), and a count of every match up to
 * `countLimit`. Only kept candidates are keyed, so counting stays cheap; the work yields every
 * TICK matches or groups.
 */
export function* measureCandidates(
  kind: ClaimKindSpec,
  m: MeasureHint,
  p: Pools,
  limit: number,
  countLimit: number,
): Ticking<Paired> {
  const shape = shapeOf(kind);
  const [g0, g1] = m.groups;
  const measured = yield* measuredGroups(g0.length, m, p, countLimit);
  const groups = measured.list;
  const sorted = groups.map((g, i) => ({ m: g.x, i })).sort((a, b) => a.m - b.m);
  const out = new Map<string, Candidate>();
  let total = 0;
  let k = 0;
  for (const lits of literalSets(kind, shape))
    for (const h of groups) {
      if (++k % TICK === 0) yield undefined;
      const t = m.target(h.x, lits);
      if (!Number.isFinite(t)) continue;
      const w = WINDOW * (m.unit === 'length' ? Math.abs(t) : 1);
      for (const [lo, hi] of windows(t, w, m.period))
        for (const gi of within(sorted, lo, hi)) {
          const g = groups[gi];
          if (
            g === undefined ||
            new Set([...g.ids, ...h.ids]).size === Math.max(g.ids.length, h.ids.length)
          )
            continue;
          if (++total >= countLimit) return { list: [...out.values()], total, more: true };
          if (total % TICK === 0) yield undefined;
          if (out.size >= limit) continue;
          const ids = Array<number>(shape.length).fill(-1);
          g0.forEach((pos, j) => (ids[pos] = g.ids[j] ?? -1));
          g1.forEach((pos, j) => (ids[pos] = h.ids[j] ?? -1));
          const c = makeCandidate(kind, withLits(shape, ids, lits));
          if (!out.has(c.key)) out.set(c.key, c);
        }
    }
  return { list: [...out.values()], total, more: measured.cut };
}
