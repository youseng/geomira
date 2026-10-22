/**
 * Found in the Run 10 audit (SPEC §7 GUI choice, ADR-0012 decisions 12–14): tier 1 wrote
 * other(P) for any existing point P at the other candidate, also one that lies on the curves
 * only by coincidence. Here B = (4, 0) is on c = circle(O, E) only because |OE| = 1 = |OB|:
 * intersect(l, c, other(B)) became Undefined ("needs the point on the circle") as soon as E
 * moved, although the intersection still existed. other(P) is now written only for a point
 * that stays on both curves when the figure moves (the local responses of tier 2); a point on
 * them by construction still gets it.
 */
import { describe, expect, it } from 'vitest';
import { call, ref } from '@geomira/kernel/expr';
import { chooseSelectors } from '../src/choice';
import { edit, editorOf, idOf, registry, valueOf } from './helpers/editor';

const FIGURE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'l = line(A, B)',
  'O = (3, 0)',
  'E = (3, 1)',
  'c = circle(O, E)',
];

describe('tier 1 needs a point on both curves by construction', () => {
  it('a point on the circle by coincidence is not used; the selector survives a move of E', () => {
    let s = editorOf(FIGURE.join('\n'));
    const [l, c] = [idOf(s, 'l'), idOf(s, 'c')];
    const ch = chooseSelectors(s.doc, s.values, registry, 'intersect', [l, c], {
      x: 2.01,
      y: 0.01,
    });
    if (!ch.ok) throw new Error(ch.reason);
    expect(ch.selectors.some((x) => x.kind === 'other')).toBe(false);
    s = edit(s, {
      kind: 'add',
      object: { name: 'X', def: call('intersect', [ref(l), ref(c)], ch.selectors) },
    });
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'E') });
    s = edit(s, { kind: 'dragMove', to: { x: 3, y: 1.01 } });
    s = edit(s, { kind: 'dragEnd' });
    expect(valueOf(s, 'X').kind).toBe('point');
  });

  it('a point on the circle by construction still gets other(P)', () => {
    const s = editorOf([...FIGURE.slice(0, 4), 'c = circle(O, B)'].join('\n'));
    const ch = chooseSelectors(
      s.doc,
      s.values,
      registry,
      'intersect',
      [idOf(s, 'l'), idOf(s, 'c')],
      {
        x: 2.01,
        y: 0.01,
      },
    );
    if (!ch.ok) throw new Error(ch.reason);
    expect(ch.tier).toBe(1);
    expect(ch.selectors).toEqual([{ kind: 'other', p: ref(idOf(s, 'B')) }]);
  });
});
