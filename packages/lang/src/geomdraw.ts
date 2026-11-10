/**
 * Geomdraw's notation in calls (ADR-0025), resolved while building, so the document and its
 * printed text hold only registry names and explicit arguments:
 * - other names for tools (`tangents` is tangent_from, `second_intersection` other, …);
 * - glued point names: `AB` is line(A, B), `ABC` circle(A, B, C), `ABCD…` polygon(…); as
 *   arguments of a call that takes no line, circle or polygon there but takes the points,
 *   they are spread into the points (`midpoint(AB)`, `circumcenter(ABC)`, `ratio(AB, CD)`).
 */
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import type { ClaimParam } from '@geomira/claims/kind';
import type { Registry } from '@geomira/kernel/registry';
import type { Signature } from '@geomira/kernel/tool';
import { hasCapability } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import type { ExprNode } from './ast';

/**
 * Geomdraw's names for registry tools. Each value is a registry tool and no key is one (a test
 * checks both); a key is accepted wherever its tool is, and printed as the tool.
 */
export const TOOL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  tangents: 'tangent_from',
  tangent_points: 'tangent_point',
  second_intersection: 'other',
  length: 'dist',
  distance: 'dist',
  slider: 'param',
  perpendicular: 'perp',
});

/** The registry name of a call's tool: itself, or the tool an alias stands for. */
export function toolName(name: string, registry: Registry): string {
  if (registry.get(name) !== undefined) return name;
  if (Object.hasOwn(TOOL_ALIASES, name)) return TOOL_ALIASES[name] ?? name;
  // British spelling (ADR-0061): circumcentre, incentre, ninepoint_centre, … read as the tool.
  const american = name.replace(/centre/gu, 'center');
  return american !== name && registry.get(american) !== undefined ? american : name;
}

type Call = Extract<ExprNode, { kind: 'call' }>;

function isRun(n: ExprNode): n is Call {
  return n.kind === 'call' && n.glued === true;
}

/** Whether a signature takes `n` arguments whose known kinds (undefined: any) it accepts. */
function takes(s: Signature, kinds: readonly (string | undefined)[]): boolean {
  if (kinds.length < s.params.length) return false;
  if (kinds.length > s.params.length && s.rest === undefined) return false;
  return kinds.every((k, i) => {
    const cap = s.params[i] ?? s.rest;
    return k === undefined || (cap !== undefined && hasCapability({ kind: k }, cap));
  });
}

/** How a call's glued runs are read: as written (lines, circles, polygons) or spread into points. */
export type RunReading = 'written' | 'spread';

/** The kind of a run of `n` names: line (2), circle (3), polygon (4 or more). */
function kindOfRun(n: number): string {
  return n === 2 ? 'line' : n === 3 ? 'circle' : 'polygon';
}

/**
 * How `tool` reads arguments of which some are runs (`runs[i]`: the number of names of
 * argument i when it is a run, else undefined): spread into their points when no signature
 * takes them as lines, circles or polygons but one takes the points; otherwise as written.
 * The kinds of the other arguments are not known here: any kind fits them. The printer of the
 * short notation (print-short.ts) asks the same question, so it writes a run only where it is
 * read back as what it stands for. Degenerate: an unknown tool or no run → 'written'.
 */
export function runReading(
  tool: string,
  runs: readonly (number | undefined)[],
  registry: Registry,
): RunReading {
  const spec = registry.get(tool);
  if (spec === undefined || runs.every((n) => n === undefined)) return 'written';
  const kinds = runs.map((n) => (n === undefined ? undefined : kindOfRun(n)));
  if (spec.signatures.some((s) => takes(s, kinds))) return 'written';
  const pointKinds = runs.flatMap((n) =>
    n === undefined ? [undefined] : Array.from({ length: n }, () => 'point'),
  );
  return spec.signatures.some((s) => takes(s, pointKinds)) ? 'spread' : 'written';
}

/**
 * The arguments of a call with its glued runs spread into their points when no signature
 * takes them as lines, circles or polygons but one takes the points; otherwise as written
 * (runReading).
 */
export function spreadRuns(
  tool: string,
  args: readonly ExprNode[],
  registry: Registry,
): readonly ExprNode[] {
  const runs = args.map((a) => (isRun(a) ? a.args.length : undefined));
  return runReading(tool, runs, registry) === 'spread'
    ? args.flatMap((a) => (isRun(a) ? a.args : [a]))
    : args;
}

/** Whether a claim parameter takes a value of kind `k` (number parameters take numbers). */
function claimTakes(p: ClaimParam, k: string): boolean {
  return p === 'curve'
    ? k === 'line' || k === 'circle'
    : p === k || (p === 'integer' && k === 'number') || (p === 'number' && k === 'number');
}

function claimFits(
  params: readonly ClaimParam[],
  rest: ClaimParam | undefined,
  kinds: readonly (string | undefined)[],
): boolean {
  if (kinds.length < params.length || (kinds.length > params.length && rest === undefined))
    return false;
  return kinds.every((k, i) => {
    const p = params[i] ?? rest;
    return k === undefined || (p !== undefined && claimTakes(p, k));
  });
}

/** Assumptions whose arguments are all points (their runs are spread). */
const POINT_ASSUMPTIONS: readonly string[] = Object.freeze(['acute', 'scalene', 'convex']);

/**
 * How a claim or an assumption reads arguments of which some are runs (`runs` as in
 * runReading): spread into points when the kind takes points there and not the run's line or
 * circle (`collinear(ABC)`, `ABCD cyclic`, `acute(ABC)`); 'polygon' for `inside(P, ABC)`.
 */
export function conditionReading(
  kind: string,
  runs: readonly (number | undefined)[],
): RunReading | 'polygon' {
  if (runs.every((n) => n === undefined)) return 'written';
  if (POINT_ASSUMPTIONS.includes(kind)) return 'spread';
  if (kind === 'inside') return 'polygon';
  const spec = CLAIM_KINDS.find((k) => k.name === kind);
  if (spec === undefined) return 'written';
  const kinds = runs.map((n) => (n === undefined ? undefined : kindOfRun(n)));
  if (claimFits(spec.params, spec.rest, kinds)) return 'written';
  const pointKinds = runs.flatMap((n) =>
    n === undefined ? [undefined] : Array.from({ length: n }, () => 'point'),
  );
  return claimFits(spec.params, spec.rest, pointKinds) ? 'spread' : 'written';
}

/**
 * The arguments of a claim or an assumption with glued runs read as the kind needs
 * (conditionReading): spread into points, a polygon in `inside(P, ABC)`, or as written.
 */
export function spreadCondition(kind: string, args: readonly ExprNode[]): readonly ExprNode[] {
  const reading = conditionReading(
    kind,
    args.map((a) => (isRun(a) ? a.args.length : undefined)),
  );
  switch (reading) {
    case 'spread':
      return args.flatMap((a) => (isRun(a) ? a.args : [a]));
    case 'polygon':
      return args.map((a) => (isRun(a) && a.args.length >= 3 ? { ...a, tool: 'polygon' } : a));
    case 'written':
      return args;
    default:
      return assertNever(reading, 'run reading');
  }
}
