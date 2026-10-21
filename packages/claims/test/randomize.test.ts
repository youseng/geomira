import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { isZero, mul, sub, add, type Rational } from '@geomira/num/rational';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import { assertInvariants } from '@geomira/kernel/invariants';
import type { Value } from '@geomira/kernel/value';
import { exprAt } from '../src/expr-path';
import {
  OBTUSE_MIN_DEG,
  randomFigure,
  RANDOMIZE_ATTEMPTS,
  SHAPE_MIN_DEG,
  TRIANGLE_TYPES,
  type RandomizeResult,
  type TriangleType,
} from '../src/randomize';
import { c, Figure, n, other, REGISTRY } from './helpers/build';

/** Run 9b (ADR-0016): Randomize draws a new figure through the GLOBAL sampler. */

function obtuseTriangle(): Figure {
  return new Figure().point('A', -1, 3).point('B', 0, 0).point('C', 4, 0);
}

function figureOf(r: RandomizeResult): { doc: Document; changed: readonly number[] } {
  if (r.kind !== 'figure') throw new Error(r.reason);
  return r;
}

function floats(doc: Document): ReadonlyMap<number, Value<number>> {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) throw new Error(ctx.reason);
  return evaluate(doc, REGISTRY, FloatField, ctx.ctx).values;
}

function xy(doc: Document, name: string): [number, number] {
  const o = doc.objects.find((x) => x.name === name);
  const v = o === undefined ? undefined : floats(doc).get(o.id);
  if (v?.kind !== 'point') throw new Error(`${name} is not a point`);
  return [v.x, v.y];
}

/** The angle at V of triangle XVY, in degrees. */
function angleAt(doc: Document, x: string, v: string, y: string): number {
  const [p, q, r] = [xy(doc, x), xy(doc, v), xy(doc, y)];
  const [ux, uy, wx, wy] = [p[0] - q[0], p[1] - q[1], r[0] - q[0], r[1] - q[1]];
  const cos = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
  return (Math.acos(cos) * 180) / Math.PI;
}

function angles(doc: Document): { a: number; b: number; c: number } {
  return {
    a: angleAt(doc, 'B', 'A', 'C'),
    b: angleAt(doc, 'A', 'B', 'C'),
    c: angleAt(doc, 'A', 'C', 'B'),
  };
}

function literal(doc: Document, name: string): readonly Rational[] {
  const o = doc.objects.find((x) => x.name === name);
  const e = o === undefined ? undefined : exprAt(o.def, []);
  if (e?.kind !== 'call') throw new Error(`${name} is not a call`);
  return e.args.map((a) => {
    if (a.kind !== 'lit') throw new Error(`${name} is not a free point`);
    return a.value;
  });
}

