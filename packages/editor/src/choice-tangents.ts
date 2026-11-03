/**
 * The GUI choice's low-level tier for the common tangents of two circles (ADR-0045), called by
 * choice-many.ts after its filters when none decides firmly. Their candidates carry two structural
 * labels: along(−) the external pair, along(+) the internal pair (reflection-equivariant: measured
 * along O₁→O₂), orient(±) the side of O₁O₂. In order:
 *   1. along(±) alone, when it singles out the clicked tangent (two tangent circles: the double
 *      tangent is alone in its pair);
 *   2. along(±) with near(P) or far_from(P) for a point P of the construction that tells the
 *      clicked tangent from the other one of its pair, by at least `sigmas` deviations of the
 *      local noise (the gap of the two distances to P, robust.ts); reflection-equivariant;
 *   3. along(±), orient(±): structural, orientation-dependent (SPEC §7: written only when nothing
 *      reflection-equivariant decides; the global test names it).
 * Every choice is verified by the kernel's compute with all its selectors. Other branchable
 * calls (no second label) get undefined.
 */
import type { Selector } from '@geomira/kernel/expr';
import { ref } from '@geomira/kernel/expr';
import type { Value, Vec } from '@geomira/kernel/value';
import type { Choice, ChoiceCtx } from './options';
import { firmness, localResponses, type Values } from './robust';

type V = Vec<number>;

/** choice-many.ts's helpers (passed in: the modules must not import each other). */
export interface ManyHelpers {
  picks(c: ChoiceCtx, sels: readonly Selector[]): boolean;
  computeWith(c: ChoiceCtx, values: Values, sels: readonly Selector[]): Value<number> | undefined;
  candidatesIn(c: ChoiceCtx, values: Values): V[] | undefined;
}

const along = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });

/** Whether the call's overload carries the second label (BranchShape.alsoLow, ADR-0045). */
function hasAlong(c: ChoiceCtx): boolean {
  const r = c.registry.resolve(c.tool, c.args);
  return r.ok && r.signature.branch?.alsoLow === 'along';
}

/** The index of the candidate at X (the nearest one). */
function indexAt(cands: readonly V[], X: Value<number> | undefined): number | undefined {
  if (X?.kind !== 'point') return undefined;
  let best: number | undefined;
  for (const [i, p] of cands.entries()) {
    const b = best === undefined ? undefined : cands[best];
    const d = (q: V) => Math.hypot(q.x - X.x, q.y - X.y);
    if (b === undefined || d(p) < d(b)) best = i;
  }
  return best;
}

/** Step 2: along(s) with the firmest near / far_from that separates the pair. */
function withRanker(
  c: ChoiceCtx,
  points: readonly number[],
  sigmas: number,
  s: 1 | -1,
  partner: number,
  h: ManyHelpers,
): Selector[] | undefined {
  const base = c.values.values;
  const responses = localResponses(c.doc, base, c.registry, c.ctx);
  const gap = (values: Values, cands: readonly V[], id: number): number | undefined => {
    const [P, X, Y] = [values.get(id), cands[c.clicked], cands[partner]];
    if (P?.kind !== 'point' || X === undefined || Y === undefined) return undefined;
    return Math.hypot(Y.x - P.x, Y.y - P.y) - Math.hypot(X.x - P.x, X.y - P.y);
  };
  let best: { sels: Selector[]; score: number } | undefined;
  for (const id of points) {
    const g0 = gap(base, c.cands, id);
    if (g0 === undefined || g0 === 0) continue;
    const sels: Selector[] = [along(s), { kind: g0 > 0 ? 'near' : 'far_from', p: ref(id) }];
    const score = firmness(base, responses, (v) => {
      const cs = v === base ? c.cands : h.candidatesIn(c, v);
      const g = cs === undefined ? undefined : gap(v, cs, id);
      return g === undefined ? undefined : [g];
    });
    if (score >= sigmas && (best === undefined || score > best.score) && h.picks(c, sels))
      best = { sels, score };
  }
  return best?.sels;
}

/** The along(±) tier of the common tangents of two circles (module comment), or undefined. */
export function alongChoice(
  c: ChoiceCtx,
  points: readonly number[],
  sigmas: number,
  h: ManyHelpers,
): Choice | undefined {
  if (!hasAlong(c)) return undefined;
  for (const s of [-1, 1] as const) {
    if (h.picks(c, [along(s)])) return { ok: true, selectors: [along(s)], tier: 3 };
    for (const o of [1, -1] as const) {
      if (!h.picks(c, [along(s), orient(o)])) continue;
      const mate = h.computeWith(c, c.values.values, [along(s), orient(o === 1 ? -1 : 1)]);
      const partner = indexAt(c.cands, mate);
      const ranked =
        partner === undefined || partner === c.clicked
          ? undefined
          : withRanker(c, points, sigmas, s, partner, h);
      return { ok: true, selectors: ranked ?? [along(s), orient(o)], tier: 3 };
    }
  }
  return undefined;
}
