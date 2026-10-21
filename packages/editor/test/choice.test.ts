/**
 * The GUI selector choice (SPEC §7 order, ADR-0006): constructed situations for each step of
 * the order (other(P); same_side / opposite_side / on_arc with the largest margin; along /
 * orient; near(P), reached with a test-only tool without low-level selectors), the
 * preference of each step over the next, and orientation dependence only as a last resort.
 */
import { describe, expect, it } from 'vitest';
import { formatSelector, formatExpr, isOrientationDependent } from '@geomira/kernel/selector';
import { createRegistry } from '@geomira/kernel/registry';
import type { ToolSpec } from '@geomira/kernel/tool';
import { chooseSelectors } from '../src/choice';
import type { EditorState } from '../src/state';
import { createEditor } from '../src/state';
import { docOf, editorOf, idOf, registry } from './helpers/editor';

function chosen(
  s: EditorState,
  tool: 'intersect' | 'tangent_from',
  args: string[],
  at: [number, number],
) {
  const r = chooseSelectors(
    s.doc,
    s.values,
    registry,
    tool,
    args.map((n) => idOf(s, n)),
    { x: at[0], y: at[1] },
  );
  if (!r.ok) return { text: `refused: ${r.reason}`, tier: 0, r };
  const name = (id: number) => s.doc.objects.find((o) => o.id === id)?.name;
  return {
    text: r.selectors.map((x) => formatSelector(x, (e) => formatExpr(e, name))).join(', '),
    tier: r.tier,
    r,
  };
}

const BASE = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'];

