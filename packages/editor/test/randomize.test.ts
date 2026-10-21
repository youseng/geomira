import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/edit';
import { randomizeEdit } from '../src/randomize';
import { edit, editorOf, env, ok, xyOf } from './helpers/editor';

/** Run 9b (ADR-0016): Randomize is one edit through packages/claims' sampler. */

const TRIANGLE =
  'A = (-1, 3)\nB = (0, 0)\nC = (4, 0)\nH = orthocenter(A, B, C)\nclaim collinear(A, B, H)';

describe('randomizeEdit', () => {
  it('redefines the free inputs in one history entry; undo returns the figure exactly', () => {
    const s0 = editorOf(TRIANGLE);
    const r = randomizeEdit(s0, env, 'acute', 11);
    if (r.kind !== 'edit') throw new Error(r.reason);
    expect(r.triangle).toEqual(['A', 'B', 'C']);
    const s1 = ok(applyEdit(s0, r.edit, env));
    expect(s1.history.past.length).toBe(s0.history.past.length + 1);
    expect(xyOf(s1, 'A')).not.toEqual(xyOf(s0, 'A'));
    expect(s1.doc.objects.map((o) => o.name)).toEqual(s0.doc.objects.map((o) => o.name));
    expect(s1.doc.claims).toEqual(s0.doc.claims);
    const back = edit(s1, { kind: 'undo' });
    expect(back.doc).toBe(s0.doc);
    expect(edit(back, { kind: 'redo' }).doc).toBe(s1.doc);
  });

  it('is deterministic for a seed', () => {
    const s0 = editorOf(TRIANGLE);
    expect(randomizeEdit(s0, env, 'obtuse', 3)).toEqual(randomizeEdit(s0, env, 'obtuse', 3));
  });

  it('refuses during a drag and passes on the sampler’s refusals', () => {
    const s0 = editorOf('A = (0, 0)\nB = (1, 1)');
    expect(randomizeEdit(s0, env, 'acute', 1)).toEqual({
      kind: 'refused',
      reason: 'a acute triangle needs three free points; this figure has 2',
    });
    const id = s0.doc.objects[0]?.id ?? -1;
    const dragging = edit(s0, { kind: 'dragStart', id });
    expect(randomizeEdit(dragging, env, 'any', 1)).toEqual({
      kind: 'refused',
      reason: 'a drag is in progress: finish or cancel it first',
    });
  });
});
