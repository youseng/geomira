/**
 * ADR-0039: "Add as claim" for a grouped fact. A class (MB = MC = MI = MI_a) adds the claims of
 * its links as ONE batch (one history entry, one undo); an n-ary group (nine concyclic points)
 * is one claim. Both print as claim lines that parse back to the same claims.
 */
import { describe, expect, it } from 'vitest';
import { find } from '@geomira/discovery/find';
import type { FindResult } from '@geomira/discovery/types';
import { print } from '@geomira/lang/print';
import { parse } from '@geomira/lang/parse';
import { createRegistry } from '@geomira/kernel/registry';
import type { Document } from '@geomira/kernel/document';
import { applyEdit } from '../src/edit';
import { factEdit } from '../src/discovery';
import { createEditor } from '../src/state';

const registry = createRegistry();
const env = { registry };

function doc(lines: readonly string[]): Document {
  const r = parse(['@version 1', ...lines].join('\n'), registry);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.doc;
}

function found(d: Document): FindResult {
  const r = find({ kind: 'find', doc: d, seed: 1, budget: { n: 10 } }, { registry });
  if (r.kind !== 'found') throw new Error(r.kind);
  return r;
}

const TRIANGLE = ['A = (1, 5)', 'B = (-3, 0)', 'C = (4, 1)'];

describe('Add as claim for a group (ADR-0039)', () => {
  it('a class adds its links as one batch: one history entry, one undo', () => {
    const d = doc([
      ...TRIANGLE,
      'w = circumcircle(A, B, C)',
      'I = incenter(A, B, C)',
      'I_a = excenter(A, B, C)',
      'l = line(A, I)',
      'M = other(l, w, A)',
    ]);
    const r = found(d);
    const first = r.facts[0];
    expect(first?.chain).toHaveLength(3);
    if (first === undefined) return;
    const edit = factEdit(first);
    expect(edit.kind).toBe('batch');
    const s0 = createEditor(d, env);
    const s1 = applyEdit(s0, edit, env);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    expect(s1.state.doc.claims).toHaveLength(3);
    expect(s1.state.history.past).toHaveLength(1);
    const again = parse(print(s1.state.doc), registry).doc;
    expect(again.claims.map((c) => c.kind)).toEqual(['length', 'length', 'length']);
    const back = applyEdit(s1.state, { kind: 'undo' }, env);
    expect(back.ok && back.state.doc).toBe(d);
  }, 60_000);

  it('nine concyclic points are one claim', () => {
    const d = doc([
      ...TRIANGLE,
      'H = orthocenter(A, B, C)',
      'M_a = midpoint(B, C)',
      'M_b = midpoint(C, A)',
      'M_c = midpoint(A, B)',
      'D = foot(A, B, C)',
      'E = foot(B, C, A)',
      'F = foot(C, A, B)',
      'K_a = midpoint(A, H)',
      'K_b = midpoint(B, H)',
      'K_c = midpoint(C, H)',
    ]);
    const r = found(d);
    const cyclic = r.facts.find((x) => x.kind === 'concyclic');
    expect(cyclic?.objects).toHaveLength(9);
    if (cyclic === undefined) return;
    const s1 = applyEdit(createEditor(d, env), factEdit(cyclic), env);
    if (!s1.ok) throw new Error('refused');
    expect(print(s1.state.doc)).toMatch(/^claim concyclic\((\w+, ){8}\w+\)$/mu);
    const again = parse(print(s1.state.doc), registry).doc;
    expect(again.claims[0]?.args).toHaveLength(9);
  }, 120_000);
});
