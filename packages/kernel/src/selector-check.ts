/**
 * Parse-level checks of branch selection (SPEC §7; ADR-0006). SPEC §7 makes a bare index
 * (`intersect(a, b, 2)`) and a two-candidate call without selectors PARSE errors with a
 * hint; the language (a later run) reports these diagnostics at the line and column of
 * the call. They are decided STATICALLY, from the kinds an expression can have (a
 * literal is a number, a call the kinds of the overloads its arguments can resolve to, a
 * reference its object's), so
 * a call that can have two candidates for some argument kinds (cline is a circle or a
 * line) needs a selector even when the current figure happens to give one.
 * Also reported: selectors on a tool that takes none, along(±) / orient(±) / other(P)
 * where no overload accepts them, other(P) twice. Evaluation gives each of these an
 * Undefined with the same meaning (select.ts, evaluate.ts), so a document built without
 * the parser is never silently wrong.
 */
import { assertNever } from '@geomira/num/assert';
import type { Document } from './document';
import type { CallExpr, Expr } from './expr';
import { selectorExprs } from './expr';
import type { Registry } from './registry';
import { callKinds } from './kinds';
import { formatExpr } from './selector';
import type { BranchShape, ToolSpec } from './tool';
import type { ValueKind } from './value';

export interface SelectorDiagnostic {
  /** The object whose definition has the problem (document checks only). */
  readonly id?: number;
  readonly message: string;
  readonly hint: string;
}

/** The kinds the object `id` can have, or undefined when unknown. */
export type KindsOfRef = (id: number) => readonly ValueKind[] | undefined;

/**
 * The kinds an expression can have, or undefined when unknown (an unknown tool). A call has
 * the kinds of the overloads its arguments can resolve to (kinds.ts: reflect(l, k) and
 * apply(T, l) are lines), or its tool's outputKinds when no overload takes them.
 */
export function staticKinds(
  e: Expr,
  kindsOfRef: KindsOfRef,
  registry: Registry,
): readonly ValueKind[] | undefined {
  switch (e.kind) {
    case 'lit':
      return ['number'];
    case 'str':
      return ['string'];
    case 'ref':
      return kindsOfRef(e.id);
    case 'call': {
      const tool = registry.get(e.tool);
      if (tool === undefined) return undefined;
      const args = e.args.map((a) => staticKinds(a, kindsOfRef, registry));
      return callKinds(tool, args) ?? tool.outputKinds;
    }
    default:
      return assertNever(e, 'expression');
  }
}

function choosers(registry: Registry): string {
  return registry.tools
    .filter((t) => t.candidates !== undefined)
    .map((t) => t.name)
    .join(', ');
}

function lowHint(shapes: readonly BranchShape[]): string {
  const lows = [...new Set(shapes.map((s) => s.low).filter((l) => l !== 'none'))];
  return lows.map((l) => ` or ${l}(±)`).join('');
}

/** The message and hint of a bare index on a branchable tool. */
export function bareIndexMessage(tool: string, shapes: readonly BranchShape[]): string {
  return (
    `bare index: ${tool}(…, n) does not select a candidate (candidates have no fixed ` +
    `order); use a selector, e.g. other(P), near(P), same_side(Q, l)${lowHint(shapes)}`
  );
}

/** Every combination of the possible kinds of the arguments (undefined: some unknown). */
function combinations(
  args: readonly Expr[],
  kindsOfRef: KindsOfRef,
  registry: Registry,
): ValueKind[][] | undefined {
  let out: ValueKind[][] = [[]];
  for (const a of args) {
    const ks = staticKinds(a, kindsOfRef, registry);
    if (ks === undefined) return undefined;
    out = out.flatMap((c) => ks.map((k) => [...c, k]));
  }
  return out;
}

/** The branch shapes of the overloads the argument kinds can resolve to. */
function shapesOf(
  tool: ToolSpec,
  combos: readonly ValueKind[][],
  registry: Registry,
): BranchShape[] {
  const shapes: BranchShape[] = [];
  for (const kinds of combos) {
    const r = registry.resolve(
      tool.name,
      kinds.map((kind) => ({ kind })),
    );
    if (r.ok && r.signature.branch !== undefined) shapes.push(r.signature.branch);
  }
  return shapes;
}

/**
 * The runtime form of the bare-index check (evaluate.ts): a branchable tool whose last
 * argument is a number and whose other arguments resolve.
 */
export function bareIndexProblem(
  e: CallExpr,
  args: readonly { readonly kind: string }[],
  registry: Registry,
): string | undefined {
  const tool = registry.get(e.tool);
  if (tool?.candidates === undefined || args[args.length - 1]?.kind !== 'number') return undefined;
  const r = registry.resolve(e.tool, args.slice(0, -1));
  return r.ok && r.signature.branch !== undefined
    ? bareIndexMessage(e.tool, [r.signature.branch])
    : undefined;
}

