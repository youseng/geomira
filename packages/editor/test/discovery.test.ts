/**
 * ADR-0035, ADR-0036: the editor's apply step. "Add as claim" is one undoable edit shown in
 * the text; a branch fix is one batch (one history entry, one undo); the GUI selector choice,
 * given to the branch-fix job, writes reflection-equivariant selectors where the construction
 * offers them (law L16), so the fixed claim holds across the declared configuration.
 */
import { describe, expect, it } from 'vitest';
import { branchFix } from '@geomira/discovery/branch-fix';
import { find } from '@geomira/discovery/find';
import { print } from '@geomira/lang/print';
import { parse } from '@geomira/lang/parse';
import { createRegistry } from '@geomira/kernel/registry';
import { applyEdit } from '../src/edit';
import { branchChooser, branchFixEdit, factEdit } from '../src/discovery';
import { createEditor } from '../src/state';

const registry = createRegistry();
const env = { registry };

function doc(text: string) {
  const r = parse(text, registry);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r.doc;
}

describe('the apply step of discovery', () => {
  it('Add as claim: one edit, in the text, undoable', () => {
    const d = doc(
      [
        '@version 1',
        'A = (1, 5)',
        'B = (-3, 0)',
        'C = (4, 1)',
        'O = circumcenter(A, B, C)',
        'G = centroid(A, B, C)',
        'H = orthocenter(A, B, C)',
      ].join('\n'),
    );
    const r = find({ kind: 'find', doc: d, seed: 1, budget: { n: 10, tests: 5 } }, { registry });
    if (r.kind !== 'found') throw new Error(r.kind);
    const euler = r.facts.find((x) => x.kind === 'collinear');
    if (euler === undefined) throw new Error('no Euler line');
    const s0 = createEditor(d, env);
    const s1 = applyEdit(s0, factEdit(euler), env);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    expect(print(s1.state.doc)).toMatch(/^claim collinear\([OHG], [OHG], [OHG]\)$/mu);
    expect(s1.state.history.past).toHaveLength(1);
    const back = applyEdit(s1.state, { kind: 'undo' }, env);
    expect(back.ok && back.state.doc).toBe(d);
  });

  it('a branch fix written by the GUI choice: opposite_side instead of orient(+), one undo', () => {
    const d = doc(
      [
        '@version 1',
        'A = (0, 0)',
        'B = (8, 0)',
        'Q = (4, -10)',
        'c1 = circle(A, 7)',
        'c2 = circle(B, 7)',
        'ab = line(A, B)',
        'X = intersect(c1, c2, orient(+))',
        'Y = intersect(c1, c2, opposite_side(Q, ab))',
        'claim X = Y',
      ].join('\n'),
    );
    const claim = d.claims[0]?.id ?? -1;
    const r = branchFix(
      { kind: 'branchFix', doc: d, claim, regime: 'global', seed: 2, n: 60 },
      { registry, choose: branchChooser },
    );
    if (r.kind !== 'fixes') throw new Error(r.kind);
    const first = r.fixes[0];
    if (first === undefined) throw new Error('no fix');
    expect(first.moves).toEqual([]);
    expect(first.verdict.kind).toBe('holds-across');
    // X's only reflection-equivariant selector is Y's own definition: reported as a repeat (the
    // UI does not apply it; the edit itself is still one undoable batch, checked below).
    const id = (name: string) => d.objects.find((o) => o.name === name)?.id;
    expect(first.repeats).toEqual([{ object: id('X'), of: id('Y') }]);
    const s0 = createEditor(d, env);
    const s1 = applyEdit(s0, branchFixEdit(first), env);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    const text = print(s1.state.doc);
    expect(text).toContain('X = intersect(c1, c2, opposite_side(Q, ab))');
    // Y already had a reflection-equivariant selector and kept its point: left as written.
    expect(first.edits.map((e) => e.id)).toEqual([d.objects.find((o) => o.name === 'X')?.id]);
    expect(text).not.toContain('orient(');
    expect(s1.state.history.past).toHaveLength(1);
    const back = applyEdit(s1.state, { kind: 'undo' }, env);
    expect(back.ok && back.state.doc).toBe(d);
  });
});
