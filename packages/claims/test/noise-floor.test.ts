/**
 * The numeric rung's noise floor in situ (SPEC §3.1): the residual is computed on the
 * figure and on exactly three perturbed figures, each moving every free input, by about
 * FLOOR_DELTA·scale, independently.
 */
import { createRng } from '@geomira/num/rng';
import { FLOOR_DELTA, FLOOR_SAMPLES } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import type { ClaimArgs, ClaimKindSpec } from '../src/kind';
import { prepare } from '../src/prepare';
import { decideSample } from '../src/rungs';
import { Figure, REGISTRY } from './helpers/build';

describe('the noise floor uses three independent perturbations of size FLOOR_DELTA·scale', () => {
  it('evaluates the residual on the figure and on three perturbed figures', () => {
    const f = new Figure().point('A', 0, 0).point('B', 8, 0).point('C', 3, 5);
    const id = f.claim('collinear', 'A', 'B', 'C');
    const p = prepare(f.doc, id, REGISTRY);
    if (!p.ok) throw new Error(p.reason);
    const seen: ClaimArgs<number>[] = [];
    const counting: ClaimKindSpec = {
      ...p.prepared.kind,
      residual: (args, ctx) => {
        seen.push(args);
        return p.prepared.kind.residual(args, ctx);
      },
    };
    const out = decideSample({ ...p.prepared, kind: counting }, p.prepared.doc, {
      budgetBits: 1,
      rng: createRng(4),
      hypotheses: false,
    });
    expect(out).toEqual({ kind: 'false', rung: 'numeric' });
    expect(FLOOR_SAMPLES).toBe(3);
    expect(seen.length).toBe(1 + FLOOR_SAMPLES);
    const scale = p.prepared.baseCtx.scale;
    const coords = seen.map((args) => args.flatMap((v) => (v.kind === 'point' ? [v.x, v.y] : [])));
    const [base, ...perturbed] = coords;
    for (const q of perturbed) {
      const moves = q.map((x, i) => Math.abs(x - (base?.[i] ?? 0)));
      // Every coordinate moved, by a Gaussian of size FLOOR_DELTA·scale (never 100 times more).
      expect(moves.every((m) => m > 0 && m < 100 * FLOOR_DELTA * scale)).toBe(true);
    }
    expect(new Set(perturbed.map((q) => q.join(','))).size).toBe(FLOOR_SAMPLES);
  });
});
