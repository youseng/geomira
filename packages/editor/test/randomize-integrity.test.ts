import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { hypothesesInFigure } from '@geomira/claims/figure-hypotheses';
import { checkAssumption } from '@geomira/claims/hypotheses';
import { BAND } from '@geomira/num/tolerance';
import { randomizeEdit } from '../src/randomize';
import { applyEdit } from '../src/edit';
import { editorOf, env, ok } from './helpers/editor';

const INVALID = 'A=(0,0)\nB=(1,0)\nM=midpoint(A,B)\np=param(2,1,1)\nclaim collinear(A,M,B)\n';

describe('Randomize input integrity', () => {
  it('refuses an unrelated invalid domain without changing source or history', () => {
    const state = editorOf(INVALID);
    const before = structuredClone(state.doc);
    const result = randomizeEdit(state, env, 'any', 1);
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') throw new Error('missing refusal');
    expect(result.reason).toContain('p: param');
    expect(state.doc).toEqual(before);
    expect(state.history.past).toHaveLength(0);
  });

  it('a valid ratio-preserving Randomize is one edit with exact undo and redo', () => {
    const state = editorOf('O=(0,0)\nF=(1000,0)\nc=circle(O,0.01)\nd=circle(O,0.02)\n');
    const result = randomizeEdit(state, env, 'any', 2);
    if (result.kind === 'refused') throw new Error(result.reason);
    const after = ok(applyEdit(state, result.edit, env));
    expect(after.history.past).toHaveLength(1);
    const back = ok(applyEdit(after, { kind: 'undo' }, env));
    expect(back.doc).toEqual(state.doc);
    expect(ok(applyEdit(back, { kind: 'redo' }, env)).doc).toEqual(after.doc);
  });

  it('coincident two-point circular order fails after parsing separate lines', () => {
    const result = parse(
      '@version 1\nO=(0,0)\nw=circle(O,3)\nA=on(w,0)\nB=A\nassume in_order(A,B,w)\n',
      env.registry,
    );
    expect(result.diagnostics).toEqual([]);
    expect(hypothesesInFigure(result.doc, env.registry)[0]?.status).toBe('fails');
  });

  it('circular order requires distinct points with the existing BAND margin', () => {
    const p = (x: number, y: number) => ({ kind: 'point' as const, x, y });
    const circle = { kind: 'circle' as const, c: { x: 0, y: 0 }, r2: 1, arc: null };
    const at = (theta: number) => p(Math.cos(theta), Math.sin(theta));
    const check = (theta: number) =>
      checkAssumption('in_order', [at(0), at(theta), circle], 'number', { scale: 1 });
    expect(check(0)).toBe('fails');
    expect(check(BAND / 2)).toBe('ambiguous');
    expect(check(BAND * 2)).toBe('holds');
    expect(check(Math.PI)).toBe('holds');
  });
});
