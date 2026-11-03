/**
 * The claim tool's data (ADR-0051): every claim kind of packages/claims is reachable. A kind's
 * object parameters are the tool's steps (a line parameter takes a line, segment or ray, or two
 * points: `line(A, P)`); its literal parameter, if any (the k of AB = k·CD, the θ of
 * ∡(l, m) = θ, the n of n∡ABC = ∡DEF), is the number typed in the tool's field (ToolUI.value's
 * mechanism, ADR-0024 decision 5), written at its place in the claim.
 */
import { CLAIM_KINDS, claimKind } from '@geomira/claims/kinds';
import { isLiteralParam, type ClaimKindSpec, type ClaimParam } from '@geomira/claims/kind';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { assertNever } from '@geomira/num/assert';
import { parseRational } from '@geomira/num/rational';
import type { ToolState, TypedKey } from './tool-state';
import type { PickKind, ToolStep, ToolUI, ToolValue } from './tool-ui';

/** The claim kinds the claim tool offers: every kind of the registry, in its order. */
export function claimToolKinds(): string[] {
  return CLAIM_KINDS.map((k) => k.name);
}

/**
 * Claim kinds whose points come in groups that may share points (two angles, segments,
 * triangles): the claim tool may pick a point twice for them, angle_eq(B, A, I, I, A, C),
 * ratio(A, B, A, C, …), PA·PB = PC·PD, ABD ∼ ACE, as the ratio and spiral tools may
 * (ToolUI.repeats). Every other kind refuses a repeated pick: its arguments must differ
 * (collinear(A, A, B) is degenerate). A point may always be in two lines given by points.
 */
export const REPEATING_CLAIM_KINDS: readonly string[] = Object.freeze([
  'angle_eq',
  'ratio',
  'length',
  'ratio_value',
  'dangle',
  'angle_sum',
  'angle_diff',
  'length_product',
  'length_sum',
  'similar',
  'similar_direct',
  'similar_opposite',
  'congruent',
  'congruent_direct',
  'congruent_opposite',
]);

/** The number each kind with a literal parameter asks for (label and the field's first text). */
const CLAIM_VALUES: Readonly<Record<string, ToolValue>> = Object.freeze({
  length: { label: 'k in AB = k·CD', initial: '1' },
  ratio_value: { label: 'k in AB/CD = k', initial: '2' },
  dangle: { label: 'n in n∡ABC = ∡DEF', initial: '1' },
  dangle_lines: { label: 'θ in ∡(l, m) = θ (degrees)', initial: '90' },
  angle_sum: { label: 'θ in ∠ABC + ∠DEF = θ (degrees)', initial: '180' },
  angle_diff: { label: 'θ in ∠ABC − ∠DEF = θ (degrees)', initial: '0' },
  cross_ratio: { label: 'k in (A, B; C, D) = k', initial: '-1' },
  cross_ratio_lines: { label: 'k in (a, b; c, d) = k', initial: '-1' },
});

/** The kinds that take a number and the labels of their fields (a test checks them). */
export const CLAIM_VALUE_KINDS: readonly string[] = Object.freeze(Object.keys(CLAIM_VALUES));

/** The literal parameter of a kind and its position, or undefined when it has none. */
function literalOf(k: ClaimKindSpec): { readonly at: number; readonly p: ClaimParam } | undefined {
  const at = k.params.findIndex(isLiteralParam);
  const p = k.params[at];
  return p === undefined ? undefined : { at, p };
}

/** The number the claim tool asks for with this kind, or undefined. */
export function claimValue(kind: string): ToolValue | undefined {
  const k = claimKind(kind);
  if (k === undefined || literalOf(k) === undefined) return undefined;
  return CLAIM_VALUES[kind] ?? { label: `the number of ${kind}`, initial: '1' };
}

function pickOfParam(p: ClaimParam): PickKind {
  switch (p) {
    case 'point':
    case 'circle':
      return p;
    case 'line':
      return 'line_or_points';
    // Literal parameters have no step (claimSteps leaves them out): never asked here.
    case 'curve':
    case 'integer':
    case 'number':
      return 'curve';
    default:
      return assertNever(p, 'claim parameter');
  }
}

const WORDS: Readonly<Record<string, string>> = Object.freeze({
  line_or_points: 'line (or two points)',
});

/** The steps of a claim kind (its object parameters) and its rest step, if any. */
export function claimSteps(kind: string): { steps: readonly ToolStep[]; rest?: ToolStep } {
  const k = claimKind(kind);
  if (k === undefined) return { steps: [] };
  const step = (p: ClaimParam): ToolStep => {
    const pick = pickOfParam(p);
    return { pick, prompt: `${k.name}: ${WORDS[pick] ?? p}` };
  };
  const steps = k.params.filter((p) => !isLiteralParam(p)).map(step);
  return k.rest === undefined ? { steps } : { steps, rest: step(k.rest) };
}

/** The step of the second point of a line given by two points. */
export function secondPointStep(kind: string): ToolStep {
  return { pick: 'point', prompt: `${kind}: the second point of the line` };
}

/** The typed number as the kind's literal argument, or why it is not one. */
function literal(k: ClaimKindSpec, p: ClaimParam, text: string): Expr | string {
  const label = claimValue(k.name)?.label ?? k.name;
  const t = text.trim().replace(/°$/u, '');
  if (t === '') return `type ${label} in the field`;
  const r = parseRational(t);
  if (!r.ok) return `${label}: ${r.reason}`;
  if (p === 'integer' && r.value.den !== 1n) return `${label}: n must be a whole number`;
  return lit(r.value, t);
}

/**
 * The arguments of the claim: each group of picks fills one object parameter in order (one
 * object, or two points: line(A, P)); the literal parameter takes the typed number. Undefined
 * kind or a bad number → the reason.
 */
export function claimArgs(
  kind: string,
  groups: readonly (readonly number[])[],
  typed: string,
): Expr[] | string {
  const k = claimKind(kind);
  if (k === undefined) return `unknown claim "${kind}"`;
  const objects = groups.map((g): Expr => {
    const [a, b] = g;
    return b === undefined ? ref(a ?? -1) : call('line', [ref(a ?? -1), ref(b)]);
  });
  const l = literalOf(k);
  if (l === undefined) return objects;
  const value = literal(k, l.p, typed);
  if (typeof value === 'string') return value;
  return [...objects.slice(0, l.at), value, ...objects.slice(l.at)];
}

/**
 * The number the active tool asks for: the claim tool's comes from its kind (ADR-0051), every
 * other tool's from its data (ToolUI.value).
 */
export function toolValue(tool: ToolUI, ts: ToolState): ToolValue | undefined {
  return tool.build.kind === 'claim' ? claimValue(ts.claimKind) : tool.value;
}

/** Where the last number typed for the tool is kept (the claim tool: per kind). */
export function typedKey(tool: ToolUI, ts: ToolState): TypedKey {
  return tool.build.kind === 'claim' ? `claim:${ts.claimKind}` : tool.id;
}
