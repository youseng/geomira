/**
 * Static analysis of a claim's CLOSURE (the objects its arguments depend on), decided from
 * the document alone, never by waiting for an Inexact (note A, SPEC §10.5, law L17):
 *   - mod-p eligibility: the kind is a POLYNOMIAL KIND, its own algebra needs no
 *     trigonometry, and no call of the closure has a sign-based selector (every selector
 *     but other(P)), a `radical` overload (Signature.radical: √ or trigonometry in the
 *     value, ADR-0008), or two candidates whose roots other(P) does not avoid;
 *   - the orientation sites: every along(±) and orient(±) of the closure, for the flip test
 *     of the global verdict (whether an along(±) is orientation-dependent is read from the
 *     chirality of its line in an evaluation, with the kernel's isOrientationDependent).
 */
import type { Rational } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import type { CallExpr } from '@geomira/kernel/expr';
import { exprKinds, objectKinds, type KindTable } from '@geomira/kernel/derived';
import type { Registry } from '@geomira/kernel/registry';
import { formatExpr, formatSelector } from '@geomira/kernel/selector';
import type { ValueKind } from '@geomira/kernel/value';
import { callsOf, type Path } from './expr-path';
import type { ClaimKindSpec } from './kind';

/** An along(±) or orient(±) selector of the closure. */
export interface OrientationSite {
  readonly objectId: number;
  readonly objectName: string;
  /** The path of the call inside the object's definition, and the selector's index. */
  readonly path: Path;
  readonly index: number;
  readonly selector: 'along' | 'orient';
  /** "orient(+)", for messages. */
  readonly text: string;
  /** The call as text: "intersect(circle(B, C), circle(C, B), orient(+))". */
  readonly callText: string;
}

export interface ClaimAnalysis {
  readonly polynomial: boolean;
  /** Why the mod-p rung is excluded (empty: eligible). */
  readonly modpExclusions: readonly string[];
  readonly sites: readonly OrientationSite[];
}

/** Every combination of the static kinds of the arguments (unknown → no combination). */
function kindTuples(e: CallExpr, kinds: KindTable, registry: Registry): ValueKind[][] {
  let tuples: ValueKind[][] = [[]];
  for (const a of e.args) {
    const ks = exprKinds(a, kinds, registry);
    if (ks === undefined) return [];
    tuples = tuples.flatMap((t) => ks.map((k) => [...t, k]));
  }
  return tuples;
}

/** Why a call keeps a closure off the mod-p rung, or undefined. */
function callExclusion(
  e: CallExpr,
  kinds: KindTable,
  registry: Registry,
  show: (c: CallExpr) => string,
): string | undefined {
  const signBased = e.selectors.find((s) => s.kind !== 'other');
  if (signBased !== undefined) {
    return `${show(e)} uses the sign-based selector ${formatSelector(signBased, () => '…')}`;
  }
  const hasOther = e.selectors.some((s) => s.kind === 'other');
  for (const tuple of kindTuples(e, kinds, registry)) {
    const r = registry.resolve(
      e.tool,
      tuple.map((kind) => ({ kind })),
    );
    if (!r.ok) continue;
    if (r.signature.radical === true) return `${show(e)} needs a square root or trigonometry`;
    if (r.signature.branch?.candidates === 2 && !hasOther)
      return `${show(e)} chooses between square-root candidates`;
  }
  return undefined;
}

/**
 * The analysis of a claim whose closure is `closure` (object ids of `doc`), with literal
 * arguments `lits`.
 */
export function analyzeClaim(
  doc: Document,
  registry: Registry,
  kind: ClaimKindSpec,
  lits: readonly Rational[],
  closure: ReadonlySet<number>,
): ClaimAnalysis {
  const names = new Map(doc.objects.map((o) => [o.id, o.name]));
  const show = (c: CallExpr) => formatExpr(c, (id) => names.get(id));
  const kinds = objectKinds(doc, registry);
  const exclusions: string[] = [];
  if (!kind.polynomial) exclusions.push(`${kind.name} is not a polynomial kind`);
  const trig = kind.needsTrig?.(lits);
  if (trig !== undefined) exclusions.push(trig);
  const sites: OrientationSite[] = [];
  for (const o of doc.objects) {
    if (!closure.has(o.id)) continue;
    for (const { call, path } of callsOf(o.def)) {
      const why = callExclusion(call, kinds, registry, show);
      if (why !== undefined) exclusions.push(`${o.name}: ${why}`);
      call.selectors.forEach((s, index) => {
        if (s.kind !== 'along' && s.kind !== 'orient') return;
        const text = formatSelector(s, () => '');
        sites.push({
          objectId: o.id,
          objectName: o.name,
          path,
          index,
          selector: s.kind,
          text,
          callText: show(call),
        });
      });
    }
  }
  return { polynomial: kind.polynomial, modpExclusions: exclusions, sites };
}
