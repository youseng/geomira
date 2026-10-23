/**
 * The samplers' FRAME (ADR-0028): whether a figure may be moved by the random similarity of
 * SPEC §10.4 (scale, rotation, translation) and, in the global regime, mirrored. A sample
 * must never move one part of the figure relative to a part the map does not move, so the
 * question is decided statically, once per prepared document, from the expressions alone.
 *
 * The samplers map exactly the FREE inputs (free.ts): literal point(x, y), literal radii of
 * circle(O, r) and literal glider parameters of the user's objects. Every other number that
 * enters the construction keeps its value in a sample, so it must not have an absolute
 * meaning. The rule, per number argument of a call that does not itself give a number
 * (calls that give numbers, e.g. dist or mul, are judged where their result is used):
 *   - point(x, y): an absolute POSITION. Free → mapped; otherwise (computed coordinates, or
 *     any point(…) written in a claim or an assumption) → no similarity, no mirroring.
 *   - circle(O, r): an absolute LENGTH. Free → scaled; otherwise (a param, an expression, a
 *     radius written in a claim or an assumption) → no similarity (mirroring keeps lengths).
 *   - on(c, θ) on a circle: an absolute DIRECTION (degrees from the x-axis). Free → rotated
 *     (local) or redrawn (global); otherwise → no similarity, no mirroring.
 *   - on(c, u, v): relative to c's anchor, so a direct similarity maps it, but a mirror
 *     does not (X(u : v) turns the other way). Free → redrawn (global); otherwise → no
 *     mirroring; when the parameter depends on the figure (below) → no similarity either.
 *   - every other number argument (on(l, t), divide, rotate, homothety, marks) is RELATIVE
 *     (dimensionless, or an angle relative to the figure): safe when it is a PURE NUMBER
 *     (built from literals, params and arithmetic only, never from the figure); a number
 *     computed from the figure (e.g. dist(A, B)) may carry a length → no similarity.
 * And a comparison assumption that compares a length with a number (`assume AB < 4`) → no
 * similarity. Literal parameters of a claim (k, n, θ) are dimensionless (ADR-0008) and safe.
 * Conservative by construction: a figure the rule cannot show to be safe is sampled without
 * the similarity (noise only), which is never wrong, only less varied.
 */
