/**
 * A special position's helpers (ADR-0035 decision 13): the units an input moves in, the
 * coarsest decimal grid at which the target still holds, and whether a position keeps the
 * figure (every assume line holds, nothing defined now becomes undefined).
 */
import { decimalText, floorLog10, roundTo } from '@geomira/num/decimal';
import { FloatField } from '@geomira/num/float-field';
import { assertNever } from '@geomira/num/assert';
import { fromNumber, toNumber } from '@geomira/num/rational';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import { evalClaim } from '@geomira/claims/eval-claim';
import { hypothesesInFigure } from '@geomira/claims/figure-hypotheses';
import { readFree, writeFree } from '@geomira/claims/free';
import type { Screen } from '@geomira/claims/screen';
import { withFact } from './find';
import { movedSlots, type FreeInput, type Problem } from './solve';
import type { DiscoveryEnv, Fact } from './types';

/** The input's natural units (finite differences, the move limit), or undefined (radius). */
export function units(
  screen: Screen,
  input: FreeInput,
  size: number,
  doc: Document,
): number[] | undefined {
  const now = readFree(doc, input);
  if (now === undefined) return undefined;
  switch (input.kind) {
    case 'point':
      return [size, size];
    case 'param': {
      const [lo, hi] = now;
      return lo === undefined || hi === undefined ? undefined : [toNumber(hi) - toNumber(lo)];
    }
    case 'line-glider':
    case 'angle-glider':
    case 'stereo': {
      const o = doc.objects.find((x) => x.id === input.id);
      const def = o?.def;
      const glider = def?.kind === 'call' && input.path.length === 0 ? def.args[0] : undefined;
      const v = glider?.kind === 'ref' ? screen.values.get(glider.id) : undefined;
      if (input.kind === 'line-glider')
        return v?.kind === 'line' ? [size / Math.hypot(v.d.x, v.d.y)] : undefined;
      if (input.kind === 'angle-glider')
        return v?.kind === 'circle' ? [((size / Math.sqrt(v.r2)) * 180) / Math.PI] : undefined;
      return now.map(() => Math.hypot(...now.map(toNumber)));
    }
    case 'radius':
      return undefined;
    default:
      return assertNever(input.kind, 'free input');
  }
}

/** The position rounded to the coarsest grid at which the target holds (a step per grid). */
export function* rounded(
  p: Problem,
  x: readonly number[],
  target: Fact,
  env: DiscoveryEnv,
  kinds: ClaimKinds,
): Generator<undefined, { doc: Document; rung: string } | undefined, unknown> {
  const now = readFree(p.doc, p.input);
  if (now === undefined) return undefined;
  const slots = movedSlots(p.input);
  for (let digits = 2; digits <= 12; digits++) {
    const texts: (string | undefined)[] = now.map(() => undefined);
    const values = now.map((v, i) => {
      const k = slots.indexOf(i);
      const xi = k < 0 ? undefined : x[k];
      if (xi === undefined) return v;
      const e = floorLog10(fromNumber(p.units[k] ?? 1)) - digits;
      const r = roundTo(fromNumber(xi), e);
      texts[i] = decimalText(r, e);
      return r;
    });
    const doc = writeFree(p.doc, [{ input: p.input, values, texts }]);
    const w = withFact(doc, target);
    const v = evalClaim(w.doc, w.id, env.registry, { kinds });
    if (v.value === 'true') return { doc, rung: v.rung };
    yield undefined;
  }
  return undefined;
}

/**
 * Whether the position keeps the figure: every assume line holds, nothing becomes undefined,
 * and no point goes to infinity (a point at infinity is not drawn: the figure degenerates there,
 * ADR-0040).
 */
export function keeps(
  doc: Document,
  screen: Screen,
  env: DiscoveryEnv,
): 'ok' | 'hypotheses' | 'degenerate' {
  if (hypothesesInFigure(doc, env.registry).some((h) => h.status !== 'holds')) return 'hypotheses';
  const values = evaluate(doc, env.registry, FloatField, screen.ctx).values;
  // The document's objects only: the screen's map also holds its probes' values (the probed
  // document's extra objects), which the position's evaluation does not have.
  for (const o of doc.objects) {
    const v = screen.values.get(o.id);
    if (v === undefined) continue;
    const w = values.get(o.id);
    const was = v.kind !== 'undefined' && v.kind !== 'inexact';
    if (was && (w === undefined || w.kind === 'undefined' || w.kind === 'inexact'))
      return 'degenerate';
    if (v.kind === 'point' && w?.kind === 'ideal_point') return 'degenerate';
  }
  return 'ok';
}
