/**
 * Branch sites and assignments (ADR-0036 decisions 1–3): the calls of a claim's construction
 * that choose between two candidates, the candidate each picks now, and a document in which
 * every site picks a given candidate, its selectors written by the host's GUI choice (the
 * editor's `chooseSelectors`, reflection-equivariant first: law L16) or, without one, by the
 * low-level selector the kernel confirms.
 */
import { FloatField } from '@geomira/num/float-field';
import { bandThreshold } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import { MAIN_LAYER_ID, type DocObject, type Document } from '@geomira/kernel/document';
import { sameConstruction } from '@geomira/kernel/construction-key';
import { evaluate, type Evaluation } from '@geomira/kernel/evaluate';
import { exprEquals, refsOf, type CallExpr, type Expr, type Selector } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Line, Value, Vec } from '@geomira/kernel/value';
import { isOrientationDependent, selectorClass } from '@geomira/kernel/selector';
import { callsOf, exprAt, replaceAt } from '@geomira/claims/expr-path';
import { closureIds } from './solve';
import type { Chooser } from './types';

/** A branchable call of the construction. */
export interface Site {
  readonly object: number;
  readonly path: readonly number[];
  /** Its candidate (0 or 1) in the current figure, or −1 when it is undefined now. */
  readonly current: number;
  /** The value it has now (a point, or the tangent line), for "keep the same candidate". */
  readonly was: Vec<number> | undefined;
}

/** The values of free-standing expressions, through hidden temporary objects. */
function valuesOf(
  doc: Document,
  registry: Registry,
  ctx: EvalContext,
  exprs: readonly Expr[],
): (Value<number> | undefined)[] {
  const temp: DocObject[] = exprs.map((def, i) => ({
    id: doc.nextId + i,
    name: `#site${String(i)}`,
    def,
    style: { hidden: true },
    layers: [MAIN_LAYER_ID],
  }));
  const ev = evaluate(
    { ...doc, nextId: doc.nextId + exprs.length, objects: [...doc.objects, ...temp] },
    registry,
    FloatField,
    ctx,
  );
  return temp.map((t) => ev.values.get(t.id));
}

interface Shape {
  readonly cands: Vec<number>[];
  readonly args: Value<number>[];
  readonly value: Value<number> | undefined;
}

/** The two candidates of a call in `doc`, its arguments' values and its value, if a site. */
export function shapeOf(
  doc: Document,
  registry: Registry,
  ctx: EvalContext,
  call: CallExpr,
): Shape | undefined {
  const spec = registry.get(call.tool);
  if (spec?.candidates === undefined) return undefined;
  const vals = valuesOf(doc, registry, ctx, [...call.args, call]);
  const args = vals.slice(0, call.args.length);
  if (
    !args.every(
      (v): v is Value<number> => v !== undefined && v.kind !== 'undefined' && v.kind !== 'inexact',
    )
  )
    return undefined;
  const r = registry.resolve(call.tool, args);
  if (!r.ok || r.signature.branch?.candidates !== 2) return undefined;
  const cands = spec
    .candidates(FloatField, args, ctx)
    .flatMap((v) => (v.kind === 'point' ? [{ x: v.x, y: v.y }] : []));
  return cands.length === 2 ? { cands, args, value: vals[call.args.length] } : undefined;
}

/** How far candidate `c` is from a value: from a point, or from a line (a tangent's touch point). */
function gap(c: Vec<number>, v: Value<number> | undefined): number {
  if (v?.kind === 'point') return Math.hypot(v.x - c.x, v.y - c.y);
  if (v?.kind === 'line')
    return Math.abs((c.x - v.p.x) * v.d.y - (c.y - v.p.y) * v.d.x) / Math.hypot(v.d.x, v.d.y);
  return Infinity;
}

/** The index of the candidate nearest a value, or −1. */
export function nearestTo(
  cands: readonly Vec<number>[],
  v: Value<number> | Vec<number> | undefined,
): number {
  const val: Value<number> | undefined =
    v === undefined ? undefined : 'kind' in v ? v : { kind: 'point', x: v.x, y: v.y };
  const [a, b] = cands.map((c) => gap(c, val));
  if (a === undefined || b === undefined || !Number.isFinite(Math.min(a, b))) return -1;
  return a <= b ? 0 : 1;
}

