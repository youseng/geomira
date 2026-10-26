/**
 * The numeric rung's perturbations and size factor (internal; SPEC §3.1, ADR-0027), shared by
 * the rungs (rungs.ts) and the finder's screen (screen.ts), so both judge a figure the same way.
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { FLOOR_DELTA } from '@geomira/num/tolerance';
import type { Document } from '@geomira/kernel/document';
import { figureDiameter } from '@geomira/kernel/figure-size';
import { applySimilarity, similarity } from '@geomira/kernel/similarity';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value } from '@geomira/kernel/value';
import { readFree, writeFree, type Assignment, type FreeInput } from './free';
import { withoutProbes } from './probes';

/**
 * The free inputs moved by FLOOR_DELTA in their natural units (lengths: scale; a line
 * glider's t: scale/|d|; an angle: radians; (u : v): |(u, v)|, as the parameter is
 * homogeneous, so the step is relative to it; a param: its range). `glider(input)` is the
 * float value of a glider's object. Degenerate: (0 : 0) → a step of 0 (the glider is
 * undefined either way).
 */
export function perturbFree(
  free: readonly FreeInput[],
  glider: (input: FreeInput) => Value<number> | undefined,
  doc: Document,
  rng: Rng,
  scale: number,
): Document {
  const jitter = (x: { num: bigint; den: bigint }, unit: number) =>
    fromNumber(toNumber(x) + FLOOR_DELTA * unit * rng.gaussian());
  const out: Assignment[] = [];
  for (const input of free) {
    const v = readFree(doc, input);
    if (v === undefined || input.kind === 'radius') continue;
    const g = glider(input);
    const unit =
      input.kind === 'point'
        ? scale
        : input.kind === 'line-glider' && g?.kind === 'line'
          ? scale / Math.hypot(g.d.x, g.d.y)
          : input.kind === 'angle-glider'
            ? 180 / Math.PI
            : input.kind === 'stereo'
              ? Math.hypot(...v.map(toNumber))
              : 1;
    if (input.kind === 'param') {
      const [lo, hi, x] = v;
      if (lo !== undefined && hi !== undefined && x !== undefined)
        out.push({ input, values: [lo, hi, jitter(x, toNumber(hi) - toNumber(lo))] });
      continue;
    }
    out.push({ input, values: v.map((x) => jitter(x, unit)) });
  }
  return writeFree(doc, out);
}

/**
 * The factor the numeric rung scales a figure's claim arguments by before judging them: the
 * evaluation scale over the figure's size (probes excluded) when the size is below it (SPEC
 * §3.1's clamp to ≥ 1), so a small figure is judged as the same figure at size 1; else 1.
 * Degenerate cases: no size (a single point, no free point) or a non-finite one → 1.
 */
export function judgingFactor(doc: Document, ctx: EvalContext): number {
  const d = figureDiameter(withoutProbes(doc));
  return d !== undefined && Number.isFinite(d) && d > 0 && d < ctx.scale ? ctx.scale / d : 1;
}

/** The claim's arguments scaled by k about the origin (numbers are dimensionless: kept). */
export function scaledArgs(args: readonly Value<number>[], k: number): Value<number>[] {
  if (k === 1) return [...args];
  const s = similarity(false, { re: k, im: 0 }, { re: 0, im: 0 });
  return args.map((v) => (v.kind === 'number' ? v : applySimilarity(FloatField, s, v)));
}
