/**
 * The text format's checks on what an edit writes (SPEC §12 with the quality bar "every UI
 * state is expressible in the text format", law L5). The kernel stores any expression and
 * any style; the language refuses some of them. The editor refuses the same, with the
 * owners' own checks (ADR-0009 decision 15):
 *   - a call no overload takes (the registry's rejection, decided on static kinds), an
 *     unknown tool, and the kernel's selector checks (bare index, missing or misapplied
 *     selectors: callDiagnostics);
 *   - a string literal anywhere but as a whole call argument (ADR-0011: the grammar);
 *   - a redefinition after which something built from the object (or a claim or an
 *     assumption on it) is such a call: a redefinition can change an object's kind;
 *   - style values outside the attribute ranges (finite widths ≥ 0, finite z and label
 *     angle, finite label distance ≥ 0).
 */
import type { Document, Style } from '@geomira/kernel/document';
import { exprKinds, objectKinds } from '@geomira/kernel/derived';
import { refsOf, selectorExprs, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { rejection, type Registry } from '@geomira/kernel/registry';
import { callDiagnostics, staticKinds } from '@geomira/kernel/selector-check';
import { formatExpr } from '@geomira/kernel/selector';
import type { ValueKind } from '@geomira/kernel/value';

/** Every call of an expression, outermost first (selector expressions included). */
function calls(e: Expr): CallExpr[] {
  if (e.kind !== 'call') return [];
  const inner = [...e.args, ...e.selectors.flatMap(selectorExprs)];
  return [e, ...inner.flatMap(calls)];
}

/** A string literal that is not a whole argument of a call. */
function misplacedString(e: Expr, asArgument: boolean): boolean {
  if (e.kind === 'str') return !asArgument;
  if (e.kind !== 'call') return false;
  return (
    e.args.some((a) => misplacedString(a, true)) ||
    e.selectors.some((s) => selectorExprs(s).some((a) => misplacedString(a, false)))
  );
}

/** The checks of definitions in one document (its kind tables built once). */
function checker(doc: Document, registry: Registry): (def: Expr) => string | undefined {
  const stat = new Map<number, readonly ValueKind[] | undefined>();
  for (const o of doc.objects)
    stat.set(
      o.id,
      staticKinds(o.def, (id) => stat.get(id), registry),
    );
  const table = objectKinds(doc, registry);
  const show = (x: Expr) => formatExpr(x, (id) => doc.objects.find((o) => o.id === id)?.name);
  return (def) => {
    if (misplacedString(def, false))
      return 'a string is only an argument of a call, as in text(P, "…")';
    for (const c of calls(def)) {
      const tool = registry.get(c.tool);
      if (tool === undefined) return `unknown tool "${c.tool}"`;
      const d = callDiagnostics(c, (id) => stat.get(id), registry, show)[0];
      if (d !== undefined) return d.message;
      const kinds = c.args.map((a) => exprKinds(a, table, registry));
      if (kinds.every((k) => k !== undefined) && exprKinds(c, table, registry) === undefined)
        return rejection(
          tool,
          kinds.map((k) => ({ kind: k.join(' | ') })),
        );
    }
    return undefined;
  };
}

/** Why the language would refuse `def` in `doc`, or undefined when it accepts it. */
export function definitionProblem(
  doc: Document,
  def: Expr,
  registry: Registry,
): string | undefined {
  return checker(doc, registry)(def);
}

/**
 * Why the language would refuse, in `doc`, a definition that depends on `ids` (the objects
 * an edit redefined), directly or transitively, or a claim or assumption that refers to
 * one: a redefinition can change an object's kind, and what was built from it may then be
 * a call no overload takes. Undefined when the text holds them all.
 */
export function dependentsProblem(
  doc: Document,
  ids: readonly number[],
  registry: Registry,
): string | undefined {
  const hit = new Set(ids);
  for (const o of doc.objects) if (refsOf(o.def).some((id) => hit.has(id))) hit.add(o.id);
  const check = checker(doc, registry);
  const objects = doc.objects.filter((o) => hit.has(o.id) && !ids.includes(o.id));
  for (const o of objects) {
    const p = check(o.def);
    if (p !== undefined) return `${o.name} would no longer be valid: ${p}`;
  }
  const conditions = [...doc.claims, ...doc.assumptions];
  for (const c of conditions) {
    if (!c.args.some((a) => refsOf(a).some((id) => hit.has(id)))) continue;
    const p = c.args.map(check).find((x) => x !== undefined);
    if (p !== undefined) return `a ${c.kind} condition would no longer be valid: ${p}`;
  }
  return undefined;
}

function finite(x: number | undefined): boolean {
  return x === undefined || Number.isFinite(x);
}

/** Why the text format cannot hold a style, or undefined. */
export function styleProblem(s: Style): string | undefined {
  if (!finite(s.width) || (s.width ?? 0) < 0) return 'a width is a finite number ≥ 0';
  if (!finite(s.z) || !finite(s.labelAngle)) return 'z and the label angle are finite numbers';
  if (!finite(s.labelDist) || (s.labelDist ?? 0) < 0)
    return 'a label distance is a finite number ≥ 0';
  if (!finite(s.opacity) || (s.opacity ?? 0) < 0 || (s.opacity ?? 0) > 1)
    return 'an opacity is a number in [0, 1]';
  if (s.digits !== undefined && !(Number.isInteger(s.digits) && s.digits >= 0 && s.digits <= 10))
    return 'digits is a whole number from 0 to 10';
  return undefined;
}