/** The branch sites of the claim's construction, in construction order. */
export function sitesOf(doc: Document, registry: Registry, claimArgs: readonly Expr[]): Site[] {
  const c = evalContextFor(doc);
  if (!c.ok) return [];
  const keep = closureIds(doc, claimArgs.flatMap(refsOf));
  const out: Site[] = [];
  for (const o of doc.objects) {
    if (!keep.has(o.id) || o.managedBy !== undefined) continue;
    for (const { call, path } of callsOf(o.def)) {
      const s = shapeOf(doc, registry, c.ctx, call);
      if (s === undefined) continue;
      const current = nearestTo(s.cands, s.value);
      out.push({ object: o.id, path, current, was: current < 0 ? undefined : s.cands[current] });
    }
  }
  return out;
}

/** Every low-level selector that the kernel confirms picks `target`, along before orient. */
function lowLevel(
  registry: Registry,
  call: CallExpr,
  s: Shape,
  target: Vec<number>,
  ctx: EvalContext,
): Selector[][] {
  const spec = registry.get(call.tool);
  if (spec === undefined) return [];
  const band = bandThreshold('length', ctx);
  const out: Selector[][] = [];
  for (const kind of ['along', 'orient'] as const)
    for (const sign of [1, -1] as const) {
      const sel: Selector = { kind, sign };
      const v = spec.compute(FloatField, s.args, ctx, [
        { selector: sel, args: [], text: `${kind}(${sign > 0 ? '+' : '-'})` },
      ]);
      if (gap(target, v) <= band) out.push([sel]);
    }
  return out;
}

/**
 * Whether a kept site's own selectors still pick its candidate and are firm: filters, other(P)
 * and low-level selectors that do not depend on the orientation (SPEC §7) are left as written;
 * near / far_from (a distance ranking, which a small motion can tie) and orientation-dependent
 * ones are rewritten by the GUI choice.
 */
function keeps(call: CallExpr, s: Shape, target: Vec<number>, ctx: EvalContext): boolean {
  if (gap(target, s.value) > bandThreshold('length', ctx)) return false;
  const line = s.args.find((a): a is Line<number> => a.kind === 'line') ?? null;
  return call.selectors.every(
    (x) =>
      !isOrientationDependent(x, line) &&
      (selectorClass(x.kind) !== 'ranker' || x.kind === 'other'),
  );
}

/**
 * The selector lists that may make site `site`'s call pick `target` in `doc`, in preference
 * order: the host's GUI choice first (when the call's arguments are objects), then every
 * low-level selector the kernel confirms. writeSite checks each before it is written.
 */
function selectorOptions(
  doc: Document,
  registry: Registry,
  ctx: EvalContext,
  site: Site,
  call: CallExpr,
  s: Shape,
  target: Vec<number>,
  choose: Chooser | undefined,
): Selector[][] {
  const out: Selector[][] = [];
  const ids = call.args.map((a) => (a.kind === 'ref' ? a.id : -1));
  if (choose !== undefined && ids.every((id) => id >= 0)) {
    // A selector may name only objects defined before the call's object (invariant I2): the
    // chooser sees the document up to it, as the GUI sees it when the object is built.
    const at = doc.objects.findIndex((o) => o.id === site.object);
    const before: Document = { ...doc, objects: doc.objects.slice(0, Math.max(0, at)) };
    const values: Evaluation<number> = evaluate(before, registry, FloatField, ctx);
    const r = choose(before, values, registry, call.tool, ids, target);
    if (r.ok) out.push([...r.selectors]);
  }
  return [...out, ...lowLevel(registry, call, s, target, ctx)];
}

interface SiteWrite {
  readonly doc: Document;
  readonly registry: Registry;
  readonly ctx: EvalContext;
  readonly object: DocObject;
  readonly site: Site;
  readonly call: CallExpr;
  readonly target: Vec<number>;
}

