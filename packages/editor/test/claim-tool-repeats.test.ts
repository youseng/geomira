/**
 * The claim tool may pick a point twice when its claim kind's points come in groups that can
 * share points (two angles, four segments): angle_eq(B, A, I, I, A, C) and
 * ratio(A, B, A, C, D, B, D, C), as the ratio and spiral tools may (ADR-0024 items 4 and 10).
 * Kinds whose arguments must differ (collinear, equal, …) still refuse a repeated pick.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { REPEATING_CLAIM_KINDS, claimToolKinds } from '../src/tool-steps';
import { env, editorOf, idOf, input, show, useTool } from './helpers/editor';

const FIG = [
  'A = (0, 3)',
  'B = (-2, 0)',
  'C = (3, 0)',
  'I = incenter(A, B, C)',
  'D = intersect(line(A, I), line(B, C))',
].join('\n');

function claimByPanel(kind: string, names: readonly string[]): string {
  let s = useTool(editorOf(FIG), 'claim', kind);
  for (const n of names) s = input(s, { kind: 'object', id: idOf(s, n) });
  const [c] = s.doc.claims;
  if (c === undefined) throw new Error('no claim');
  return `${c.kind}(${c.args.map((a) => show(s, a)).join(', ')})`;
}

describe('claim tool: repeated picks', () => {
  it('angle_eq(B, A, I, I, A, C): I and A are picked twice', () => {
    expect(claimByPanel('angle_eq', ['B', 'A', 'I', 'I', 'A', 'C'])).toBe(
      'angle_eq(B, A, I, I, A, C)',
    );
  });

  it('ratio(A, B, A, C, D, B, D, C): A, B, C and D are picked twice', () => {
    expect(claimByPanel('ratio', ['A', 'B', 'A', 'C', 'D', 'B', 'D', 'C'])).toBe(
      'ratio(A, B, A, C, D, B, D, C)',
    );
  });

  it('collinear and equal still refuse a repeated point', () => {
    for (const kind of ['collinear', 'equal']) {
      const s = input(useTool(editorOf(FIG), 'claim', kind), {
        kind: 'object',
        id: idOf(editorOf(FIG), 'A'),
      });
      const r = toolInput(s, { kind: 'object', id: idOf(s, 'A') }, env);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('this object is already picked');
    }
  });

  it('every repeating kind is a kind the claim tool offers', () => {
    for (const k of REPEATING_CLAIM_KINDS) expect(claimToolKinds()).toContain(k);
  });
});
