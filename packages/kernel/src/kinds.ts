/**
 * Static kinds of a call (internal): which overloads a call's argument kinds can match, and
 * the kinds the result can then have. Shared by the selector checks (selector-check.ts
 * `staticKinds`) and the derived layers (derived.ts `exprKinds`), so both narrow a call to
 * the overloads its arguments can resolve to (ADR-0007 decisions 4 and 8): reflect(l) is a
 * transform, reflect(A, l) a point, and an image keeps its figure's kinds (Signature
 * `preserves`): reflect(l, k), apply(T, l) and a managed image l* are lines, never circles,
 * unless the map may be a Möbius map (ADR-0032 decision 13): a transform whose kinds include
 * the static kind 'mobius' (the inversion tools' output; compose and inverse of one) images a
 * line or a circle as a line or a circle.
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

/** Whether an argument of a 'transform' parameter of `s` may be a Möbius map. */
function mobiusArg(s: Signature, args: ArgKinds): boolean {
  return args.some((k, i) => (s.params[i] ?? s.rest) === 'transform' && k?.includes('mobius'));
}

/** A line or a circle under a map that may be Möbius may be either (ADR-0032). */
function exchangeCurves(kinds: readonly ValueKind[]): readonly ValueKind[] {
  const curve = kinds.includes('line') || kinds.includes('circle');
  return curve ? [...new Set<ValueKind>([...kinds, 'line', 'circle'])] : kinds;
}

/**
 * The kinds of an overload's result: the kinds of the preserved argument that its parameter
 * takes (an unknown argument: every kind of the parameter), lines and circles exchanged under
 * a map that may be Möbius; else `output` (with 'mobius' added to a transform computed from
 * one), else the tool's outputKinds.
 */
function overloadKinds(tool: ToolSpec, s: Signature, args: ArgKinds): readonly ValueKind[] {
  const cap = s.preserves === undefined ? undefined : s.params[s.preserves];
  const mob = mobiusArg(s, args);
  if (s.preserves === undefined || cap === undefined) {
    const out = s.output ?? tool.outputKinds;
    return mob && out.includes('transform') && !out.includes('mobius') ? [...out, 'mobius'] : out;
  }
  const taken = capabilityKinds(cap);
  const arg = args[s.preserves];
  const kept = arg === undefined ? taken : taken.filter((k) => arg.includes(k));
  return mob ? exchangeCurves(kept) : kept;
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