/**
 * The document with the site's call rewritten by the first option the kernel confirms picks
 * the target (ADR-0036 decision 3: every written selector is verified), in this preference:
 * (1) an option that does not make the definition the same construction as another object (the
 * editor refuses such an edit); (2) the call's own selectors, when they still pick the target,
 * nothing better exists and they are not a ranker (near / far_from: what made the claim MIXED);
 * (3) an option that repeats another object (the assignment still makes the claim hold; the fix
 * reports the repeat, ADR-0036 decision 7).
 * Undefined when no option picks the target.
 */
function writeSite(w: SiteWrite, options: readonly Selector[][]): Document | undefined {
  const band = bandThreshold('length', w.ctx);
  const picks = (d: Document, call: CallExpr) =>
    gap(w.target, shapeOf(d, w.registry, w.ctx, call)?.value) <= band;
  let repeating: Document | undefined;
  for (const selectors of options) {
    const next: CallExpr = { ...w.call, selectors };
    if (exprEquals(next, w.call)) continue;
    const def = replaceAt(w.object.def, w.site.path, () => next);
    const d = {
      ...w.doc,
      objects: w.doc.objects.map((x) => (x.id === w.object.id ? { ...x, def } : x)),
    };
    if (!picks(d, next)) continue;
    if (sameConstruction(d, def, w.registry, { except: w.object.id }) === undefined) return d;
    repeating ??= d;
  }
  // A ranker (near, far_from) is what made the claim MIXED: never kept as the fix.
  const ranked = w.call.selectors.some(
    (x) => selectorClass(x.kind) === 'ranker' && x.kind !== 'other',
  );
  if (repeating === undefined || !ranked) return picks(w.doc, w.call) ? w.doc : repeating;
  return repeating;
}

/** The rewritten objects of `doc` that are the same construction as another object. */
export function repeatsIn(
  before: Document,
  doc: Document,
  registry: Registry,
): { readonly object: number; readonly of: number }[] {
  return doc.objects.flatMap((o) => {
    const old = before.objects.find((x) => x.id === o.id);
    if (old === undefined || exprEquals(old.def, o.def)) return [];
    const same = sameConstruction(doc, o.def, registry, { except: o.id });
    return same === undefined ? [] : [{ object: o.id, of: same.id }];
  });
}

/**
 * The document in which every site picks the candidate `picks[i]` says (true: the other one
 * than now), sites rewritten in construction order, or undefined when a site has no selector.
 */
export function assign(
  doc: Document,
  registry: Registry,
  sites: readonly Site[],
  flips: readonly boolean[],
  choose: Chooser | undefined,
): Document | undefined {
  const c = evalContextFor(doc);
  if (!c.ok) return undefined;
  let d = doc;
  for (const [i, site] of sites.entries()) {
    const o = d.objects.find((x) => x.id === site.object);
    const call = o === undefined ? undefined : exprAt(o.def, site.path);
    if (o === undefined || call?.kind !== 'call') return undefined;
    const s = shapeOf(d, registry, c.ctx, call);
    if (s === undefined) return undefined;
    const keepIndex = site.was === undefined ? 0 : nearestTo(s.cands, site.was);
    const index = flips[i] === true ? 1 - Math.max(0, keepIndex) : Math.max(0, keepIndex);
    const target = s.cands[index];
    if (target === undefined) return undefined;
    if (flips[i] !== true && keeps(call, s, target, c.ctx)) continue;
    const options = selectorOptions(d, registry, c.ctx, site, call, s, target, choose);
    const written = writeSite(
      { doc: d, registry, ctx: c.ctx, object: o, site, call, target },
      options,
    );
    if (written === undefined) return undefined;
    d = written;
  }
  return d;
}

/** Whether two documents have the same definitions (an assignment that rewrote nothing). */
export function sameDefinitions(a: Document, b: Document): boolean {
  return (
    a.objects.length === b.objects.length &&
    a.objects.every((o, i) => {
      const p = b.objects[i];
      return p !== undefined && p.id === o.id && exprEquals(p.def, o.def);
    })
  );
}
