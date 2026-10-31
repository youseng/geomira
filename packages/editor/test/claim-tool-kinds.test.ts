/**
 * ADR-0051: every claim kind of the registry is reachable from the claim tool, so a new kind
 * cannot be forgotten. Kinds with a number (AB = k·CD, ∡(l, m) = θ, angle sums, cross ratios,
 * n∡ABC = ∡DEF) take it from the tool's number field (ToolUI.value's mechanism, ADR-0024
 * decision 5), written at its place in the claim; each kind keeps its own last number.
 */
import { describe, expect, it } from 'vitest';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { isLiteralParam, type ClaimParam } from '@geomira/claims/kind';
import { print } from '@geomira/lang/print';
import { CLAIM_VALUE_KINDS, claimToolKinds, claimValue } from '../src/claim-tool';
import { toolInput } from '../src/machine';
import { toolValue } from '../src/tool-steps';
import { toolUI } from '../src/tools';
import type { EditorState } from '../src/state';
import { docOf, edit, editorOf, env, idOf, input, show, useTool } from './helpers/editor';

const FIG = [
  ...['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'D = (5, 2)'],
  ...['E = (-2, 1)', 'F = (2, -3)', 'G = (-1, -2)', 'H = (3, 5)'],
  ...['l_1 = line(A, B)', 'l_2 = line(A, C)', 'l_3 = line(B, D)', 'l_4 = line(C, E)'],
  ...['c_1 = circle(A, B)', 'c_2 = circle(D, F)'],
].join('\n');

/** The objects picked for each kind of parameter, in turn. */
const POOL: Readonly<Record<string, readonly string[]>> = {
  point: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  line: ['l_1', 'l_2', 'l_3', 'l_4'],
  circle: ['c_1', 'c_2'],
  curve: ['c_1', 'c_2'],
};

function claimByPanel(kind: string): EditorState {
  let s = useTool(editorOf(FIG), 'claim', kind);
  const k = claimKindRegistry().get(kind);
  if (k === undefined) throw new Error(kind);
  const used: Record<string, number> = {};
  const objects = k.params.filter((p) => !isLiteralParam(p));
  for (const p of objects) {
    const i = used[p] ?? 0;
    used[p] = i + 1;
    s = input(s, { kind: 'object', id: idOf(s, POOL[p]?.[i] ?? 'A') });
  }
  return k.rest === undefined ? s : input(s, { kind: 'finish' });
}

function claimText(s: EditorState): string {
  return print(s.doc)
    .split('\n')
    .filter((l) => l.startsWith('claim '))
    .join('\n');
}

describe('every claim kind is reachable from the claim tool (ADR-0051)', () => {
  it('the claim tool offers exactly the registry kinds', () => {
    expect(claimToolKinds()).toEqual(claimKindRegistry().kinds.map((k) => k.name));
  });

  for (const k of claimKindRegistry().kinds) {
    it(`${k.name}: picks fill its object parameters; its number comes from the field`, () => {
      const s = claimByPanel(k.name);
      const [c] = s.doc.claims;
      expect(c?.kind, claimText(s)).toBe(k.name);
      const lit = k.params.findIndex(isLiteralParam);
      if (lit >= 0) {
        const a = c?.args[lit];
        expect(a?.kind).toBe('lit');
        expect(a === undefined ? '' : show(s, a)).toBe(claimValue(k.name)?.initial);
      }
      // The claim reads back from its text (P1).
      expect(docOf(print(s.doc)).claims).toEqual(s.doc.claims);
    });
  }

  it('every kind with a number has a labelled field, and only those', () => {
    const literal = (p: ClaimParam) => isLiteralParam(p);
    const withNumber = claimKindRegistry()
      .kinds.filter((k) => k.params.some(literal))
      .map((k) => k.name);
    expect([...CLAIM_VALUE_KINDS].sort()).toEqual([...withNumber].sort());
    for (const k of claimKindRegistry().kinds) {
      expect(k.params.filter(literal).length, k.name).toBeLessThanOrEqual(1);
      expect(claimValue(k.name) !== undefined, k.name).toBe(k.params.some(literal));
    }
  });
});

describe('the number field of the claim tool', () => {
  const tool = toolUI('claim');
  if (tool === undefined) throw new Error('no claim tool');

  it('∡(l, m) = θ: θ typed as 45° gives dangle_lines(l_1, l_2, 45)', () => {
    let s = useTool(editorOf(FIG), 'claim', 'dangle_lines');
    expect(toolValue(tool, s.toolState)?.label).toBe('θ in ∡(l, m) = θ (degrees)');
    expect(s.toolState.value).toBe('90');
    s = edit(s, { kind: 'toolValue', value: '45°' });
    s = input(s, { kind: 'object', id: idOf(s, 'l_1') });
    s = input(s, { kind: 'object', id: idOf(s, 'l_2') });
    expect(claimText(s)).toBe('claim ∡(l_1, l_2) = 45');
  });

  it('AB = k·CD: k = 3/2; a two-point line is not offered for points', () => {
    let s = useTool(editorOf(FIG), 'claim', 'length');
    s = edit(s, { kind: 'toolValue', value: '3/2' });
    for (const n of ['A', 'B', 'C', 'A']) s = input(s, { kind: 'object', id: idOf(s, n) });
    expect(claimText(s)).toBe('claim AB = 3/2·CA');
  });

  it('n∡ABC = ∡DEF: n is written first; a fraction is refused, the picks kept', () => {
    let s = useTool(editorOf(FIG), 'claim', 'dangle');
    s = edit(s, { kind: 'toolValue', value: '1.5' });
    for (const n of ['A', 'B', 'C', 'D', 'E']) s = input(s, { kind: 'object', id: idOf(s, n) });
    const r = toolInput(s, { kind: 'object', id: idOf(s, 'F') }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('n in n∡ABC = ∡DEF: n must be a whole number');
    s = edit(s, { kind: 'toolValue', value: '2' });
    s = input(s, { kind: 'object', id: idOf(s, 'F') });
    expect(claimText(s)).toBe('claim 2∡ABC = ∡DEF');
  });

  it('an empty field is refused with what to type', () => {
    let s = useTool(editorOf(FIG), 'claim', 'angle_sum');
    s = edit(s, { kind: 'toolValue', value: ' ' });
    for (const n of ['A', 'B', 'C', 'D', 'E']) s = input(s, { kind: 'object', id: idOf(s, n) });
    const r = toolInput(s, { kind: 'object', id: idOf(s, 'F') }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('type θ in ∠ABC + ∠DEF = θ (degrees) in the field');
  });

  it('each kind keeps its own last number; kinds without one take no number', () => {
    let s = useTool(editorOf(FIG), 'claim', 'length');
    s = edit(s, { kind: 'toolValue', value: '2' });
    s = useTool(s, 'claim', 'dangle_lines');
    expect(s.toolState.value).toBe('90');
    s = useTool(s, 'claim', 'length');
    expect(s.toolState.value).toBe('2');
    s = useTool(s, 'claim', 'collinear');
    expect(toolValue(tool, s.toolState)).toBeUndefined();
    const r = toolInput(s, { kind: 'cancel' }, env);
    expect(r.ok).toBe(true);
  });
});
