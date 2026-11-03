/**
 * The steps of a GUI tool (tools.ts) and which of them the next pick may fill: the claim
 * tool's come from its claim kind (claim-tool.ts); an order-free tool (ToolUI.anyOrder,
 * ADR-0024, and the claim tool for a kind whose steps differ in kind) may fill any step it has
 * not filled yet. A claim tool's line step may be filled by two points (ADR-0051): the slot is
 * then in ToolState.pairs, and after its first point the next pick is its second point.
 */
import { claimSteps, REPEATING_CLAIM_KINDS, secondPointStep } from './claim-tool';
import type { ToolState } from './tool-state';
import type { ToolStep, ToolUI } from './tool-ui';

export { claimToolKinds, REPEATING_CLAIM_KINDS, toolValue, typedKey } from './claim-tool';

/** Whether the next pick may name an object picked before. */
export function mayRepeat(tool: ToolUI, ts: ToolState): boolean {
  if (tool.build.kind === 'claim') return REPEATING_CLAIM_KINDS.includes(ts.claimKind);
  return tool.repeats === true;
}

/**
 * The steps of the active tool (the claim tool's come from its claim kind; a map tool's
 * without its object step when it builds the map alone, ToolState.mapOnly).
 */
export function stepsOf(
  tool: ToolUI,
  ts: ToolState,
): { steps: readonly ToolStep[]; rest?: ToolStep } {
  if (tool.map === true && ts.mapOnly === true) return { steps: tool.steps.slice(1) };
  if (tool.build.kind !== 'claim') return tool;
  return claimSteps(ts.claimKind);
}

/** The number of picks in slot `slot`. */
function fill(ts: ToolState, slot: number): number {
  return ts.slots.filter((s) => s === slot).length;
}

/** The slot of a line given by two points that has its first point only, or undefined. */
export function pendingPair(ts: ToolState): number | undefined {
  return (ts.pairs ?? []).find((slot) => fill(ts, slot) === 1);
}

/** The number of steps filled completely (a slot of two points counts once). */
export function filledSteps(ts: ToolState): number {
  const pending = pendingPair(ts);
  return new Set(ts.slots.filter((s) => s !== pending)).size;
}

/** The picks grouped by step, in the order of the steps (a two-point line is one group). */
export function pickGroups(
  picks: readonly number[],
  slots: readonly number[],
): (readonly number[])[] {
  const bySlot = new Map<number, number[]>();
  picks.forEach((id, i) => {
    const slot = slots[i] ?? i;
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), id]);
  });
  return [...bySlot.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids);
}

/**
 * Whether the picks may come in any order: an order-free tool (ToolUI.anyOrder), or the claim
 * tool when its kind's steps differ in kind and it has no rest step (on(point, curve): the
 * curve may be clicked first), by ADR-0024 item 1's rule.
 */
function orderFree(tool: ToolUI, steps: readonly ToolStep[], rest: ToolStep | undefined): boolean {
  if (tool.build.kind !== 'claim') return tool.anyOrder === true;
  return rest === undefined && new Set(steps.map((s) => s.pick)).size > 1;
}

/** A step the next pick may fill, with its index (its place in the call). */
export interface OpenStep {
  readonly index: number;
  readonly step: ToolStep;
}

/**
 * The steps the next pick may fill: the second point of a line given by two points, alone;
 * for an order-free tool every step not filled yet, in the tool's order; otherwise the next
 * step (or the rest step), alone.
 */
export function openSteps(tool: ToolUI, ts: ToolState): OpenStep[] {
  const pending = pendingPair(ts);
  if (pending !== undefined) return [{ index: pending, step: secondPointStep(ts.claimKind) }];
  const { steps, rest } = stepsOf(tool, ts);
  if (orderFree(tool, steps, rest))
    return steps.flatMap((step, index) => (ts.slots.includes(index) ? [] : [{ index, step }]));
  const index = filledSteps(ts);
  const step = steps[index] ?? rest;
  return step === undefined ? [] : [{ index, step }];
}
