/**
 * The chirality flag of the Run 3a line tools (SPEC §4), checked against ACTUAL mirrored
 * figures as in chirality.test.ts: tangent, polar, radical_axis and ext_bisector turn an
 * achiral direction (chiral); bisector is achiral; the straight-angle cases swap the two
 * (the bisector of a straight angle is a quarter turn of A − B, its external bisector is
 * the line BA itself). Over Q only the tools without square roots; bisectors over floats.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { neg, rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import { call, lit, type Expr } from '../src/expr';
import { vCross, vDot } from '../src/geom';
import type { Line } from '../src/value';
import { Builder, contextOf, evalDoc, num } from './helpers/doc';
import { LAW_TIMEOUT } from './helpers/laws';

const FIGURES = 200;

type Four = readonly [Expr, Expr, Expr, Expr];
type Construction = readonly [string, (p: Four) => Expr, boolean];

const EXACT: readonly Construction[] = [
  ['tangent at the anchor', ([a, b]) => call('tangent', [a, call('circle', [b, a])]), true],
  ['polar', ([a, b, c]) => call('polar', [c, call('circle', [a, b])]), true],
  [
    'radical_axis',
    ([a, b, c, d]) => call('radical_axis', [call('circle', [a, b]), call('circle', [c, d])]),
    true,
  ],
  [
    'perp to a tangent (achiral again)',
    ([a, b, c]) => call('perp', [c, call('tangent', [a, call('circle', [b, a])])]),
    false,
  ],
  [
    'parallel to a polar (keeps chiral)',
    ([a, b, c, d]) => call('parallel', [d, call('polar', [c, call('circle', [a, b])])]),
    true,
  ],
  [
    'cline of collinear points (achiral)',
    ([a, b]) => call('cline', [a, b, call('divide', [a, b, num(3)])]),
    false,
  ],
];

const FLOAT_ONLY: readonly Construction[] = [
  ['bisector', ([a, b, c]) => call('bisector', [a, b, c]), false],
  ['ext_bisector', ([a, b, c]) => call('ext_bisector', [a, b, c]), true],
  [
    'bisector of a straight angle',
    ([a, b]) => call('bisector', [a, b, call('divide', [a, b, num(2)])]),
    true,
  ],
  [
    'ext_bisector of a straight angle',
    ([a, b]) => call('ext_bisector', [a, b, call('divide', [a, b, num(2)])]),
    false,
  ],
  [
    'ext_bisector of a zero angle',
    ([a, b]) => call('ext_bisector', [a, b, call('divide', [b, a, num('1/2')])]),
    true,
  ],
];

function figure(rng: Rng, mirror: boolean, list: readonly Construction[]): Document {
  const b = new Builder();
  const free = (name: string): Expr => {
    const x = rational(BigInt(rng.nextInt(2001) - 1000), 50n);
    const y = rational(BigInt(rng.nextInt(2001) - 1000), 50n);
    return b.add(name, call('point', [lit(mirror ? neg(x) : x), lit(y)]));
  };
  const pts: Four = [free('A'), free('B'), free('C'), free('D')];
  for (const [i, [, make]] of list.entries()) b.add(`l${String(i)}`, make(pts));
  return b.doc;
}

function lines<T>(doc: Document, F: Field<T>): Line<T>[] {
  const ev = evalDoc(doc, F, contextOf(doc));
  return doc.objects.flatMap((o) => {
    const v = ev.values.get(o.id);
    return v?.kind === 'line' ? [v] : [];
  });
}

function check<T>(F: Field<T>, list: readonly Construction[]): number {
  let compared = 0;
  for (let i = 0; i < FIGURES; i += 1) {
    const seed = deriveSeed(101, i);
    const original = lines(figure(createRng(seed), false, list), F);
    const mirrored = lines(figure(createRng(seed), true, list), F);
    if (original.length !== list.length || mirrored.length !== list.length) continue;
    for (const [k, [name, , chiral]] of list.entries()) {
      const [l, m] = [original[k], mirrored[k]];
      if (l === undefined || m === undefined) throw new Error('missing line');
      expect(l.chiral, name).toBe(chiral);
      expect(m.chiral, name).toBe(chiral);
      const md = { x: F.neg(l.d.x), y: l.d.y };
      const ctx = { scale: 1 };
      expect(F.isZero(vCross(F, m.d, md), 'area', ctx), `${name}: d′ ∥ M·d`).toBe(true);
      expect(F.sign(vDot(F, m.d, md), 'area', ctx), `${name}: under mirroring`).toBe(
        chiral ? -1 : 1,
      );
      compared += 1;
    }
  }
  return compared;
}

describe(
  'the chirality flag of the circle line tools matches mirrored figures',
  { timeout: LAW_TIMEOUT },
  () => {
    it('RationalField (exact): tangent, polar, radical_axis, cline', () => {
      expect(check(RationalField, EXACT)).toBeGreaterThan(FIGURES * EXACT.length * 0.9);
    });
    it('FloatField: the same, plus bisector and ext_bisector with their straight and zero angles', () => {
      const all = [...EXACT, ...FLOAT_ONLY];
      expect(check(FloatField, all)).toBeGreaterThan(FIGURES * all.length * 0.9);
    });
  },
);
