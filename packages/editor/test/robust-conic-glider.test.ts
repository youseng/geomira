/**
 * Run 16c audit (ADR-0012: a step-2 selector's firmness counts every free input moved by one
 * LOCAL deviation): a glider on a conic was not moved, so a distance that depends on where it
 * sits on the conic was scored firmer than it is. Its (u : v) is now turned so that the point
 * moves by about one deviation along the conic, as a circle glider's is.
 */
import { evalContextFor } from '@geomira/kernel/context';
import { figureDiameter } from '@geomira/kernel/figure-size';
import { LOCAL_SIGMA } from '@geomira/claims/constants';
import { describe, expect, it } from 'vitest';
import { localResponses } from '../src/robust';
import { editorOf, idOf, registry } from './helpers/editor';

const FIG = [
  'A = (2, 0)',
  'B = (0, 1)',
  'C = (-2, 0)',
  'D = (0, -1)',
  'E = (6/5, 4/5)',
  'k = conic(A, B, C, D, E)',
  'G = on(k, 2, 1)',
].join('\n');

describe('the local responses move a glider on a conic', () => {
  it('one response per free coordinate and one for the glider, which moves G by about h', () => {
    const s = editorOf(FIG);
    const ctx = evalContextFor(s.doc);
    if (!ctx.ok) throw new Error(ctx.reason);
    const rs = localResponses(s.doc, s.values.values, registry, ctx.ctx);
    expect(rs).toHaveLength(11);
    const g = idOf(s, 'G');
    const at = (m: ReadonlyMap<number, unknown>) => m.get(g) as { x: number; y: number };
    const h = LOCAL_SIGMA * (figureDiameter(s.doc) ?? 1);
    const last = rs[10];
    expect(last).toBeDefined();
    if (last === undefined) return;
    const [p, q] = [at(s.values.values), at(last)];
    expect(Math.hypot(p.x - q.x, p.y - q.y) / h).toBeCloseTo(1, 1);
  });
});
