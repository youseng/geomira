/**
 * Static kinds of a call (internal): which overloads a call's argument kinds can match, and
 * the kinds the result can then have. Shared by the selector checks (selector-check.ts
 * `staticKinds`) and the derived layers (derived.ts `exprKinds`), so both narrow a call to
 * the overloads its arguments can resolve to (ADR-0007 decisions 4 and 8): reflect(l) is a
 * transform, reflect(A, l) a point, and an image keeps its figure's kinds (Signature
 * `preserves`): reflect(l, k), apply(T, l) and a managed image l* are lines, never circles.
 */
import type { Signature, ToolSpec } from './tool';
import { capabilityKinds, type ValueKind } from './value';

/** The kinds of each argument (undefined: unknown, which may be anything). */
export type ArgKinds = readonly (readonly ValueKind[] | undefined)[];

/** Whether a signature takes these arguments, given the kinds each may have. */
export function fits(s: Signature, args: ArgKinds): boolean {
  if (args.length < s.params.length || (args.length > s.params.length && s.rest === undefined))
    return false;
  return args.every((k, i) => {
    const cap = s.params[i] ?? s.rest;
    return (
      cap !== undefined && (k === undefined || k.some((x) => capabilityKinds(cap).includes(x)))
    );
  });
}

/**
 * The kinds of an overload's result: the kinds of the preserved argument that its parameter
 * takes (an unknown argument: every kind of the parameter), else `output`, else the tool's
 * outputKinds.
 */
function overloadKinds(tool: ToolSpec, s: Signature, args: ArgKinds): readonly ValueKind[] {
  const cap = s.preserves === undefined ? undefined : s.params[s.preserves];
  if (s.preserves === undefined || cap === undefined) return s.output ?? tool.outputKinds;
  const taken = capabilityKinds(cap);
  const arg = args[s.preserves];
  return arg === undefined ? taken : taken.filter((k) => arg.includes(k));
}

/**
 * The kinds a call of `tool` on arguments of these kinds can have: the union over the
 * overloads the arguments can match, or undefined when none can.
 */
export function callKinds(tool: ToolSpec, args: ArgKinds): readonly ValueKind[] | undefined {
  const sigs = tool.signatures.filter((s) => fits(s, args));
  if (sigs.length === 0) return undefined;
  return [...new Set(sigs.flatMap((s) => overloadKinds(tool, s, args)))];
}
