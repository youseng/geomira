/**
 * The steps of a GUI tool (tools.ts) and which of them the next pick may fill: the claim
 * tool's come from its claim kind; an order-free tool (ToolUI.anyOrder, ADR-0024) may fill
 * any step it has not filled yet.
 */
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import type { ClaimParam } from '@geomira/claims/kind';
import type { ToolState } from './tool-state';
import type { PickKind, ToolStep, ToolUI } from './tool-ui';

const OBJECT_PARAMS: readonly ClaimParam[] = ['point', 'line', 'circle', 'curve'];

/** Claim kinds the claim tool offers: those whose parameters are all objects. */
export function claimToolKinds(): string[] {
  const objects = (p: ClaimParam) => OBJECT_PARAMS.includes(p);
  return CLAIM_KINDS.filter(
    (k) => k.params.every(objects) && (k.rest === undefined || objects(k.rest)),
  ).map((k) => k.name);
}

function pickOfParam(p: ClaimParam): PickKind {
  return p === 'point' || p === 'line' || p === 'circle' ? p : 'curve';
}

/** The steps of the active tool (the claim tool's come from its claim kind). */
export function stepsOf(
  tool: ToolUI,
  ts: ToolState,
): { steps: readonly ToolStep[]; rest?: ToolStep } {
  if (tool.build.kind !== 'claim') return tool;
  const k = CLAIM_KINDS.find((x) => x.name === ts.claimKind);
  if (k === undefined || !claimToolKinds().includes(k.name)) return { steps: [] };
  const step = (p: ClaimParam): ToolStep => ({ pick: pickOfParam(p), prompt: `${k.name}: ${p}` });
  const steps = k.params.map(step);
  return k.rest === undefined ? { steps } : { steps, rest: step(k.rest) };
}

/** A step the next pick may fill, with its index (its place in the call). */
export interface OpenStep {
  readonly index: number;
  readonly step: ToolStep;
}

/**
 * The steps the next pick may fill: for an order-free tool every step not filled yet, in the
 * tool's order; otherwise the next step (or the rest step), alone.
 */
export function openSteps(tool: ToolUI, ts: ToolState): OpenStep[] {
  const { steps, rest } = stepsOf(tool, ts);
  if (tool.anyOrder === true)
    return steps.flatMap((step, index) => (ts.slots.includes(index) ? [] : [{ index, step }]));
  const index = ts.picks.length;
  const step = steps[index] ?? rest;
  return step === undefined ? [] : [{ index, step }];
}
