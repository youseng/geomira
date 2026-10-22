/**
 * The GUI selector choice (SPEC §7, ADR-0006, ADR-0012): when the user clicks one candidate
 * of a branchable call (intersect of curves, tangent_from), the editor writes the selector
 * that singles it out, taking the FIRST kind that does, in this order:
 *   1. other(P) for an existing point P at the other candidate (exact, Vieta);
 *   2. same_side(Q, l) / opposite_side(Q, l) with a point and a line of the construction, and
 *      on_arc(B, C, [not] A) with points of the construction on the circle (options.ts);
 *      within this kind the largest DECISION MARGIN wins, the margin being counted in
 *      standard deviations of the deciding distances under the claim tester's LOCAL noise
 *      (robust.ts), and a margin below ROBUST_SIGMAS does not decide: a selector that small
 *      changes of the figure can flip is no choice;
 *   3. along(±) (line ∩ circle) / orient(±) (two circles, tangent choices), which follow the
 *      candidate continuously until a tangency;
 *   4. near(P) only for a named point P incident (within BAND) with the clicked candidate.
 * Every choice is verified by the kernel itself (the tool's compute with that selector must
 * give the clicked candidate), so no float shortcut here can write a wrong selector. Built on
 * the kernel's `candidates` (ADR-0006 item 2); orientation-dependent selectors (step 3) are
 * written only when no reflection-equivariant one decides (law L16).
 */
