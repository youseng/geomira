/**
 * Preparing a FIGURE for sampling without a claim (internal; Randomize, Run 9b): the same
 * probes, free inputs and ordered glider groups as `prepare` builds for a claim, for the
 * document's hypotheses and gliders only.
 */
import { FloatField } from '@geomira/num/float-field';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import { findFree } from './free';
import { assumptionProblem } from './hypotheses';
import {
  freeKey,
  gliderExprs,
  hypothesesOf,
  orderedGroups,
  type PreparedHypothesis,
} from './prepare';
import { addProbes } from './probes';
import type { SamplerFigure } from './sampler';

export interface PreparedFigure extends SamplerFigure {
  readonly registry: Registry;
  readonly hypotheses: readonly PreparedHypothesis[];
}

export type FigurePrepResult =
  | { readonly ok: true; readonly figure: PreparedFigure }
  | { readonly ok: false; readonly reason: string };

/** Prepares `doc` for sampling (see the module comment), or the reason it cannot be sampled. */
export function prepareFigure(doc: Document, registry: Registry): FigurePrepResult {
  for (const a of doc.assumptions) {
    const why = assumptionProblem(a);
    if (why !== undefined) return { ok: false, reason: `assume ${a.kind}: ${why}` };
  }
  const c = evalContextFor(doc);
  if (!c.ok) return { ok: false, reason: c.reason };
  const hypExprs = doc.assumptions.flatMap((a) => a.args);
  const gliders = gliderExprs(doc);
  const probed = addProbes(doc, [...hypExprs, ...gliders.map((g) => g.expr)]);
  const ids = [...probed.ids];
  const hypProbes = ids.splice(0, hypExprs.length);
  const base = evaluate(probed.doc, registry, FloatField, c.ctx).values;
  const gliderObjects = new Map<string, Value<number>>();
  gliders.forEach((g, i) => {
    const v = base.get(ids[i] ?? -1);
    if (v !== undefined) gliderObjects.set(g.key, v);
  });
  const free = findFree(probed.doc, (id, path) => {
    const v = gliderObjects.get(freeKey(id, path));
    return v?.kind === 'line' || v?.kind === 'circle' ? v.kind : undefined;
  });
  return {
    ok: true,
    figure: {
      doc: probed.doc,
      registry,
      hypotheses: hypothesesOf(doc, hypProbes),
      free,
      ordered: orderedGroups(probed.doc, doc.assumptions, free),
      baseCtx: c.ctx,
      gliderObjects,
    },
  };
}
