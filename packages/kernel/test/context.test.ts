import { MAX_SCALE } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { contextProblem, evalContextFor } from '../src/context';
import { emptyDocument } from '../src/document';
import { call } from '../src/expr';
import { Builder, num, pt } from './helpers/doc';

describe('evalContextFor (SPEC §3.1: scale = diameter of the free points, ≥ 1)', () => {
  it('uses the bounding-box diameter of every point(lit, lit), nested ones included', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', 30, 0);
    b.add('M', call('midpoint', [pt(0, 40), pt(1, 1)]));
    expect(evalContextFor(b.doc)).toEqual({ ok: true, ctx: { scale: 50 } });
  });

  it('ignores computed points; small figures get scale 1', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.add('B', call('point', [call('add', [num(100), num(1)]), num(0)]));
    expect(evalContextFor(b.doc)).toEqual({ ok: true, ctx: { scale: 1 } });
    expect(evalContextFor(emptyDocument())).toEqual({ ok: true, ctx: { scale: 1 } });
    const tiny = new Builder();
    tiny.point('A', 0, 0);
    tiny.point('B', '1/1000', 0);
    expect(evalContextFor(tiny.doc)).toEqual({ ok: true, ctx: { scale: 1 } });
  });

  it('rejects figures beyond MAX_SCALE or beyond the double range', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', 1e101, 0);
    expect(evalContextFor(b.doc)).toEqual({
      ok: false,
      reason: 'the figure is larger than the largest supported scale',
    });
    const c = new Builder();
    c.point('A', `1${'0'.repeat(400)}`, 0);
    const r = evalContextFor(c.doc);
    expect(!r.ok && r.reason).toBe('a free point lies beyond the range of double precision');
  });

  it('contextProblem accepts exactly [1, MAX_SCALE]', () => {
    expect(contextProblem({ scale: 1 })).toBeUndefined();
    expect(contextProblem({ scale: MAX_SCALE })).toBeUndefined();
    expect(contextProblem({ scale: 0.5 })).toMatch(/invalid figure scale/);
    expect(contextProblem({ scale: Number.NaN })).toMatch(/invalid figure scale/);
  });
});