import { assertNever } from '@geomira/num/assert';
import type { Assumption, Document } from '@geomira/kernel/document';
import { exprKinds, objectKinds, type KindTable } from '@geomira/kernel/derived';
import type { CallExpr, Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { formatExpr } from '@geomira/kernel/selector';
import type { ValueKind } from '@geomira/kernel/value';
import { callsOf, type Path } from './expr-path';
import { assumptionText } from './figure-hypotheses';
import { comparisonDim } from './hypotheses';
import { isProbe } from './probes';

/** What the samplers may do to a figure, and why not (the first reason of each). */
export interface SamplerFrame {
  /** The random similarity (scale, rotation, translation) maps every absolute quantity. */
  readonly similarity: boolean;
  /** Global samples may be mirrored. */
  readonly mirror: boolean;
  readonly noSimilarity?: string;
  readonly noMirror?: string;
}

/** The frame of a figure with nothing absolute in it. */
export const FULL_FRAME: SamplerFrame = Object.freeze({ similarity: true, mirror: true });

/** What to inspect: the user objects, and the claim and assumption expressions. */
export interface FrameScope {
  /** The prepared document (probes included: they are skipped). */
  readonly doc: Document;
  readonly registry: Registry;
  /** Which user objects matter (the evaluated closure); all when undefined. */
  readonly keep?: ReadonlySet<number>;
  /** Claim arguments to inspect (their nested calls are never free). */
  readonly claimExprs: readonly Expr[];
  readonly assumptions: readonly Assumption[];
  /** Whether the samplers map the free literals of the call at `path` in object `id`. */
  readonly mapped: (id: number, path: Path) => boolean;
}

interface Finding {
  readonly text: string;
  readonly similarity: boolean;
  readonly mirror: boolean;
}

interface Walk {
  readonly kinds: KindTable;
  readonly registry: Registry;
  readonly names: (id: number) => string | undefined;
  readonly defs: ReadonlyMap<number, Expr>;
  readonly mapped: (id: number, path: Path) => boolean;
  readonly pure: Map<number, boolean>;
}

type Role = 'position' | 'length' | 'direction' | 'anchored' | 'relative';

function numberOnly(ks: readonly ValueKind[] | undefined): boolean {
  return ks !== undefined && ks.length === 1 && ks[0] === 'number';
}

/** A number built from literals, params and arithmetic only (no geometry), memoised per object. */
function pureNumber(e: Expr, w: Walk, seen: ReadonlySet<number> = new Set()): boolean {
  switch (e.kind) {
    case 'lit':
      return true;
    case 'str':
      return false;
    case 'ref': {
      const known = w.pure.get(e.id);
      if (known !== undefined) return known;
      const def = w.defs.get(e.id);
      const ok =
        def !== undefined && !seen.has(e.id) && pureNumber(def, w, new Set([...seen, e.id]));
      w.pure.set(e.id, ok);
      return ok;
    }
    case 'call':
      return (
        e.selectors.length === 0 &&
        numberOnly(exprKinds(e, w.kinds, w.registry)) &&
        e.args.every((a) => pureNumber(a, w, seen))
      );
    default:
      return assertNever(e, 'expression');
  }
}

function roleOf(call: CallExpr, i: number, w: Walk): Role {
  const n = call.args.length;
  if (call.tool === 'point' && n === 2) return 'position';
  if (call.tool === 'circle' && n === 2 && i === 1) return 'length';
  if (call.tool === 'on' && n === 3 && i >= 1) return 'anchored';
  if (call.tool === 'on' && n === 2 && i === 1) {
    const obj = call.args[0];
    const ks = obj === undefined ? undefined : exprKinds(obj, w.kinds, w.registry);
    return ks === undefined || ks.includes('circle') ? 'direction' : 'relative';
  }
  return 'relative';
}

function finding(role: Role, pure: boolean, text: string): Finding | undefined {
  switch (role) {
    case 'position':
    case 'direction':
      return { text, similarity: true, mirror: true };
    case 'length':
      return { text, similarity: true, mirror: false };
    case 'anchored':
      return { text, similarity: !pure, mirror: true };
    case 'relative':
      return pure ? undefined : { text, similarity: true, mirror: false };
    default:
      return assertNever(role, 'number role');
  }
}

function describe(role: Role, where: string, call: string, arg: string): string {
  switch (role) {
    case 'position':
      return `${where} has the fixed coordinates ${call}`;
    case 'length':
      return `${where} has the fixed radius ${arg} in ${call}`;
    case 'direction':
      return `${where} measures the angle ${arg} from the x-axis in ${call}`;
    case 'anchored':
      return `${where} has the fixed circle parameter ${arg} in ${call}`;
    case 'relative':
      return `${where} uses ${arg}, computed from the figure, in ${call}`;
    default:
      return assertNever(role, 'number role');
  }
}

/** The findings of one call; `mapped` when the samplers map its free literals. */
function callFindings(call: CallExpr, where: string, mapped: boolean, w: Walk): Finding[] {
  if (mapped || numberOnly(exprKinds(call, w.kinds, w.registry))) return [];
  const show = (e: Expr) => formatExpr(e, w.names);
  const out: Finding[] = [];
  call.args.forEach((a, i) => {
    const ks = exprKinds(a, w.kinds, w.registry);
    if (ks !== undefined && !ks.includes('number')) return;
    const role = roleOf(call, i, w);
    const f = finding(role, pureNumber(a, w), describe(role, where, show(call), show(a)));
    if (f !== undefined) out.push(f);
  });
  return out;
}

function exprFindings(e: Expr, where: string, w: Walk, owner?: number): Finding[] {
  const mappedAt = (path: Path) => owner !== undefined && w.mapped(owner, path);
  return callsOf(e).flatMap(({ call, path }) => callFindings(call, where, mappedAt(path), w));
}

function comparisonFindings(a: Assumption, w: Walk): Finding[] {
  if (a.kind !== 'less' && a.kind !== 'greater' && a.kind !== 'not_equal') return [];
  const d = comparisonDim(a.args);
  if (!d.ok || d.dim !== 'length' || !a.args.some((x) => x.kind === 'lit')) return [];
  const text = `assume ${assumptionText(a, w.names)} compares a length with a fixed number`;
  return [{ text, similarity: true, mirror: false }];
}

/** The frame of a prepared figure (see the module comment). */
export function samplerFrame(scope: FrameScope): SamplerFrame {
  const { doc, registry } = scope;
  const w: Walk = {
    kinds: objectKinds(doc, registry),
    registry,
    names: (id) => doc.objects.find((o) => o.id === id)?.name,
    defs: new Map(doc.objects.map((o) => [o.id, o.def])),
    mapped: scope.mapped,
    pure: new Map(),
  };
  const user = doc.objects.filter((o) => !isProbe(o) && (scope.keep?.has(o.id) ?? true));
  const found = [
    ...user.flatMap((o) => exprFindings(o.def, o.name, w, o.id)),
    ...scope.claimExprs.flatMap((e) => exprFindings(e, 'the claim', w)),
    ...scope.assumptions.flatMap((a) =>
      a.args.flatMap((e) => exprFindings(e, `assume ${assumptionText(a, w.names)}`, w)),
    ),
    ...scope.assumptions.flatMap((a) => comparisonFindings(a, w)),
  ];
  const sim = found.find((f) => f.similarity);
  const mir = found.find((f) => f.mirror);
  return {
    similarity: sim === undefined,
    mirror: mir === undefined,
    ...(sim === undefined ? {} : { noSimilarity: sim.text }),
    ...(mir === undefined ? {} : { noMirror: mir.text }),
  };
}
