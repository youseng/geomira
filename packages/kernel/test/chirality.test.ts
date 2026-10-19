/**
 * The chirality flag (SPEC §4), checked against ACTUAL mirrored figures: mirror every free
 * point (x ↦ −x), evaluate again, and compare each line's direction d′ with the mirror
 * image M·d of the original direction. "Further along d" keeps its meaning on achiral
 * lines (d′ is a positive multiple of M·d) and swaps it on chiral ones (negative multiple).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { neg, rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { LAW_TIMEOUT } from './helpers/laws';
import type { Document } from '../src/document';
import { call, lit, type Expr } from '../src/expr';
import { vCross, vDot } from '../src/geom';
import type { Line } from '../src/value';
import { Builder, contextOf, evalDoc } from './helpers/doc';

const FIGURES = 200;

type Four = readonly [Expr, Expr, Expr, Expr];

/** Line constructions covering every chirality rule of the Run 2 tools. */
const CONSTRUCTIONS: Record<string, (p: Four) => Expr> = {
  line: ([a, b]) => call('line', [a, b]),
  segment: ([a, b]) => call('segment', [a, b]),
  ray: ([a, b]) => call('ray', [a, b]),
  'perp (toggles)': ([a, b, c]) => call('perp', [c, call('line', [a, b])]),
  'perp of perp (toggles twice)': ([a, b, c, d]) =>
    call('perp', [d, call('perp', [c, call('line', [a, b])])]),
  'parallel to a line (keeps)': ([a, b, c]) => call('parallel', [c, call('segment', [a, b])]),
  'parallel to a perp (keeps chiral)': ([a, b, c, d]) =>
    call('parallel', [d, call('perp', [c, call('ray', [a, b])])]),
  perp_bisector: ([a, b]) => call('perp_bisector', [a, b]),
  'perp to a perp_bisector (achiral again)': ([a, b, c]) =>
    call('perp', [c, call('perp_bisector', [a, b])]),
};

const EXPECTED_CHIRAL: Record<string, boolean> = {
  line: false,
  segment: false,
  ray: false,
  'perp (toggles)': true,
  'perp of perp (toggles twice)': false,
  'parallel to a line (keeps)': false,
  'parallel to a perp (keeps chiral)': true,
  perp_bisector: true,
  'perp to a perp_bisector (achiral again)': false,
};

function figure(rng: Rng, mirror: boolean): Document {
  const b = new Builder();
  const free = (name: string): Expr => {
    const x = rational(BigInt(rng.nextInt(2001) - 1000), 50n);
    const y = rational(BigInt(rng.nextInt(2001) - 1000), 50n);
    return b.add(name, call('point', [lit(mirror ? neg(x) : x), lit(y)]));
  };
  const pts: Four = [free('A'), free('B'), free('C'), free('D')];
  for (const [i, make] of Object.values(CONSTRUCTIONS).entries()) b.add(`l${String(i)}`, make(pts));
  return b.doc;
}

function lines<T>(doc: Document, F: Field<T>): Line<T>[] {
  const ev = evalDoc(doc, F, contextOf(doc));
  return doc.objects.flatMap((o) => {
    const v = ev.values.get(o.id);
    return v?.kind === 'line' ? [v] : [];
  });
}

function check<T>(F: Field<T>): number {
  let compared = 0;
  for (let i = 0; i < FIGURES; i += 1) {
    const seed = deriveSeed(99, i);
    const original = lines(figure(createRng(seed), false), F);
    const mirrored = lines(figure(createRng(seed), true), F);
    if (
      original.length !== Object.keys(CONSTRUCTIONS).length ||
      mirrored.length !== original.length
    )
      continue;
    for (const [k, name] of Object.keys(CONSTRUCTIONS).entries()) {
      const [l, m] = [original[k], mirrored[k]];
      if (l === undefined || m === undefined) throw new Error('missing line');
      expect(l.chiral, name).toBe(EXPECTED_CHIRAL[name]);
      expect(m.chiral, name).toBe(l.chiral);
      const md = { x: F.neg(l.d.x), y: l.d.y };
      const ctx = { scale: 1 };
      expect(F.isZero(vCross(F, m.d, md), 'area', ctx), `${name}: d′ ∥ M·d`).toBe(true);
      const along = F.sign(vDot(F, m.d, md), 'area', ctx);
      expect(along, `${name}: direction under mirroring`).toBe(l.chiral ? -1 : 1);
      compared += 1;
    }
  }
  return compared;
}

describe('the chirality flag matches mirrored figures', { timeout: LAW_TIMEOUT }, () => {
  it('RationalField (exact)', () => {
    expect(check(RationalField)).toBeGreaterThan(FIGURES * 8);
  });
  it('FloatField', () => {
    expect(check(FloatField)).toBeGreaterThan(FIGURES * 8);
  });
});
