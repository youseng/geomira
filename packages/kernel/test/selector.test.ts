/**
 * @geomira/kernel/selector (Run 3b, SPEC §7): the selector classes, SPEC §7's definition of
 * ORIENTATION DEPENDENCE (`orient(±)`, or `along(±)` on a chiral line; everything else is
 * reflection-equivariant), checked on the flags of actual lines, and the text forms.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call, ref, type Selector } from '../src/expr';
import { formatExpr, formatSelector, isOrientationDependent, selectorClass } from '../src/selector';
import { Builder, evalDoc, num, pt, valueOf } from './helpers/doc';

const P = pt(1, 2);
const ALL: readonly Selector[] = [
  { kind: 'same_side', q: P, l: P },
  { kind: 'opposite_side', q: P, l: P },
  { kind: 'on_arc', b: P, c: P, a: P, not: false },
  { kind: 'on_arc', b: P, c: P, a: P, not: true },
  { kind: 'between', a: P, b: P },
  { kind: 'inside', c: P },
  { kind: 'outside', c: P },
  { kind: 'other', p: P },
  { kind: 'near', p: P },
  { kind: 'far_from', p: P },
  { kind: 'along', sign: 1 },
  { kind: 'along', sign: -1 },
  { kind: 'orient', sign: 1 },
  { kind: 'orient', sign: -1 },
];

describe('selector classes (SPEC §7)', () => {
  it('filters, rankers and low-level selectors', () => {
    expect(ALL.map((s) => selectorClass(s.kind))).toEqual([
      ...Array<string>(7).fill('filter'),
      ...Array<string>(3).fill('ranker'),
      ...Array<string>(4).fill('low-level'),
    ]);
    expect(() => selectorClass('bogus' as never)).toThrow(/unexpected selector kind/);
  });
});

describe('isOrientationDependent (SPEC §7 exact definition)', () => {
  it('orient(±) always; along(±) iff the line is chiral; nothing else', () => {
    for (const line of [null, { chiral: false }, { chiral: true }]) {
      for (const s of ALL) {
        const expected = s.kind === 'orient' || (s.kind === 'along' && line?.chiral === true);
        expect(isOrientationDependent(s, line), `${s.kind} on ${JSON.stringify(line)}`).toBe(
          expected,
        );
      }
    }
    expect(() => isOrientationDependent({ kind: 'bogus' } as never, null)).toThrow(
      /unexpected selector kind/,
    );
  });

  it('on the flags of actual lines: line(A, B) achiral, perp_bisector and tangent chiral', () => {
    const b = new Builder();
    const [A, B] = [b.point('A', 0, 0), b.point('B', 4, 1)];
    b.call('l', 'line', A, B);
    b.call('m', 'perp_bisector', A, B);
    b.call('t', 'tangent', B, call('circle', [A, B]));
    b.call('p', 'perp', A, call('perp_bisector', [A, B]));
    b.call('q', 'parallel', A, call('perp_bisector', [A, B]));
    const ev = evalDoc(b.doc, FloatField);
    const along: Selector = { kind: 'along', sign: 1 };
    const flags = ['l', 'm', 't', 'p', 'q'].map((n) => {
      const v = valueOf(b.doc, ev, n);
      if (v.kind !== 'line') throw new Error(n);
      return isOrientationDependent(along, v);
    });
    expect(flags).toEqual([false, true, true, false, true]);
  });
});

describe('text forms', () => {
  it('formats every selector in the language syntax', () => {
    const show = (e: unknown) => (e === P ? 'P' : '?');
    expect(ALL.map((s) => formatSelector(s, show))).toEqual([
      'same_side(P, P)',
      'opposite_side(P, P)',
      'on_arc(P, P, P)',
      'on_arc(P, P, not P)',
      'between(P, P)',
      'inside(P)',
      'outside(P)',
      'other(P)',
      'near(P)',
      'far_from(P)',
      'along(+)',
      'along(-)',
      'orient(+)',
      'orient(-)',
    ]);
    expect(() => formatSelector({ kind: 'bogus' } as never, show)).toThrow(/unexpected selector/);
  });

  it('formats expressions with names, #id for unnamed references, exact literals', () => {
    const name = (id: number) => (id === 1 ? 'A' : undefined);
    const e = call(
      'intersect',
      [ref(1), ref(7)],
      [{ kind: 'near', p: call('point', [num('-2/3'), num(0)]) }],
    );
    expect(formatExpr(e, name)).toBe('intersect(A, #7, near(point(-2/3, 0)))');
    expect(() => formatExpr({ kind: 'bogus' } as never, name)).toThrow(/unexpected expression/);
  });
});
