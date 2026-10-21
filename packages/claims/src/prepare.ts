/**
 * Preparing a claim for evaluation (internal): the claim's kind and arguments are checked
 * statically, every expression the tester needs a value of becomes a probe, the closures
 * and the static analysis are computed, and the free inputs are found (gliders are
 * classified with a float evaluation of their objects in the current figure).
 */
import { FloatField } from '@geomira/num/float-field';
import type { Rational } from '@geomira/num/rational';
import { evalContextFor } from '@geomira/kernel/context';
import type { Assumption, Claim, Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { exprEquals, type Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { formatExpr } from '@geomira/kernel/selector';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value } from '@geomira/kernel/value';
import { analyzeClaim, type ClaimAnalysis, type OrientationSite } from './analysis';
import { callsOf, exprAt } from './expr-path';
import { findFree, type FreeInput } from './free';
import { assumptionProblem, comparisonDim, type MeasureDim } from './hypotheses';
import { argProblem } from './check';
import type { ClaimKindSpec } from './kind';
import { claimKind } from './kinds';
import { addProbes, closureOf } from './probes';

/** A claim argument: a probe object (geometry) or an exact literal. */
export type ArgRef = { readonly probe: number } | { readonly lit: Rational };

export interface PreparedHypothesis {
  readonly assumption: Assumption;
  readonly probes: readonly number[];
  readonly dim: MeasureDim;
}

/** The glider forms an in_order group can have (every glider: SPEC §10.4). */
export type OrderedForm = 'line-glider' | 'stereo' | 'angle-glider';

const ORDERED_FORMS: readonly string[] = ['line-glider', 'stereo', 'angle-glider'];

function isOrderedForm(kind: string): kind is OrderedForm {
  return ORDERED_FORMS.includes(kind);
}

/** Gliders of one object named by an in_order hypothesis: sampled with sorted parameters. */
export interface OrderedGroup {
  readonly form: OrderedForm;
  readonly inputs: readonly FreeInput[];
}

/** An orientation site with probes of its call's arguments (the line of an along(±)). */
export interface SiteProbe {
  readonly site: OrientationSite;
  readonly argProbes: readonly number[];
}

export interface Prepared {
  /** The user document plus probes. */
  readonly doc: Document;
  readonly registry: Registry;
  readonly claim: Claim;
  readonly kind: ClaimKindSpec;
  readonly args: readonly ArgRef[];
  readonly argText: readonly string[];
  readonly hypotheses: readonly PreparedHypothesis[];
  /** Objects the claim depends on (the exact rungs evaluate only these). */
  readonly claimClosure: ReadonlySet<number>;
  /** Objects the float run needs: the claim, the hypotheses and the orientation sites. */
  readonly floatKeep: ReadonlySet<number>;
  readonly analysis: ClaimAnalysis;
  readonly sites: readonly SiteProbe[];
  readonly free: readonly FreeInput[];
  readonly ordered: readonly OrderedGroup[];
  /** The current figure: its context and the float values of the glider objects. */
  readonly baseCtx: EvalContext;
  readonly gliderObjects: ReadonlyMap<string, Value<number>>;
}

export type PrepareResult =
  | { readonly ok: true; readonly prepared: Prepared }
  | { readonly ok: false; readonly reason: string };

export function freeKey(id: number, path: readonly number[]): string {
  return `${String(id)}:${path.join('.')}`;
}

/**
 * Probes of the object of every glider: on(obj, p) to read its kind (line or circle), and
 * both forms for the samplers' local steps (a line's |d|, a circle's radius).
 */
export function gliderExprs(doc: Document): { key: string; expr: Expr }[] {
  return doc.objects.flatMap((o) =>
    callsOf(o.def)
      .filter(
        ({ call }) => call.tool === 'on' && (call.args.length === 2 || call.args.length === 3),
      )
      .flatMap(({ call, path }) =>
        call.args[0] === undefined ? [] : [{ key: freeKey(o.id, path), expr: call.args[0] }],
      ),
  );
}

export function orderedGroups(
  doc: Document,
  hyps: readonly Assumption[],
  free: readonly FreeInput[],
): OrderedGroup[] {
  const out: OrderedGroup[] = [];
  for (const h of hyps) {
    if (h.kind !== 'in_order') continue;
    const pointsArgs = h.args.slice(0, -1);
    const inputs = pointsArgs.map((a) =>
      a.kind === 'ref'
        ? free.find((x) => x.id === a.id && x.path.length === 0 && isOrderedForm(x.kind))
        : undefined,
    );
    const objs = inputs.map((x) => {
      const o = x === undefined ? undefined : doc.objects.find((y) => y.id === x.id);
      return o === undefined ? undefined : exprAt(o.def, [0]);
    });
    const [first, firstObj] = [inputs[0], objs[0]];
    if (first === undefined || firstObj === undefined) continue;
    const same = inputs.every(
      (x, i) => x?.kind === first.kind && objs[i] !== undefined && exprEquals(objs[i], firstObj),
    );
    const distinct = new Set(inputs.map((x) => x?.id)).size === inputs.length;
    const form = first.kind;
    if (same && distinct && isOrderedForm(form)) {
      out.push({ form, inputs: inputs.filter((x): x is FreeInput => x !== undefined) });
    }
  }
  return out;
}

function siteArgExprs(doc: Document, site: OrientationSite): Expr[] {
  const o = doc.objects.find((x) => x.id === site.objectId);
  const call = o === undefined ? undefined : exprAt(o.def, site.path);
  return call?.kind === 'call' && site.selector === 'along' ? [...call.args] : [];
}

interface Checked {
  readonly claim: Claim;
  readonly kind: ClaimKindSpec;
  readonly ctx: EvalContext;
}

function check(doc: Document, claimId: number): Checked | string {
  const claim = doc.claims.find((c) => c.id === claimId);
  if (claim === undefined) return `there is no claim #${String(claimId)}`;
  const kind = claimKind(claim.kind);
  if (kind === undefined) return `unknown claim "${claim.kind}"`;
  const bad = argProblem(kind, claim.args);
  if (bad !== undefined) return bad;
  for (const a of doc.assumptions) {
    const why = assumptionProblem(a);
    if (why !== undefined) return `assume ${a.kind}: ${why}`;
  }
  const ctx = evalContextFor(doc);
  return ctx.ok ? { claim, kind, ctx: ctx.ctx } : ctx.reason;
}

interface Probing {
  readonly doc: Document;
  readonly claimProbes: readonly number[];
  readonly hypProbes: readonly number[];
  readonly gliders: readonly { readonly key: string; readonly probe: number }[];
  readonly claimClosure: ReadonlySet<number>;
  readonly analysis: ClaimAnalysis;
  readonly sites: readonly SiteProbe[];
}

/** Probes for the claim, the hypotheses, the glider objects, then the along(±) lines. */
function probe(doc: Document, c: Checked, registry: Registry): Probing {
  const geo = c.claim.args.filter((a) => a.kind !== 'lit');
  const hypExprs = doc.assumptions.flatMap((a) => a.args);
  const gliders = gliderExprs(doc);
  const first = addProbes(doc, [...geo, ...hypExprs, ...gliders.map((g) => g.expr)]);
  const ids = [...first.ids];
  const claimProbes = ids.splice(0, geo.length);
  const hypProbes = ids.splice(0, hypExprs.length);
  const claimClosure = closureOf(first.doc, claimProbes);
  const lits = c.claim.args.flatMap((a) => (a.kind === 'lit' ? [a.value] : []));
  const analysis = analyzeClaim(first.doc, registry, c.kind, lits, claimClosure);
  const siteExprs = analysis.sites.map((s) => siteArgExprs(first.doc, s));
  const second = addProbes(first.doc, siteExprs.flat());
  let k = 0;
  const sites = analysis.sites.map((site, i) => {
    const n = siteExprs[i]?.length ?? 0;
    k += n;
    return { site, argProbes: second.ids.slice(k - n, k) };
  });
  return {
    doc: second.doc,
    claimProbes,
    hypProbes,
    gliders: gliders.map((g, i) => ({ key: g.key, probe: ids[i] ?? -1 })),
    claimClosure,
    analysis,
    sites,
  };
}

export function hypothesesOf(doc: Document, hypProbes: readonly number[]): PreparedHypothesis[] {
  let h = 0;
  return doc.assumptions.map((a) => {
    const probes = hypProbes.slice(h, h + a.args.length);
    h += a.args.length;
    const d = comparisonDim(a.args);
    return { assumption: a, probes, dim: d.ok ? d.dim : 'number' };
  });
}

/** Prepares claim `claimId` of `doc` (see the module comment), or the reason it cannot be tested. */
export function prepare(doc: Document, claimId: number, registry: Registry): PrepareResult {
  const c = check(doc, claimId);
  if (typeof c === 'string') return { ok: false, reason: c };
  const p = probe(doc, c, registry);
  const base = evaluate(p.doc, registry, FloatField, c.ctx).values;
  const gliderObjects = new Map<string, Value<number>>();
  for (const g of p.gliders) {
    const v = base.get(g.probe);
    if (v !== undefined) gliderObjects.set(g.key, v);
  }
  const free = findFree(p.doc, (id, path) => {
    const v = gliderObjects.get(freeKey(id, path));
    return v?.kind === 'line' || v?.kind === 'circle' ? v.kind : undefined;
  });
  const names = new Map(doc.objects.map((o) => [o.id, o.name]));
  let next = 0;
  const args: ArgRef[] = c.claim.args.map((a) =>
    a.kind === 'lit' ? { lit: a.value } : { probe: p.claimProbes[next++] ?? -1 },
  );
  const floatRoots = [...p.claimProbes, ...p.hypProbes, ...p.sites.flatMap((s) => s.argProbes)];
  return {
    ok: true,
    prepared: {
      doc: p.doc,
      registry,
      claim: c.claim,
      kind: c.kind,
      args,
      argText: c.claim.args.map((a) => formatExpr(a, (id) => names.get(id))),
      hypotheses: hypothesesOf(doc, p.hypProbes),
      claimClosure: p.claimClosure,
      floatKeep: closureOf(p.doc, floatRoots),
      analysis: p.analysis,
      sites: p.sites,
      free,
      ordered: orderedGroups(p.doc, doc.assumptions, free),
      baseCtx: c.ctx,
      gliderObjects,
    },
  };
}