function diag(message: string, hint: string): SelectorDiagnostic {
  return { message, hint };
}

/**
 * The checks of a branchable call whose argument kinds are known. `show` gives the call's
 * text, formatted only when a diagnostic is reported (formatting every nested call eagerly
 * made the language's checks cubic in the nesting depth, Run 10 audit).
 */
function branchChecks(
  e: CallExpr,
  show: () => string,
  shapes: readonly BranchShape[],
): SelectorDiagnostic[] {
  const out: SelectorDiagnostic[] = [];
  const kinds = e.selectors.map((s) => s.kind);
  if (shapes.some((s) => s.candidates === 2) && kinds.length === 0) {
    const two = shapes.filter((s) => s.candidates === 2).map((s) => s.describe);
    out.push(
      diag(
        `${show()}: ${[...new Set(two)].join(' or ')} can have two candidates and the call has no selector`,
        `add a selector, e.g. other(P), near(P), same_side(Q, l)${lowHint(shapes)}`,
      ),
    );
  }
  for (const low of ['along', 'orient'] as const) {
    if (kinds.includes(low) && !shapes.some((s) => s.low === low)) {
      const use = lowHint(shapes);
      out.push(
        diag(
          `${show()}: ${low}(±) does not apply to ${[...new Set(shapes.map((s) => s.describe))].join(' or ')}`,
          use === '' ? `remove ${low}(±)` : `use${use.slice(3)} instead`,
        ),
      );
    }
  }
  if (kinds.includes('other') && !shapes.some((s) => s.other)) {
    out.push(
      diag(`${show()}: other(P) does not apply: the objects meet only once`, 'remove other(P)'),
    );
  }
  if (kinds.filter((k) => k === 'other').length > 1) {
    out.push(diag(`${show()}: other(·) appears more than once`, 'keep one other(P)'));
  }
  return out;
}

/** The diagnostics of one call (not of its nested calls). */
function checkCall(
  e: CallExpr,
  kindsOfRef: KindsOfRef,
  registry: Registry,
  show: (x: Expr) => string,
): SelectorDiagnostic[] {
  const tool = registry.get(e.tool);
  if (tool === undefined) return [];
  const text = () => show(e);
  if (tool.candidates === undefined) {
    return e.selectors.length === 0
      ? []
      : [
          diag(
            `${text()}: ${e.tool} takes no selectors`,
            `remove the selectors: only ${choosers(registry)} choose among candidates`,
          ),
        ];
  }
  const combos = combinations(e.args, kindsOfRef, registry);
  if (combos === undefined) return [];
  const shapes = shapesOf(tool, combos, registry);
  if (shapes.length > 0) return branchChecks(e, text, shapes);
  const index = combinations(e.args.slice(0, -1), kindsOfRef, registry);
  const last = e.args[e.args.length - 1];
  const lastKinds = last === undefined ? undefined : staticKinds(last, kindsOfRef, registry);
  const indexed = index === undefined ? [] : shapesOf(tool, index, registry);
  return lastKinds?.includes('number') === true && indexed.length > 0
    ? [diag(`${text()}: ${bareIndexMessage(e.tool, indexed)}`, 'replace the index by a selector')]
    : [];
}

/** The diagnostics of a call and of every call nested in it (arguments and selectors). */
export function callDiagnostics(
  e: CallExpr,
  kindsOfRef: KindsOfRef,
  registry: Registry,
  show: (x: Expr) => string,
): SelectorDiagnostic[] {
  const nested = [...e.args, ...e.selectors.flatMap((s) => selectorExprs(s))].flatMap((a) =>
    a.kind === 'call' ? callDiagnostics(a, kindsOfRef, registry, show) : [],
  );
  return [...checkCall(e, kindsOfRef, registry, show), ...nested];
}

/** The diagnostics of every definition of a document, in construction order. */
export function selectorDiagnostics(doc: Document, registry: Registry): SelectorDiagnostic[] {
  const kinds = new Map<number, readonly ValueKind[] | undefined>();
  const names = new Map(doc.objects.map((o) => [o.id, o.name]));
  const show = (x: Expr) => formatExpr(x, (id) => names.get(id));
  const out: SelectorDiagnostic[] = [];
  for (const o of doc.objects) {
    const kindsOfRef: KindsOfRef = (id) => kinds.get(id);
    if (o.def.kind === 'call') {
      for (const d of callDiagnostics(o.def, kindsOfRef, registry, show))
        out.push({ ...d, id: o.id });
    }
    kinds.set(o.id, staticKinds(o.def, kindsOfRef, registry));
  }
  return out;
}