import { evalContextFor } from '@geomira/kernel/context';
import { findObject, type Document } from '@geomira/kernel/document';
import { ref, selectorExprs, type Selector } from '@geomira/kernel/expr';
import type { Evaluation } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import { formatExpr, formatSelector, type EvaluatedSelector } from '@geomira/kernel/selector';
import type { Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { pointsCoincide } from '@geomira/scene/coincide';
import { arcOptions, side, sideOptions, type ChoiceCtx } from './options';
import { firmness, localResponses, type Values } from './robust';

/**
 * A step-2 selector decides only when each of its deciding distances is at least this many
 * standard deviations of its motion under the LOCAL noise (ADR-0012).
 */
export const ROBUST_SIGMAS = 5;

type V = Vec<number>;

export type Choice =
  | { readonly ok: true; readonly selectors: readonly Selector[]; readonly tier: 1 | 2 | 3 | 4 }
  | { readonly ok: false; readonly reason: string };

/** The object ids a selector built here refers to (all its expressions are references). */
function selectorIds(s: Selector): number[] {
  return selectorExprs(s).flatMap((e) => (e.kind === 'ref' ? [e.id] : []));
}

function evaluated(c: ChoiceCtx, s: Selector): EvaluatedSelector<number> | undefined {
  const name = (id: number) => findObject(c.doc, id)?.name;
  const args = selectorIds(s).map((id) => c.values.values.get(id));
  const known = args.filter((a): a is Value<number> => a !== undefined);
  if (known.length !== args.length) return undefined;
  return { selector: s, args: known, text: formatSelector(s, (e) => formatExpr(e, name)) };
}

/** Whether the kernel, with selector s, gives exactly the clicked candidate. */
function picks(c: ChoiceCtx, s: Selector): boolean {
  const spec = c.registry.get(c.tool);
  const ev = evaluated(c, s);
  const target = c.cands[c.clicked];
  if (spec === undefined || ev === undefined || target === undefined) return false;
  const v = spec.compute(FloatField, c.args, c.ctx, [ev]);
  return v.kind === 'point' && pointsCoincide(v, target, c.ctx);
}

function pointIds(c: ChoiceCtx): number[] {
  return c.doc.objects.filter((o) => c.values.values.get(o.id)?.kind === 'point').map((o) => o.id);
}

function at(c: ChoiceCtx, id: number): V | undefined {
  const v = c.values.values.get(id);
  return v?.kind === 'point' ? v : undefined;
}

/**
 * Whether other(point `id`) stays defined in each figure of the local responses (each free
 * input moved by one local deviation). other(P) needs P where the kernel requires it BY
 * CONSTRUCTION: on both curves (Run 10 audit), and for a tangent also on the polar of the
 * external point (ADR-0027). A point there by coincidence leaves as soon as the figure moves,
 * and the written selector would make the result Undefined; the kernel's own compute decides.
 */
function staysOn(c: ChoiceCtx, id: number, responses: readonly Values[]): boolean {
  const spec = c.registry.get(c.tool);
  if (spec === undefined) return false;
  return responses.every((r) => {
    const p = r.get(id);
    const args = c.argIds.map((a) => r.get(a));
    const known = args.filter((a): a is Value<number> => a !== undefined);
    if (p?.kind !== 'point' || known.length !== args.length) return false;
    const s: EvaluatedSelector<number> = { selector: otherOf(id), args: [p], text: 'other' };
    return spec.compute(FloatField, known, c.ctx, [s]).kind === 'point';
  });
}

const otherOf = (id: number): Selector => ({ kind: 'other', p: ref(id) });

function tier1(c: ChoiceCtx, pts: readonly number[]): Selector | undefined {
  const other = c.cands[1 - c.clicked];
  if (c.cands.length !== 2 || other === undefined) return undefined;
  const d = (id: number) => {
    const p = at(c, id);
    return p === undefined ? Infinity : Math.hypot(p.x - other.x, p.y - other.y);
  };
  const near = pts.filter((id) => {
    const p = at(c, id);
    return p !== undefined && pointsCoincide(p, other, c.ctx);
  });
  if (near.length === 0) return undefined;
  const responses = localResponses(c.doc, c.values.values, c.registry, c.ctx);
  for (const id of near.sort((a, b) => d(a) - d(b))) {
    const s = otherOf(id);
    if (picks(c, s) && staysOn(c, id, responses)) return s;
  }
  return undefined;
}

function tier2(c: ChoiceCtx, pts: readonly number[]): Selector | undefined {
  const options = [...sideOptions(c, pts), ...arcOptions(c, pts)];
  if (options.length === 0) return undefined;
  const base: Values = c.values.values;
  const responses = localResponses(c.doc, base, c.registry, c.ctx);
  const scored = options
    .map((o) => ({ s: o.s, score: firmness(base, responses, o.q) }))
    .filter((o) => o.score >= ROBUST_SIGMAS)
    .sort((a, b) => b.score - a.score);
  return scored.find((o) => picks(c, o.s))?.s;
}

function tier3(c: ChoiceCtx): Selector | undefined {
  for (const kind of ['along', 'orient'] as const)
    for (const sign of [1, -1] as const) {
      const s: Selector = { kind, sign };
      if (picks(c, s)) return s;
    }
  return undefined;
}

function tier4(c: ChoiceCtx, pts: readonly number[]): Selector | undefined {
  const x1 = c.cands[c.clicked];
  if (x1 === undefined) return undefined;
  for (const id of pts) {
    const p = at(c, id);
    const s: Selector = { kind: 'near', p: ref(id) };
    if (p !== undefined && pointsCoincide(p, x1, c.ctx) && picks(c, s)) return s;
  }
  return undefined;
}

/** The candidate a click means: the nearest one (to the point, or for tangent_from the line). */
function clickedIndex(cands: readonly V[], click: V, from: V | undefined): number {
  const dist = (t: V) =>
    from === undefined
      ? Math.hypot(t.x - click.x, t.y - click.y)
      : Math.abs(side(from, { x: t.x - from.x, y: t.y - from.y }, click));
  const [a, b] = cands;
  return a !== undefined && b !== undefined && dist(b) < dist(a) ? 1 : 0;
}

/**
 * The selectors for the candidate of `tool`(args) nearest to `click` (world), or why none.
 * `argIds` are the object ids of the call's arguments (curves, or P and c for tangent_from);
 * the tool is a branchable registry tool (intersect, tangent_from, or a test's extension).
 */
export function chooseSelectors(
  doc: Document,
  values: Evaluation<number>,
  registry: Registry,
  tool: string,
  argIds: readonly number[],
  click: V,
): Choice {
  const ec = evalContextFor(doc);
  if (!ec.ok) return { ok: false, reason: ec.reason };
  const decider = tool === 'tangent_from' ? 'tangent_point' : tool;
  const spec = registry.get(decider);
  const args = argIds.map((id) => values.values.get(id));
  const vals = args.filter((a): a is Value<number> => a !== undefined);
  if (spec?.candidates === undefined || vals.length !== argIds.length)
    return { ok: false, reason: `${tool} has nothing to choose from` };
  const cands = spec
    .candidates(FloatField, vals, ec.ctx)
    .flatMap((v) => (v.kind === 'point' ? [{ x: v.x, y: v.y }] : []));
  if (cands.length === 0)
    return { ok: false, reason: 'there is no candidate to choose: the curves do not meet' };
  const from = tool === 'tangent_from' && vals[0]?.kind === 'point' ? vals[0] : undefined;
  const clicked = clickedIndex(cands, click, from);
  const c: ChoiceCtx = {
    doc,
    values,
    registry,
    ctx: ec.ctx,
    tool: decider,
    argIds,
    args: vals,
    cands,
    clicked,
  };
  const pts = pointIds(c);
  const t1 = tier1(c, pts);
  if (t1 !== undefined) return { ok: true, selectors: [t1], tier: 1 };
  const t2 = tier2(c, pts);
  if (t2 !== undefined) return { ok: true, selectors: [t2], tier: 2 };
  const t3 = tier3(c);
  if (t3 !== undefined) return { ok: true, selectors: [t3], tier: 3 };
  const t4 = tier4(c, pts);
  if (t4 !== undefined) return { ok: true, selectors: [t4], tier: 4 };
  return {
    ok: false,
    reason: 'no selector singles out this candidate (it is within the band of the other)',
  };
}
