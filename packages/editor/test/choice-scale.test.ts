/**
 * Found in the Run 10 audit (ADR-0017): the GUI choice measured its tier-2 margins against the
 * tester's LOCAL noise as LOCAL_SIGMA × the evaluation scale, which SPEC §3.1 clamps to ≥ 1, so
 * for a figure smaller than one unit the noise was larger than the figure and no same_side /
 * on_arc selector ever counted as firm: the same construction drawn at 1/100 of its size got
 * an orientation-dependent orient(±) / along(±) where the full-size one got a semantic selector.
 * The choice is a property of the figure's shape; it must not depend on its size.
 */
import { describe, expect, it } from 'vitest';
import { formatExpr, formatSelector } from '@geomira/kernel/selector';
import { createRng } from '@geomira/num/rng';
import { chooseSelectors } from '../src/choice';
import type { EditorState } from '../src/state';
import { editorOf, idOf, registry } from './helpers/editor';
import { candidatesOf } from './helpers/tracking';

const PAIRS: [string, string][] = [
  ['l1', 'c1'],
  ['l2', 'c1'],
  ['l3', 'c1'],
  ['l1', 'c2'],
  ['l2', 'c2'],
  ['c1', 'c2'],
];

/** Free points with LITERAL coordinates (k/10, or k/1000 for the small figure). */
function figureText(seed: number, small: boolean): string {
  const rng = createRng(seed);
  const c = () => {
    const k = rng.nextInt(101) - 50;
    return small ? `${String(k)}/1000` : `${String(k)}/10`;
  };
  const pts = ['A', 'B', 'C', 'D', 'E'].map((n) => `${n} = (${c()}, ${c()})`);
  const curves = ['c1 = circle(A, B, C)', 'c2 = circle(D, E)', 'l1 = line(A, D)'];
  return [...pts, ...curves, 'l2 = line(B, E)', 'l3 = line(C, D)'].join('\n');
}

function choices(s: EditorState): string[] {
  const out: string[] = [];
  const name = (id: number) => s.doc.objects.find((o) => o.id === id)?.name;
  for (const [an, bn] of PAIRS) {
    const [a, b] = [idOf(s, an), idOf(s, bn)];
    for (const x of candidatesOf(s.doc, a, b) ?? []) {
      const ch = chooseSelectors(s.doc, s.values, registry, 'intersect', [a, b], x);
      out.push(
        ch.ok
          ? `${an}∩${bn} ${String(ch.tier)} ${ch.selectors.map((z) => formatSelector(z, (e) => formatExpr(e, name))).join(', ')}`
          : `${an}∩${bn} refused`,
      );
    }
  }
  return out;
}

describe('the GUI selector choice does not depend on the size of the figure', () => {
  it('ten random figures and the same figures at 1/100 of their size get the same selectors', () => {
    for (let f = 0; f < 10; f++) {
      const big = editorOf(figureText(9000 + f, false));
      const small = editorOf(figureText(9000 + f, true));
      expect(choices(small), String(f)).toEqual(choices(big));
    }
  });
});
