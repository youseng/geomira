/**
 * The two branches of `X, Y = call(…)` (ADR-0025): which low-level selector tells them apart,
 * decided from the STATIC kinds of the call's arguments (the text cannot evaluate the figure).
 * The builder reads the statement with it and the short notation's printer (print-short.ts)
 * writes the statement only where the builder reads it back, so both ask here.
 */
import type { CallExpr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { staticKinds, type KindsOfRef } from '@geomira/kernel/selector-check';
import type { BranchShape } from '@geomira/kernel/tool';
import type { ValueKind } from '@geomira/kernel/value';

/**
 * The branch shapes of a call for every combination of its arguments' static kinds.
 * Degenerate: an argument of unknown kind → undefined; no branchable overload → [].
 */
export function branchShapes(
  c: CallExpr,
  kindsOfRef: KindsOfRef,
  registry: Registry,
): BranchShape[] | undefined {
  let combos: ValueKind[][] = [[]];
  for (const a of c.args) {
    const ks = staticKinds(a, kindsOfRef, registry);
    if (ks === undefined) return undefined;
    combos = combos.flatMap((k) => ks.map((x) => [...k, x]));
  }
  const shapes: BranchShape[] = [];
  for (const kinds of combos) {
    const r = registry.resolve(
      c.tool,
      kinds.map((kind) => ({ kind })),
    );
    if (r.ok && r.signature.branch !== undefined) shapes.push(r.signature.branch);
  }
  return shapes;
}

/**
 * The one low-level selector (`along` or `orient`) that tells the two candidates of the call
 * apart whatever its arguments' kinds, or undefined: unknown kinds, not exactly two
 * candidates everywhere, or no single such selector.
 */
export function branchLow(
  c: CallExpr,
  kindsOfRef: KindsOfRef,
  registry: Registry,
): 'along' | 'orient' | undefined {
  const shapes = branchShapes(c, kindsOfRef, registry);
  if (shapes === undefined || shapes.length === 0) return undefined;
  if (shapes.some((s) => s.candidates !== 2)) return undefined;
  const lows = [...new Set(shapes.map((s) => s.low))];
  const [low] = lows;
  return lows.length === 1 && low !== undefined && low !== 'none' ? low : undefined;
}