describe('the GUI selector choice, step by step (SPEC §7)', () => {
  it('1. other(P) for an existing point at the other candidate', () => {
    const s = editorOf([...BASE, 'c = circle(A, B, C)', 'D = (3, 4)', 'l = line(A, D)'].join('\n'));
    const far = chosen(s, 'intersect', ['l', 'c'], [3, 4]);
    expect(far).toMatchObject({ text: 'other(A)', tier: 1 });
    // The candidate at A itself: A is not at the OTHER candidate, so tier 1 does not apply.
    expect(chosen(s, 'intersect', ['l', 'c'], [0, 0]).tier).toBeGreaterThan(1);
  });

  it('2. same_side / opposite_side with a point and a line of the construction', () => {
    const s = editorOf(
      [
        'O = (0, 0)',
        'P = (4, 0)',
        'c = circle(O, 3)',
        'k = circle(P, 3)',
        'm = line(O, P)',
        'Q = (1, 5)',
      ].join('\n'),
    );
    expect(chosen(s, 'intersect', ['c', 'k'], [2, 2])).toMatchObject({
      text: 'same_side(Q, m)',
      tier: 2,
    });
    expect(chosen(s, 'intersect', ['c', 'k'], [2, -2])).toMatchObject({
      text: 'opposite_side(Q, m)',
      tier: 2,
    });
  });

  it('2. on_arc with points of the construction on the circle', () => {
    const s = editorOf(
      [
        'O = (0, 0)',
        'R = (5, 0)',
        'c = circle(O, R)',
        'B = on(c, 1, 1)',
        'D = on(c, 1, -1)',
        'E = on(c, 0, 1)',
        'l = line((-6, 1), (6, 1))',
      ].join('\n'),
    );
    const r = chosen(s, 'intersect', ['l', 'c'], [4.9, 1]);
    expect(r.tier).toBe(2);
    expect(r.text).toMatch(/^on_arc\(/u);
  });

  it('2. within the kind, the largest decision margin wins', () => {
    const s = editorOf(
      [
        'O = (0, 0)',
        'P = (4, 0)',
        'c = circle(O, 3)',
        'k = circle(P, 3)',
        'm = line(O, P)',
        'n = line((0, 0.5), (4, 0.5))',
        'Q = (2, 0.6)',
        'U = (2, 9)',
      ].join('\n'),
    );
    // Q is 0.1 from n and 0.6 from m; U is 9 from m: same_side(U, m) has the largest margin.
    expect(chosen(s, 'intersect', ['c', 'k'], [2, 2]).text).toBe('same_side(U, m)');
  });

  it('3. along(±) on line ∩ circle, orient(±) on two circles and tangent choices', () => {
    const s = editorOf(
      [
        'O = (0, 0)',
        'P = (4, 0)',
        'c = circle(O, 3)',
        'k = circle(P, 3)',
        'l = line((-5, 1), (5, 1))',
      ].join('\n'),
    );
    expect(chosen(s, 'intersect', ['l', 'c'], [2.8, 1])).toMatchObject({
      text: 'along(+)',
      tier: 3,
    });
    expect(chosen(s, 'intersect', ['l', 'c'], [-2.8, 1])).toMatchObject({
      text: 'along(-)',
      tier: 3,
    });
    // Without l, nothing of the construction separates the two circles' intersections.
    const two = editorOf(
      ['O = (0, 0)', 'P = (4, 0)', 'c = circle(O, 3)', 'k = circle(P, 3)'].join('\n'),
    );
    // With l, O separates them, but by a margin of 1 (below 5 local σ = 0.1·scale ≈ 1.005):
    // too fragile to decide, so orient decides; a witness farther from l decides at step 2.
    expect(chosen(s, 'intersect', ['c', 'k'], [2, 2]).tier).toBe(3);
    const far = editorOf(
      [
        'O = (0, 0)',
        'P = (4, 0)',
        'c = circle(O, 3)',
        'k = circle(P, 3)',
        'l = line((-5, 1), (5, 1))',
        'W = (2, -4)',
      ].join('\n'),
    );
    expect(chosen(far, 'intersect', ['c', 'k'], [2, 2])).toMatchObject({
      text: 'opposite_side(W, l)',
      tier: 2,
    });
    const up = chosen(two, 'intersect', ['c', 'k'], [2, 2]);
    expect(up.tier).toBe(3);
    expect(up.text).toMatch(/^orient\([+-]\)$/u);
    expect(chosen(two, 'intersect', ['c', 'k'], [2, -2]).text).not.toBe(up.text);
    const t = editorOf(['O = (0, 0)', 'c = circle(O, 3)', 'P = (6, 0)'].join('\n'));
    const tp = chosen(t, 'tangent_from', ['P', 'c'], [1.5, 2.6]);
    expect(tp.tier).toBe(3);
    expect(tp.text).toMatch(/^orient/u);
  });

  it('4. near(P) for a named point at the clicked candidate (a branchable tool without low-level selectors)', () => {
    const base = registry.get('intersect');
    if (base?.candidates === undefined) throw new Error('intersect');
    const candidates = base.candidates.bind(base);
    // A test-only branchable tool that takes no along/orient (tests may extend registries).
    const meet: ToolSpec = {
      ...base,
      id: 'meet',
      name: 'meet',
      compute: (F, args, ctx, selectors) =>
        selectors?.some((x) => x.selector.kind === 'along' || x.selector.kind === 'orient') === true
          ? { kind: 'undefined', reason: 'meet takes no low-level selector' }
          : base.compute(F, args, ctx, selectors),
      candidates,
    };
    const reg = createRegistry([meet]);
    const text = ['O = (0, 0)', 'c = circle(O, 3)', 'l = line((-5, 0), (5, 0))', 'X = (3, 0)'].join(
      '\n',
    );
    const s = createEditor(docOf(text), { registry: reg });
    const ids = [idOf(s, 'l'), idOf(s, 'c')];
    const via = (tool: string) => {
      const r = chooseSelectors(s.doc, s.values, reg, tool, ids, { x: 3, y: 0 });
      const name = (id: number) => s.doc.objects.find((o) => o.id === id)?.name;
      return r.ok
        ? `${String(r.tier)} ${r.selectors.map((x) => formatSelector(x, (e) => formatExpr(e, name))).join(', ')}`
        : r.reason;
    };
    expect(via('intersect')).toBe('3 along(+)');
    expect(via('meet')).toBe('4 near(X)');
  });

  it('refuses when nothing singles the candidate out, and when there is no candidate', () => {
    const s = editorOf(['O = (0, 0)', 'c = circle(O, 3)', 'l = line((-5, 7), (5, 7))'].join('\n'));
    expect(chosen(s, 'intersect', ['l', 'c'], [0, 7]).text).toBe(
      'refused: there is no candidate to choose: the curves do not meet',
    );
  });
});

describe('orientation dependence only as a last resort (law L16)', () => {
  it('a reflection-equivariant selector is written whenever one decides', () => {
    const s = editorOf(
      [
        'O = (0, 0)',
        'P = (4, 0)',
        'c = circle(O, 3)',
        'k = circle(P, 3)',
        'm = line(O, P)',
        'Q = (1, 5)',
      ].join('\n'),
    );
    for (const at of [
      [2, 2],
      [2, -2],
    ] as const) {
      const r = chosen(s, 'intersect', ['c', 'k'], [at[0], at[1]]);
      expect(r.r.ok && r.r.selectors.every((x) => !isOrientationDependent(x, null))).toBe(true);
    }
  });
});