describe('randomFigure (Run 9b, ADR-0016)', () => {
  it('lists the four triangle types', () => {
    expect(TRIANGLE_TYPES).toEqual(['acute', 'obtuse', 'right', 'any']);
    expect(Object.isFrozen(TRIANGLE_TYPES)).toBe(true);
  });

  it('acute: an obtuse triangle becomes acute, every angle above the shape margin', () => {
    const f = obtuseTriangle();
    for (let seed = 0; seed < 40; seed++) {
      const r = figureOf(randomFigure(f.doc, REGISTRY, 'acute', seed));
      const t = angles(r.doc);
      for (const x of [t.a, t.b, t.c]) {
        expect(x).toBeLessThan(90);
        expect(x).toBeGreaterThan(SHAPE_MIN_DEG);
      }
      expect(r.changed).toEqual(['A', 'B', 'C'].map((x) => f.id(x)));
    }
  });

  it('obtuse: the angle at the first free point is obtuse', () => {
    const f = new Figure().point('A', 1, 3).point('B', 0, 0).point('C', 4, 0);
    for (let seed = 0; seed < 40; seed++) {
      const t = angles(figureOf(randomFigure(f.doc, REGISTRY, 'obtuse', seed)).doc);
      expect(t.a).toBeGreaterThan(OBTUSE_MIN_DEG);
      expect(t.b).toBeGreaterThan(SHAPE_MIN_DEG);
      expect(t.c).toBeGreaterThan(SHAPE_MIN_DEG);
    }
  });

  it('right: the angle at A is exactly 90° over Q (a special position, not a hypothesis)', () => {
    const f = obtuseTriangle();
    for (let seed = 0; seed < 40; seed++) {
      const doc = figureOf(randomFigure(f.doc, REGISTRY, 'right', seed)).doc;
      const [A, B, C] = ['A', 'B', 'C'].map((x) => literal(doc, x));
      const d = (
        p: readonly Rational[] | undefined,
        q: readonly Rational[] | undefined,
        i: number,
      ) => sub(p?.[i] ?? { num: 0n, den: 1n }, q?.[i] ?? { num: 0n, den: 1n });
      const dot = add(mul(d(B, A, 0), d(C, A, 0)), mul(d(B, A, 1), d(C, A, 1)));
      expect(isZero(dot)).toBe(true);
      const t = angles(doc);
      expect(t.b).toBeGreaterThan(SHAPE_MIN_DEG);
      expect(t.c).toBeGreaterThan(SHAPE_MIN_DEG);
    }
  });

  it('is deterministic for a seed and keeps ids, order, names, styles, claims and assumptions', () => {
    const f = obtuseTriangle().def('O', 'circumcenter', 'A', 'B', 'C');
    f.claim('collinear', 'A', 'B', 'O');
    for (const type of TRIANGLE_TYPES) {
      const a = randomFigure(f.doc, REGISTRY, type, 7);
      expect(randomFigure(f.doc, REGISTRY, type, 7)).toEqual(a);
      const doc = figureOf(a).doc;
      assertInvariants(doc);
      expect(doc.objects.map((o) => [o.id, o.name, o.style, o.layers])).toEqual(
        f.doc.objects.map((o) => [o.id, o.name, o.style, o.layers]),
      );
      expect(doc.objects.find((o) => o.name === 'O')?.def).toEqual(
        f.doc.objects.find((o) => o.name === 'O')?.def,
      );
      expect(doc.claims).toEqual(f.doc.claims);
      expect(doc.assumptions).toEqual(f.doc.assumptions);
      expect(doc.nextId).toBe(f.doc.nextId);
    }
  });

  it('samples land on the coarse rational grid: the exact run evaluates the triangle', () => {
    const f = obtuseTriangle().def('H', 'orthocenter', 'A', 'B', 'C');
    const doc = figureOf(randomFigure(f.doc, REGISTRY, 'acute', 3)).doc;
    const ctx = evalContextFor(doc);
    if (!ctx.ok) throw new Error(ctx.reason);
    const h = evaluate(doc, REGISTRY, RationalField, ctx.ctx).values.get(f.id('H'));
    expect(h?.kind).toBe('point');
  });

  it("respects the document's own assume lines", () => {
    const f = obtuseTriangle();
    f.assume('less', c('dist', 'A', 'B'), c('dist', 'A', 'C'));
    for (let seed = 0; seed < 30; seed++) {
      const doc = figureOf(randomFigure(f.doc, REGISTRY, 'acute', seed)).doc;
      const [a, b, cc] = [xy(doc, 'A'), xy(doc, 'B'), xy(doc, 'C')];
      expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(
        Math.hypot(a[0] - cc[0], a[1] - cc[1]),
      );
    }
  });

  it('keeps every object that is defined now defined (intersections, gliders)', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 1, 3)
      .def('w', 'circle', 'A', 'B', 'C')
      .def('P', 'on', 'w', n(2), n(1))
      .def('M', 'midpoint', 'A', 'B')
      .def('X', 'intersect', c('line', 'C', 'M'), 'w', other('C'));
    const before = floats(f.doc);
    expect(before.get(f.id('X'))?.kind).not.toBe('undefined');
    let moved = 0;
    for (let seed = 0; seed < 30; seed++) {
      const r = figureOf(randomFigure(f.doc, REGISTRY, 'any', seed));
      const v = floats(r.doc);
      for (const o of f.doc.objects) expect(v.get(o.id)?.kind, o.name).not.toBe('undefined');
      if (r.changed.includes(f.id('P'))) moved++;
    }
    expect(moved).toBe(30);
  });

  it('any needs no triangle; a typed choice needs three free points', () => {
    const f = new Figure().point('A', 0, 0).point('B', 2, 1).def('M', 'midpoint', 'A', 'B');
    expect(figureOf(randomFigure(f.doc, REGISTRY, 'any', 1)).changed.length).toBe(2);
    for (const type of ['acute', 'obtuse', 'right'] as const) {
      expect(randomFigure(f.doc, REGISTRY, type, 1)).toEqual({
        kind: 'refused',
        reason: `a ${type} triangle needs three free points; this figure has 2`,
      });
    }
  });

  it('refuses a figure with nothing free, and hypotheses no sample satisfies', () => {
    const empty = new Figure();
    expect(randomFigure(empty.doc, REGISTRY, 'any', 1)).toEqual({
      kind: 'refused',
      reason: 'nothing to randomize: the figure has no free points, gliders or params',
    });
    const f = obtuseTriangle();
    f.assume('acute', 'A', 'B', 'C');
    const r = randomFigure(f.doc, REGISTRY, 'obtuse', 1, 20);
    expect(r).toEqual({
      kind: 'refused',
      reason:
        'no figure with a obtuse triangle satisfied the hypotheses with every object defined in 20 attempts',
    });
    expect(RANDOMIZE_ATTEMPTS).toBe(500);
  });

  it('writes short exact decimals: points to 10^(⌊log10 scale⌋ − 2), params inside their range', () => {
    const f = obtuseTriangle().def('k', 'param', n(0), n(1), n('0.5'));
    for (let seed = 0; seed < 20; seed++) {
      const doc = figureOf(randomFigure(f.doc, REGISTRY, 'acute', seed)).doc;
      for (const name of ['A', 'B']) {
        const o = doc.objects.find((x) => x.name === name);
        const e = o === undefined ? undefined : exprAt(o.def, []);
        if (e?.kind !== 'call') throw new Error('not a call');
        for (const a of e.args) {
          if (a.kind !== 'lit') throw new Error('not a literal');
          // The scale is 5: two decimals. The text reads back as the exact value.
          expect(a.text ?? String(a.value.num)).toMatch(/^-?\d+(\.\d{1,2})?$/u);
          expect(a.value.den === 1n || a.text !== undefined).toBe(true);
        }
      }
      const [min, max, v] = literal(doc, 'k');
      expect(min).toEqual({ num: 0n, den: 1n });
      expect(max).toEqual({ num: 1n, den: 1n });
      expect(v !== undefined && v.num >= 0n && v.num <= v.den).toBe(true);
      expect(v !== undefined && 1000n % v.den === 0n).toBe(true);
    }
  });

  it('every type over many seeds gives a valid figure of that type', () => {
    const f = obtuseTriangle().def('O', 'circumcenter', 'A', 'B', 'C');
    const check: Record<TriangleType, (t: ReturnType<typeof angles>) => boolean> = {
      acute: (t) => Math.max(t.a, t.b, t.c) < 90,
      obtuse: (t) => t.a > OBTUSE_MIN_DEG,
      right: (t) => Math.abs(t.a - 90) < 1e-6,
      any: () => true,
    };
    for (const type of TRIANGLE_TYPES)
      for (let seed = 100; seed < 130; seed++) {
        const doc = figureOf(randomFigure(f.doc, REGISTRY, type, seed)).doc;
        assertInvariants(doc);
        expect(check[type](angles(doc)), `${type} ${String(seed)}`).toBe(true);
      }
  });
});
