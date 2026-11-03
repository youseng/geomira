/**
 * The GUI selector choice for more than two candidates (conic ∩ conic and conic ∩ circle,
 * ADR-0043 decision 14), called by choice.ts with the same context. Tiers, the first that
 * singles out the clicked candidate:
 *   1. other(P, Q, R) with existing points at the three other candidates (four candidates), each
 *      kept only when the kernel's compute still gives a point in every local response;
 *   2. filters with points and lines of the construction: same_side / opposite_side with a line
 *      and a point, on_arc(B, C, [not] A) with points on either intersected curve; one filter
 *      that keeps only the clicked candidate, else two whose kept candidates meet in it. Every
 *      filter is scored as ADR-0012 decision 13 (all its deciding distances in standard
 *      deviations of the local noise, ≥ ROBUST_SIGMAS), a pair by its weaker filter; the
 *      candidates of each local response are computed once and matched to the original ones;
 *   3. (no low-level selector: conic ∩ conic has none);
 *   4. near(P) for a named point incident with the clicked candidate.
 * Every choice is verified by the kernel's compute with all its selectors.
 */
import type { Selector } from '@geomira/kernel/expr';
import { ref, selectorExprs } from '@geomira/kernel/expr';
import { requireOnCircle } from '@geomira/kernel/incidence';
import { onConicSign } from '@geomira/kernel/conic';
import { findObject } from '@geomira/kernel/document';
import { formatExpr, formatSelector, type EvaluatedSelector } from '@geomira/kernel/selector';
import type { Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { pointsCoincide } from '@geomira/scene/coincide';
import { side, type Choice, type ChoiceCtx } from './options';
import { firmness, localResponses, type Values } from './robust';
import { alongChoice } from './choice-tangents';

type V = Vec<number>;

/**
 * Below ROBUST_SIGMAS, the most robust option is still written when it decides by at least this
 * many deviations, with a note saying so: four candidates have no continuous low-level selector
 * to fall back on (ADR-0043 decision 14).
 */
export const FALLBACK_SIGMAS = 2;

/** At most this many points of the curves are tried as on_arc ends and witnesses. */
const MAX_CURVE_POINTS = 24;

interface Option {
  readonly s: Selector;
  /** The candidates the filter keeps in the original figure (by index). */
  readonly mask: number;
  /** The deciding distances in a figure from its matched candidates. */
  readonly q: (values: Values, cands: readonly V[]) => readonly number[] | undefined;
}

function evaluated(
  c: ChoiceCtx,
  values: Values,
  s: Selector,
): EvaluatedSelector<number> | undefined {
  const name = (id: number) => findObject(c.doc, id)?.name;
  const args: Value<number>[] = [];
  for (const e of selectorExprs(s)) {
    const v = e.kind === 'ref' ? values.get(e.id) : undefined;
    if (v === undefined) return undefined;
    args.push(v);
  }
  return { selector: s, args, text: formatSelector(s, (e) => formatExpr(e, name)) };
}

/** The kernel's value of the call with these selectors, in a figure. */
function computeWith(
  c: ChoiceCtx,
  values: Values,
  sels: readonly Selector[],
): Value<number> | undefined {
  const spec = c.registry.get(c.tool);
  const args = c.argIds.map((id) => values.get(id));
  const evs = sels.map((s) => evaluated(c, values, s));
  if (spec === undefined || args.some((a) => a === undefined) || evs.some((e) => e === undefined))
    return undefined;
  return spec.compute(
    FloatField,
    args.filter((a): a is Value<number> => a !== undefined),
    c.ctx,
    evs.filter((e): e is EvaluatedSelector<number> => e !== undefined),
  );
}

/** Whether the kernel, with these selectors, gives exactly the clicked candidate. */
function picks(c: ChoiceCtx, sels: readonly Selector[]): boolean {
  const v = computeWith(c, c.values.values, sels);
  const target = c.cands[c.clicked];
  return v?.kind === 'point' && target !== undefined && pointsCoincide(v, target, c.ctx);
}

/** The permutation of `list` closest to `ref` (least total distance), when the counts agree. */
export function matchAll(list: readonly V[], ref: readonly V[]): V[] | undefined {
  if (list.length !== ref.length) return undefined;
  const d = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
  let best: { cost: number; perm: V[] } | undefined;
  const go = (left: readonly V[], perm: V[], cost: number): void => {
    if (best !== undefined && cost >= best.cost) return;
    const r = ref[perm.length];
    if (r === undefined) {
      best = { cost, perm: [...perm] };
      return;
    }
    for (const [i, x] of left.entries())
      go([...left.slice(0, i), ...left.slice(i + 1)], [...perm, x], cost + d(x, r));
  };
  go(list, [], 0);
  return best?.perm;
}

/** The candidates of the call in a figure, matched to the original ones. */
function candidatesIn(c: ChoiceCtx, values: Values): V[] | undefined {
  const spec = c.registry.get(c.tool);
  const args = c.argIds.map((id) => values.get(id));
  if (spec?.candidates === undefined || args.some((a) => a === undefined)) return undefined;
  const list = spec
    .candidates(
      FloatField,
      args.filter((a): a is Value<number> => a !== undefined),
      c.ctx,
    )
    .flatMap((v) => (v.kind === 'point' ? [{ x: v.x, y: v.y }] : []));
  return matchAll(list, c.cands);
}

const pointIn = (values: Values, id: number): V | undefined => {
  const v = values.get(id);
  return v?.kind === 'point' ? v : undefined;
};

/** The kept mask of a line (p, d) and witness w: the candidates on w's side (same) or not. */
function maskOf(ds: readonly number[], same: boolean): number | undefined {
  const w = ds[ds.length - 1];
  if (w === undefined || !(Math.abs(w) > 0)) return undefined;
  let mask = 0;
  for (const [i, x] of ds.slice(0, -1).entries()) {
    if (!(Math.abs(x) > 0)) return undefined;
    if ((Math.sign(x) === Math.sign(w)) === same) mask |= 1 << i;
  }
  return mask;
}

/** The deciding distances of the line (p, d) for the candidates and the witness. */
const along = (p: V, d: V, cands: readonly V[], w: V) => [
  ...cands.map((x) => side(p, d, x)),
  side(p, d, w),
];

/** Options with a line of the construction and a point as witness. */
function sideOptions(c: ChoiceCtx, points: readonly number[]): Option[] {
  const out: Option[] = [];
  const base = c.values.values;
  for (const o of c.doc.objects) {
    const l = base.get(o.id);
    if (l?.kind !== 'line') continue;
    for (const w of points) {
      const wv = pointIn(base, w);
      if (wv === undefined) continue;
      const q = (values: Values, cands: readonly V[]) => {
        const [lv, x] = [values.get(o.id), pointIn(values, w)];
        return lv?.kind === 'line' && x !== undefined ? along(lv.p, lv.d, cands, x) : undefined;
      };
      for (const same of [true, false]) {
        const mask = maskOf(along(l.p, l.d, c.cands, wv), same);
        if (mask === undefined) continue;
        const kind = same ? 'same_side' : 'opposite_side';
        out.push({ s: { kind, q: ref(w), l: ref(o.id) }, mask, q });
      }
    }
  }
  return out;
}

/** Points of the construction on either intersected curve (the kernel's incidence). */
function curvePoints(c: ChoiceCtx, points: readonly number[]): number[] {
  const on = (p: V) =>
    c.args.some((k) =>
      k.kind === 'circle'
        ? requireOnCircle(FloatField, p, k, c.ctx, 'on') === undefined
        : k.kind === 'conic' && onConicSign(FloatField, k, p, c.ctx) === 0,
    );
  return points
    .filter((id) => {
      const p = pointIn(c.values.values, id);
      return p !== undefined && on(p);
    })
    .slice(0, MAX_CURVE_POINTS);
}

/** on_arc(B, C, [not] A) options with B, C, A on the curves. */
function arcOptions(c: ChoiceCtx, points: readonly number[]): Option[] {
  const on = curvePoints(c, points);
  const out: Option[] = [];
  const base = c.values.values;
  for (const b of on)
    for (const e of on)
      for (const a of on) {
        if (b >= e || a === b || a === e) continue;
        const [bv, ev, av] = [pointIn(base, b), pointIn(base, e), pointIn(base, a)];
        if (bv === undefined || ev === undefined || av === undefined) continue;
        const d = { x: ev.x - bv.x, y: ev.y - bv.y };
        const q = (values: Values, cands: readonly V[]) => {
          const [B, E, A] = [pointIn(values, b), pointIn(values, e), pointIn(values, a)];
          return B === undefined || E === undefined || A === undefined
            ? undefined
            : along(B, { x: E.x - B.x, y: E.y - B.y }, cands, A);
        };
        for (const same of [true, false]) {
          const mask = maskOf(along(bv, d, c.cands, av), same);
          if (mask === undefined) continue;
          out.push({ s: { kind: 'on_arc', b: ref(b), c: ref(e), a: ref(a), not: !same }, mask, q });
        }
      }
  return out;
}

/**
 * near(P) options with points of the construction: P nearer the clicked candidate than to any
 * other; the deciding distances are the gaps |X_k − P| − |X_c − P| to every other candidate.
 */
function nearOptions(c: ChoiceCtx, points: readonly number[]): Option[] {
  const out: Option[] = [];
  const all = (1 << c.cands.length) - 1;
  const gaps = (P: V, cands: readonly V[]) => {
    const dc = cands[c.clicked];
    if (dc === undefined) return undefined;
    const d0 = Math.hypot(dc.x - P.x, dc.y - P.y);
    return cands.flatMap((x, k) =>
      k === c.clicked ? [] : [Math.hypot(x.x - P.x, x.y - P.y) - d0],
    );
  };
  for (const id of points) {
    const P = pointIn(c.values.values, id);
    const g = P === undefined ? undefined : gaps(P, c.cands);
    if (g === undefined || !g.every((x) => x > 0)) continue;
    const q = (values: Values, cands: readonly V[]) => {
      const X = pointIn(values, id);
      return X === undefined ? undefined : gaps(X, cands);
    };
    out.push({ s: { kind: 'near', p: ref(id) }, mask: (1 << c.clicked) & all, q });
  }
  return out;
}

interface Scored {
  readonly sels: readonly Selector[];
  readonly score: number;
}

/**
 * Tier 2: every single option (a filter or near(P)) that keeps only the clicked candidate, and
 * every pair of filters whose kept candidates meet in it, by robust score (module comment),
 * best first, verified by the kernel.
 */
function filters(c: ChoiceCtx, points: readonly number[]): Scored | undefined {
  const want = 1 << c.clicked;
  const options = [
    ...sideOptions(c, points),
    ...arcOptions(c, points),
    ...nearOptions(c, points),
  ].filter((o) => (o.mask & want) !== 0 && o.mask !== (1 << c.cands.length) - 1);
  if (options.length === 0) return undefined;
  const base = c.values.values;
  const responses = localResponses(c.doc, base, c.registry, c.ctx);
  const cands = new Map<Values, V[] | undefined>();
  const candsOf = (v: Values) => {
    if (!cands.has(v)) cands.set(v, v === base ? [...c.cands] : candidatesIn(c, v));
    return cands.get(v);
  };
  const score = (o: Option) =>
    firmness(base, responses, (v) => {
      const cs = candsOf(v);
      return cs === undefined ? undefined : o.q(v, cs);
    });
  const firm = options
    .map((o) => ({ o, score: score(o) }))
    .filter((x) => x.score >= FALLBACK_SIGMAS)
    .sort((a, b) => b.score - a.score);
  const singles: Scored[] = firm
    .filter((x) => x.o.mask === want)
    .map((x) => ({ sels: [x.o.s], score: x.score }));
  const best = new Map<number, (typeof firm)[number]>();
  for (const x of firm) if (!best.has(x.o.mask)) best.set(x.o.mask, x);
  const pairs = [...best.values()].flatMap((x, i, all) =>
    all
      .slice(i + 1)
      .filter((y) => (x.o.mask & y.o.mask) === want)
      .map((y): Scored => ({ sels: [x.o.s, y.o.s], score: Math.min(x.score, y.score) })),
  );
  // One selector before two at equal robustness (a single filter is the simpler text).
  const all = [...singles, ...pairs].sort(
    (a, b) => b.score - a.score || a.sels.length - b.sels.length,
  );
  return all.find((x) => picks(c, x.sels));
}

/** Tier 1: other(P, Q, R) with points at the three other candidates (four candidates). */
function otherThree(c: ChoiceCtx, points: readonly number[]): Selector | undefined {
  if (c.cands.length !== 4) return undefined;
  const at = (x: V) =>
    points.find((id) => {
      const p = pointIn(c.values.values, id);
      return p !== undefined && pointsCoincide(p, x, c.ctx);
    });
  const ids = c.cands.flatMap((x, i) => (i === c.clicked ? [] : [at(x)]));
  const [p, q, r] = ids;
  if (p === undefined || q === undefined || r === undefined) return undefined;
  const s: Selector = { kind: 'other', p: ref(p), rest: [ref(q), ref(r)] };
  if (!picks(c, [s])) return undefined;
  const responses = localResponses(c.doc, c.values.values, c.registry, c.ctx);
  return responses.every((v) => computeWith(c, v, [s])?.kind === 'point') ? s : undefined;
}

/** Tier 4: near(P) for a named point incident with the clicked candidate. */
function nearIncident(c: ChoiceCtx, points: readonly number[]): Selector | undefined {
  const x1 = c.cands[c.clicked];
  if (x1 === undefined) return undefined;
  for (const id of points) {
    const p = pointIn(c.values.values, id);
    const s: Selector = { kind: 'near', p: ref(id) };
    if (p !== undefined && pointsCoincide(p, x1, c.ctx) && picks(c, [s])) return s;
  }
  return undefined;
}

/** The choice among more than two candidates (module comment). */
export function chooseAmong(c: ChoiceCtx, points: readonly number[], sigmas: number): Choice {
  const t1 = otherThree(c, points);
  if (t1 !== undefined) return { ok: true, selectors: [t1], tier: 1 };
  const t2 = filters(c, points);
  if (t2 !== undefined && t2.score >= sigmas) return { ok: true, selectors: t2.sels, tier: 2 };
  // Common tangents of two circles (ADR-0045): their structural along(±) label first.
  const t3 = alongChoice(c, points, sigmas, { picks, computeWith, candidatesIn });
  if (t3 !== undefined) return t3;
  if (t2 !== undefined)
    return {
      ok: true,
      selectors: t2.sels,
      tier: 2,
      note: `the selectors decide by ${t2.score.toFixed(1)} standard deviations of the local noise (a point of the construction near the intersection makes the choice firmer)`,
    };
  const t4 = nearIncident(c, points);
  if (t4 !== undefined) return { ok: true, selectors: [t4], tier: 4 };
  return {
    ok: false,
    reason:
      'no selector of the construction singles out this intersection: add a line or a point that separates it, or the three other common points',
  };
}
